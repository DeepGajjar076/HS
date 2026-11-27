import {
  GstSettings,
  Invoice,
  MobileInvoiceLog,
} from '../src/types/hotel';
import { formatCurrency, formatStayDateTime } from '../src/utils/billing';

export function isSmsGatewayConfigured(): boolean {
  return Boolean(
    (process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      process.env.TWILIO_FROM_NUMBER) ||
      process.env.SMS_WEBHOOK_URL
  );
}

export function normalizeIndianMobile(raw: string): string {
  const digits = String(raw || '').replace(/\D/g, '');
  if (digits.length === 10) return `+91${digits}`;
  if (digits.startsWith('91') && digits.length === 12) return `+${digits}`;
  if (raw.trim().startsWith('+')) return raw.trim();
  return digits ? `+${digits}` : '';
}

export function buildMobileInvoiceMessage(
  invoice: Invoice,
  gst: GstSettings,
  invoiceUrl: string
): string {
  const sym = gst.currencySymbol || '₹';
  const billNo =
    invoice.billNumber ||
    invoice.invoiceNumber.replace(/^(INV|FNB)-/, 'BILL-');
  const taxLine =
    invoice.taxRegime === 'IGST'
      ? `IGST: ${formatCurrency(invoice.igstAmount, sym)}`
      : `CGST: ${formatCurrency(invoice.cgstAmount, sym)} | SGST: ${formatCurrency(invoice.sgstAmount, sym)}`;

  if (invoice.invoiceType === 'food') {
    return [
      `${gst.hotelTradeName} — Bill ${billNo} | F&B Tax Invoice ${invoice.invoiceNumber}`,
      `Dear ${invoice.guestName}, thank you for dining with us (${invoice.roomType || 'F&B'} · ${invoice.roomNumber}).`,
      `Order Time: ${formatStayDateTime(invoice.checkInDate, invoice.checkInTime)}`,
      `Taxable: ${formatCurrency(invoice.taxableTotal, sym)} | ${taxLine}`,
      `Grand Total: ${formatCurrency(invoice.grandTotal, sym)} (${invoice.paymentMethod})`,
      gst.hotelGstNumber ? `Hotel GSTIN: ${gst.hotelGstNumber}` : '',
      `View / Print A4 Invoice: ${invoiceUrl}`,
    ]
      .filter(Boolean)
      .join('\n');
  }

  return [
    `${gst.hotelTradeName} — Bill ${billNo} | Tax Invoice ${invoice.invoiceNumber}`,
    `Dear ${invoice.guestName}, thank you for staying with us (Room ${invoice.roomNumber}, ${invoice.nights} Night${invoice.nights > 1 ? 's' : ''}).`,
    `Check-In: ${formatStayDateTime(invoice.checkInDate, invoice.checkInTime)}`,
    `Check-Out: ${formatStayDateTime(invoice.checkOutDate, invoice.checkOutTime)}`,
    `Taxable: ${formatCurrency(invoice.taxableTotal, sym)} | ${taxLine}`,
    `Grand Total: ${formatCurrency(invoice.grandTotal, sym)} (${invoice.paymentMethod})`,
    gst.hotelGstNumber ? `Hotel GSTIN: ${gst.hotelGstNumber}` : '',
    `View / Print A4 Invoice: ${invoiceUrl}`,
  ]
    .filter(Boolean)
    .join('\n');
}

export async function dispatchMobileInvoice(
  invoice: Invoice,
  gst: GstSettings,
  channel: 'SMS' | 'WhatsApp',
  baseUrl: string,
  overrideMobile?: string
): Promise<MobileInvoiceLog> {
  const rawMobile = (overrideMobile || invoice.guestMobile || '').trim();
  const normalizedMobile = normalizeIndianMobile(rawMobile);
  const billNo =
    invoice.billNumber ||
    invoice.invoiceNumber.replace(/^(INV|FNB)-/, 'BILL-');
  const invoiceUrl = `${baseUrl.replace(/\/$/, '')}/api/invoices/${invoice.id}/view`;
  const messageText = buildMobileInvoiceMessage(invoice, gst, invoiceUrl);
  const sentAt = new Date().toISOString();
  const logId = `mob-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

  if (!rawMobile || rawMobile === '—' || normalizedMobile.length < 8) {
    return {
      id: logId,
      invoiceId: invoice.id,
      billNumber: billNo,
      invoiceNumber: invoice.invoiceNumber,
      recipientMobile: rawMobile || 'No mobile number',
      recipientName: invoice.guestName,
      channel,
      messageText,
      invoiceUrl,
      amount: invoice.grandTotal,
      status: 'Failed',
      sentAt,
      errorMessage: 'Valid guest mobile number is missing.',
    };
  }

  // 1. Generic SMS/WhatsApp Webhook if configured
  if (process.env.SMS_WEBHOOK_URL) {
    try {
      const resp = await fetch(process.env.SMS_WEBHOOK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(process.env.SMS_WEBHOOK_TOKEN
            ? { Authorization: `Bearer ${process.env.SMS_WEBHOOK_TOKEN}` }
            : {}),
        },
        body: JSON.stringify({
          to: normalizedMobile,
          channel,
          message: messageText,
          billNumber: billNo,
          invoiceNumber: invoice.invoiceNumber,
          invoiceUrl,
        }),
      });
      if (!resp.ok) {
        throw new Error(`Webhook returned ${resp.status}`);
      }
      return {
        id: logId,
        invoiceId: invoice.id,
        billNumber: billNo,
        invoiceNumber: invoice.invoiceNumber,
        recipientMobile: rawMobile,
        recipientName: invoice.guestName,
        channel,
        messageText,
        invoiceUrl,
        amount: invoice.grandTotal,
        status: 'Delivered (Gateway)',
        sentAt,
      };
    } catch (err) {
      return {
        id: logId,
        invoiceId: invoice.id,
        billNumber: billNo,
        invoiceNumber: invoice.invoiceNumber,
        recipientMobile: rawMobile,
        recipientName: invoice.guestName,
        channel,
        messageText,
        invoiceUrl,
        amount: invoice.grandTotal,
        status: 'Failed',
        sentAt,
        errorMessage:
          err instanceof Error ? err.message : 'SMS webhook dispatch failed',
      };
    }
  }

  // 2. Twilio REST API if configured
  if (
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN &&
    process.env.TWILIO_FROM_NUMBER
  ) {
    try {
      const sid = process.env.TWILIO_ACCOUNT_SID;
      const auth = Buffer.from(
        `${sid}:${process.env.TWILIO_AUTH_TOKEN}`
      ).toString('base64');
      const from =
        channel === 'WhatsApp'
          ? `whatsapp:${process.env.TWILIO_WHATSAPP_FROM || process.env.TWILIO_FROM_NUMBER}`
          : process.env.TWILIO_FROM_NUMBER;
      const to =
        channel === 'WhatsApp'
          ? `whatsapp:${normalizedMobile}`
          : normalizedMobile;

      const params = new URLSearchParams({
        From: from,
        To: to,
        Body: messageText,
      });

      const resp = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
        {
          method: 'POST',
          headers: {
            Authorization: `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: params.toString(),
        }
      );

      if (!resp.ok) {
        const errBody = await resp.text();
        throw new Error(`Twilio error ${resp.status}: ${errBody.slice(0, 120)}`);
      }

      return {
        id: logId,
        invoiceId: invoice.id,
        billNumber: billNo,
        invoiceNumber: invoice.invoiceNumber,
        recipientMobile: rawMobile,
        recipientName: invoice.guestName,
        channel,
        messageText,
        invoiceUrl,
        amount: invoice.grandTotal,
        status: 'Delivered (Gateway)',
        sentAt,
      };
    } catch (err) {
      return {
        id: logId,
        invoiceId: invoice.id,
        billNumber: billNo,
        invoiceNumber: invoice.invoiceNumber,
        recipientMobile: rawMobile,
        recipientName: invoice.guestName,
        channel,
        messageText,
        invoiceUrl,
        amount: invoice.grandTotal,
        status: 'Failed',
        sentAt,
        errorMessage:
          err instanceof Error ? err.message : 'Twilio dispatch failed',
      };
    }
  }

  // 3. Local archived SMS/WhatsApp dispatch when gateway env vars are not configured
  return {
    id: logId,
    invoiceId: invoice.id,
    billNumber: billNo,
    invoiceNumber: invoice.invoiceNumber,
    recipientMobile: rawMobile,
    recipientName: invoice.guestName,
    channel,
    messageText,
    invoiceUrl,
    amount: invoice.grandTotal,
    status: 'Archived Dispatch (Ready)',
    sentAt,
  };
}
