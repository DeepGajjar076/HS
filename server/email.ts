import nodemailer from 'nodemailer';
import {
  EmailReceiptLog,
  GstSettings,
  Invoice,
  InvoiceTheme,
} from '../src/types/hotel';
import {
  amountInIndianWords,
  formatCurrency,
  formatDateTimeDisplay,
  formatStayDateTime,
  formatTemplateDateTime,
} from '../src/utils/billing';

function escapeHtml(input: string): string {
  return String(input || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function isSmtpConfigured(): boolean {
  return Boolean(
    process.env.SMTP_HOST &&
      process.env.SMTP_USER &&
      process.env.SMTP_PASS
  );
}

export function buildThemedEmailHtml(
  invoice: Invoice,
  gst: GstSettings,
  theme: InvoiceTheme,
  options?: { standalonePrint?: boolean; autoPrint?: boolean }
): string {
  const sym = gst.currencySymbol || '₹';
  const isFoodBill = invoice.invoiceType === 'food';
  const billNo =
    invoice.billNumber ||
    invoice.invoiceNumber.replace(/^(INV|FNB)-/, 'BILL-');
  const isShivClassic = theme.preset === 'shiv_residency_classic';
  const accent = isShivClassic
    ? /^#[0-9A-Fa-f]{6}$/.test(theme.accentColor) && theme.accentColor !== '#0F172A'
      ? theme.accentColor
      : '#F58220'
    : /^#[0-9A-Fa-f]{6}$/.test(theme.accentColor)
      ? theme.accentColor
      : '#0F172A';

  if (isShivClassic) {
    const fmt = (n: number) => (Number.isFinite(n) ? n : 0).toFixed(2);
    const uniqueRates = Array.from(
      new Set(invoice.lineItems.map((l) => l.gstRate).filter((r) => r >= 0))
    );
    const singleRate = uniqueRates.length === 1 ? uniqueRates[0] : null;
    const halfLabel =
      singleRate !== null ? ` (${Number((singleRate / 2).toFixed(2))}%)` : '';
    const policyLines = (
      theme.termsAndConditions ||
      gst.hotelPolicy ||
      '1) Check in time is 12:00 PM and check out time is 10:00 AM.\n2) Guest agrees to pay all charges incurred, abide by hotel policies, and be responsible for any damages or losses during their stay.'
    )
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
    const footerLines = (
      theme.footerNote ||
      'Thank you for staying with us.\nWe offer customized package for corporate clients.'
    )
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
    const isShivBrand = gst.hotelTradeName.toLowerCase().includes('shiv');

    const itemRows = invoice.lineItems
      .map((line, idx) => {
        const isFirstRoom = !isFoodBill && idx === 0;
        const label = isFirstRoom
          ? `(Room No. : ${invoice.roomNumber})`
          : line.description;
        return `<tr>
          <td style="padding:6px 6px;border-right:1px solid #000;border-bottom:1px solid #000;text-align:center;">${idx + 1}</td>
          <td style="padding:6px 6px;border-right:1px solid #000;border-bottom:1px solid #000;text-align:center;font-family:monospace;">${theme.showSacCodes ? escapeHtml(line.sac) : '—'}</td>
          <td style="padding:6px 8px;border-right:1px solid #000;border-bottom:1px solid #000;">${escapeHtml(label)}</td>
          <td style="padding:6px 6px;border-right:1px solid #000;border-bottom:1px solid #000;text-align:center;">${line.qty}</td>
          <td style="padding:6px 6px;border-right:1px solid #000;border-bottom:1px solid #000;text-align:right;font-family:monospace;">${fmt(line.rate)}</td>
          <td style="padding:6px 6px;border-right:1px solid #000;border-bottom:1px solid #000;text-align:right;font-family:monospace;">0.00</td>
          <td style="padding:6px 6px;border-right:1px solid #000;border-bottom:1px solid #000;text-align:right;font-family:monospace;">${fmt(line.gstRate)}%</td>
          <td style="padding:6px 8px;border-bottom:1px solid #000;text-align:right;font-family:monospace;">${fmt(line.taxable)}</td>
        </tr>`;
      })
      .join('');

    const taxRows =
      theme.showGstBreakdown && invoice.taxRegime === 'IGST'
        ? `<tr><td colspan="7" style="padding:6px 8px;border-right:1px solid #000;border-bottom:1px solid #000;font-weight:700;">IGST${singleRate !== null ? ` (${singleRate}%)` : ''}</td><td style="padding:6px 8px;border-bottom:1px solid #000;text-align:right;font-family:monospace;">${fmt(invoice.igstAmount)}</td></tr>`
        : theme.showGstBreakdown
          ? `<tr><td colspan="7" style="padding:6px 8px;border-right:1px solid #000;border-bottom:1px solid #000;font-weight:700;">SGST${halfLabel}</td><td style="padding:6px 8px;border-bottom:1px solid #000;text-align:right;font-family:monospace;">${fmt(invoice.sgstAmount)}</td></tr>
             <tr><td colspan="7" style="padding:6px 8px;border-right:1px solid #000;border-bottom:1px solid #000;font-weight:700;">CGST${halfLabel}</td><td style="padding:6px 8px;border-bottom:1px solid #000;text-align:right;font-family:monospace;">${fmt(invoice.cgstAmount)}</td></tr>`
          : '';

    return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>${escapeHtml(invoice.invoiceNumber)}</title>
<style>
  @page { size: A4 portrait; margin: 10mm; }
  @media print {
    body { background: #ffffff !important; padding: 0 !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    .no-print { display: none !important; }
    .invoice-card { max-width: 100% !important; }
  }
</style>
</head>
<body style="margin:0;padding:20px;background:#f8fafc;font-family:Arial,Helvetica,sans-serif;color:#000000;">
  ${
    options?.standalonePrint
      ? `<div class="no-print" style="max-width:780px;margin:0 auto 14px auto;display:flex;align-items:center;justify-content:space-between;background:#ffffff;border:1px solid #cbd5e1;border-radius:6px;padding:10px 16px;">
          <div style="font-size:13px;font-weight:600;color:#0f172a;">${escapeHtml(gst.hotelTradeName)} — ${escapeHtml(invoice.invoiceNumber)}</div>
          <button type="button" onclick="window.print()" style="background:#0f172a;color:#ffffff;border:none;border-radius:6px;padding:8px 16px;font-size:12px;font-weight:600;cursor:pointer;">Print A4 / Save PDF</button>
        </div>`
      : ''
  }
  <div class="invoice-card" style="max-width:780px;margin:0 auto;background:#ffffff;border:1.5px solid #000000;">
    <div style="background:${accent};border-bottom:1px solid #000;padding:6px 12px;font-size:11px;font-weight:700;color:#000;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="font-family:monospace;">GSTIN: ${escapeHtml(gst.hotelGstNumber || 'N/A')}</td>
          <td style="text-align:center;font-size:12px;">${isFoodBill ? 'Food Tax Invoice' : 'Tax Invoice'}</td>
          <td style="text-align:right;">Ph. ${escapeHtml(gst.hotelPhone || '—')}</td>
        </tr>
      </table>
    </div>
    <div style="padding:12px 16px;border-bottom:1px solid #000;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="vertical-align:middle;">
            <div style="font-size:22px;font-weight:800;letter-spacing:-0.01em;text-transform:uppercase;">${escapeHtml(gst.hotelTradeName)}</div>
            <div style="height:2.5px;background:#000;max-width:380px;margin:6px 0;"></div>
            <div style="font-size:11px;font-weight:600;">${escapeHtml(gst.hotelAddress)}</div>
            <div style="font-size:11px;font-weight:600;margin-top:2px;">E-mail:- ${escapeHtml(gst.hotelEmail)}</div>
          </td>
          <td style="text-align:right;vertical-align:middle;width:140px;">
            ${
              isShivBrand
                ? `<div style="display:inline-block;text-align:center;line-height:1;">
                     <div style="font-size:12px;font-weight:800;font-style:italic;color:#DC2626;text-align:left;">hotel</div>
                     <div style="font-size:36px;font-weight:900;font-style:italic;color:#0284C7;letter-spacing:-2px;border-bottom:2px solid #0284C7;">shiv</div>
                     <div style="font-size:12px;font-weight:800;color:${accent};letter-spacing:1px;margin-top:2px;">RESIDENCY</div>
                   </div>`
                : `<div style="display:inline-block;background:${accent};border:2px solid #000;padding:8px 14px;font-weight:900;font-size:16px;">${escapeHtml(theme.monogram || 'HSR')}</div>`
            }
          </td>
        </tr>
      </table>
    </div>

    <div style="padding:10px 14px 6px 14px;font-size:12px;font-weight:700;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td>Bill No.: <span style="font-family:monospace;">${escapeHtml(billNo)}</span></td>
          <td style="text-align:right;">Dated : <span style="border-bottom:1px dotted #000;padding-bottom:1px;font-family:monospace;">${escapeHtml(formatTemplateDateTime(invoice.issuedAt))}</span></td>
        </tr>
      </table>
    </div>

    <div style="margin:0 12px 12px 12px;border:1px solid #000;">
      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:11px;">
        <tr>
          <td style="width:120px;background:${accent};padding:6px 8px;font-weight:700;border-right:1px solid #000;border-bottom:1px solid #000;">Invoice No :</td>
          <td colspan="3" style="padding:6px 8px;border-bottom:1px solid #000;font-family:monospace;font-weight:600;"><div style="border-bottom:1px dotted #000;padding-bottom:2px;">${escapeHtml(invoice.invoiceNumber)}</div></td>
        </tr>
        <tr>
          <td style="background:${accent};padding:6px 8px;font-weight:700;border-right:1px solid #000;border-bottom:1px solid #000;">Guest Name:</td>
          <td colspan="3" style="padding:6px 8px;border-bottom:1px solid #000;font-weight:600;"><div style="border-bottom:1px dotted #000;padding-bottom:2px;">${escapeHtml(invoice.guestName)}${invoice.guestMobile && invoice.guestMobile !== '—' ? ` &nbsp;·&nbsp; Ph: ${escapeHtml(invoice.guestMobile)}` : ''}</div></td>
        </tr>
        <tr>
          <td style="background:${accent};padding:6px 8px;font-weight:700;border-right:1px solid #000;border-bottom:1px solid #000;">Address:</td>
          <td colspan="3" style="padding:6px 8px;border-bottom:1px solid #000;"><div style="border-bottom:1px dotted #000;padding-bottom:2px;">${escapeHtml(invoice.guestAddress || '—')}</div></td>
        </tr>
        <tr>
          <td style="background:${accent};padding:6px 8px;font-weight:700;border-right:1px solid #000;border-bottom:1px solid #000;">${isFoodBill ? 'Service Type:' : 'Number of Person:'}</td>
          <td colspan="3" style="padding:6px 8px;border-bottom:1px solid #000;"><div style="border-bottom:1px dotted #000;padding-bottom:2px;">${isFoodBill ? escapeHtml(`${invoice.roomType || 'F&B'} · ${invoice.roomNumber}`) : String(invoice.guestCount ?? 1)}</div></td>
        </tr>
        <tr>
          <td style="background:${accent};padding:6px 8px;font-weight:700;border-right:1px solid #000;border-bottom:1px solid #000;">Company Name:</td>
          <td colspan="3" style="padding:6px 8px;border-bottom:1px solid #000;"><div style="border-bottom:1px dotted #000;padding-bottom:2px;">${escapeHtml(invoice.companyName || '—')}</div></td>
        </tr>
        ${
          theme.showCompanyGstBlock
            ? `<tr>
                 <td style="background:${accent};padding:6px 8px;font-weight:700;border-right:1px solid #000;border-bottom:1px solid #000;">GSTIN:</td>
                 <td colspan="3" style="padding:6px 8px;border-bottom:1px solid #000;font-family:monospace;"><div style="border-bottom:1px dotted #000;padding-bottom:2px;">${escapeHtml(invoice.companyGst || '—')}</div></td>
               </tr>`
            : ''
        }
        <tr>
          <td style="background:${accent};padding:6px 8px;font-weight:700;border-right:1px solid #000;border-bottom:1px solid #000;">${isFoodBill ? 'Order Date:' : 'Check In:'}</td>
          <td style="padding:6px 8px;border-right:1px solid #000;border-bottom:1px solid #000;"><div style="border-bottom:1px dotted #000;padding-bottom:2px;">${escapeHtml(formatTemplateDateTime(invoice.checkInDate, invoice.checkInTime))}</div></td>
          <td style="width:110px;background:${accent};padding:6px 8px;font-weight:700;border-right:1px solid #000;border-bottom:1px solid #000;">${isFoodBill ? 'Bill Type:' : 'Check Out:'}</td>
          <td style="padding:6px 8px;border-bottom:1px solid #000;"><div style="border-bottom:1px dotted #000;padding-bottom:2px;">${escapeHtml(isFoodBill ? invoice.serviceLabel || 'Restaurant / F&B' : formatTemplateDateTime(invoice.checkOutDate, invoice.checkOutTime))}</div></td>
        </tr>
      </table>

      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:11px;">
        <thead>
          <tr style="background:${accent};font-weight:700;">
            <th style="padding:6px;border-right:1px solid #000;border-bottom:1px solid #000;text-align:center;">S.No.</th>
            <th style="padding:6px;border-right:1px solid #000;border-bottom:1px solid #000;text-align:center;">HSN/SAC</th>
            <th style="padding:6px 8px;border-right:1px solid #000;border-bottom:1px solid #000;text-align:left;">${isFoodBill ? 'Item Description' : 'Room No.'}</th>
            <th style="padding:6px;border-right:1px solid #000;border-bottom:1px solid #000;text-align:center;">${isFoodBill ? 'Qty' : 'No. Of Days'}</th>
            <th style="padding:6px;border-right:1px solid #000;border-bottom:1px solid #000;text-align:right;">${isFoodBill ? 'Rate' : 'Room Rent'}</th>
            <th style="padding:6px;border-right:1px solid #000;border-bottom:1px solid #000;text-align:right;">${isFoodBill ? 'Other Charges' : 'Extra Bed Charges'}</th>
            <th style="padding:6px;border-right:1px solid #000;border-bottom:1px solid #000;text-align:right;">GST %</th>
            <th style="padding:6px 8px;border-bottom:1px solid #000;text-align:right;">Amount (${escapeHtml(sym)})</th>
          </tr>
        </thead>
        <tbody>
          ${itemRows}
          ${invoice.discountAmount > 0 ? `<tr><td colspan="7" style="padding:6px 8px;border-right:1px solid #000;border-bottom:1px solid #000;font-weight:600;">Discount Applied</td><td style="padding:6px 8px;border-bottom:1px solid #000;text-align:right;font-family:monospace;">-${fmt(invoice.discountAmount)}</td></tr>` : ''}
          <tr><td colspan="7" style="padding:6px 8px;border-right:1px solid #000;border-bottom:1px solid #000;font-weight:700;">Total</td><td style="padding:6px 8px;border-bottom:1px solid #000;text-align:right;font-family:monospace;">${fmt(invoice.taxableTotal)}</td></tr>
          ${taxRows}
          <tr><td colspan="7" style="padding:6px 8px;border-right:1px solid #000;border-bottom:1px solid #000;font-weight:700;">Total GST</td><td style="padding:6px 8px;border-bottom:1px solid #000;text-align:right;font-family:monospace;">${fmt(invoice.totalGst)}</td></tr>
          <tr><td colspan="7" style="padding:7px 8px;border-right:1px solid #000;border-bottom:1px solid #000;font-weight:800;font-size:12px;">Grand Total</td><td style="padding:7px 8px;border-bottom:1px solid #000;text-align:right;font-family:monospace;font-weight:800;font-size:12px;">${fmt(invoice.grandTotal)}</td></tr>
        </tbody>
      </table>

      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:11px;">
        <tr>
          <td style="width:128px;padding:7px 8px;font-weight:700;border-right:1px solid #000;border-bottom:1px solid #000;">Amount in Words:-</td>
          <td style="padding:7px 8px;border-bottom:1px solid #000;font-weight:700;">${escapeHtml(amountInIndianWords(invoice.grandTotal))}</td>
        </tr>
        <tr>
          <td style="padding:7px 8px;font-weight:700;border-right:1px solid #000;border-bottom:1px solid #000;">Payment Method:-</td>
          <td style="padding:7px 8px;border-bottom:1px solid #000;font-weight:700;">${escapeHtml(invoice.paymentMethod)}${invoice.paymentReference ? ` <span style="font-weight:400;font-family:monospace;">(Ref: ${escapeHtml(invoice.paymentReference)})</span>` : ''}${theme.showPaymentSummary && invoice.advancePaid > 0 ? ` <span style="font-weight:400;">· Advance: ${escapeHtml(formatCurrency(invoice.advancePaid, sym))} · Net Paid: ${escapeHtml(formatCurrency(invoice.netPaid, sym))}</span>` : ''}</td>
        </tr>
      </table>

      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:11px;font-weight:700;">
        <tr>
          <td style="width:50%;border-right:1px solid #000;border-bottom:1px solid #000;padding:48px 24px 10px 24px;text-align:center;">
            <div style="border-top:1px solid #000;padding-top:4px;">Guest's Sign</div>
          </td>
          <td style="width:50%;border-bottom:1px solid #000;padding:48px 24px 10px 24px;text-align:center;">
            <div style="border-top:1px solid #000;padding-top:4px;">${escapeHtml(theme.signatoryTitle || "Cashier's Sign")}</div>
          </td>
        </tr>
      </table>

      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:11px;">
        <tr>
          <td style="width:128px;padding:8px;font-weight:700;border-right:1px solid #000;border-bottom:1px solid #000;vertical-align:top;">Terms and Conditions</td>
          <td style="padding:8px;border-bottom:1px solid #000;font-weight:700;line-height:1.45;">${policyLines.map((l) => `<div>${escapeHtml(l)}</div>`).join('')}</td>
        </tr>
      </table>

      <div style="background:${accent};padding:10px 14px;text-align:center;font-weight:700;font-size:12px;color:#000;line-height:1.45;">
        ${footerLines.map((l) => `<div>${escapeHtml(l)}</div>`).join('')}
      </div>
    </div>
  </div>
  ${options?.autoPrint ? '<script>window.addEventListener("load",function(){setTimeout(function(){window.print();},250);});</script>' : ''}
</body>
</html>`;
  }

  const rowsHtml = invoice.lineItems
    .map(
      (item) => `
      <tr>
        <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;color:#0f172a;font-size:13px;">${escapeHtml(item.description)}</td>
        ${theme.showSacCodes ? `<td style="padding:10px 8px;border-bottom:1px solid #e2e8f0;color:#64748b;font-family:monospace;font-size:12px;">${escapeHtml(item.sac)}</td>` : ''}
        <td style="padding:10px 8px;border-bottom:1px solid #e2e8f0;text-align:right;color:#334155;font-size:13px;">${item.qty}</td>
        <td style="padding:10px 8px;border-bottom:1px solid #e2e8f0;text-align:right;color:#334155;font-size:13px;">${escapeHtml(formatCurrency(item.rate, sym))}</td>
        <td style="padding:10px 8px;border-bottom:1px solid #e2e8f0;text-align:right;color:#334155;font-size:13px;">${item.gstRate}%</td>
        <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;text-align:right;color:#0f172a;font-weight:600;font-size:13px;">${escapeHtml(formatCurrency(item.total, sym))}</td>
      </tr>`
    )
    .join('');

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>${escapeHtml(invoice.invoiceNumber)}</title>
<style>
  @page { size: A4 portrait; margin: 10mm; }
  @media print {
    body { background: #ffffff !important; padding: 0 !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    .no-print { display: none !important; }
    .invoice-card { border: none !important; box-shadow: none !important; max-width: 100% !important; }
  }
</style>
</head>
<body style="margin:0;padding:24px;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#0f172a;">
  ${
    options?.standalonePrint
      ? `<div class="no-print" style="max-width:740px;margin:0 auto 14px auto;display:flex;align-items:center;justify-content:space-between;background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;padding:10px 16px;">
          <div style="font-size:13px;font-weight:600;color:#0f172a;">${escapeHtml(gst.hotelTradeName)} — ${escapeHtml(invoice.invoiceNumber)}</div>
          <button type="button" onclick="window.print()" style="background:#0f172a;color:#ffffff;border:none;border-radius:6px;padding:8px 16px;font-size:12px;font-weight:600;cursor:pointer;">Print A4 / Save PDF</button>
        </div>`
      : ''
  }
  <div class="invoice-card" style="max-width:740px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
    <div style="background:${accent};color:#ffffff;padding:24px 28px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td>
            <div style="font-size:20px;font-weight:700;letter-spacing:-0.02em;">${escapeHtml(gst.hotelTradeName)}</div>
            <div style="font-size:12px;opacity:0.85;margin-top:4px;">${escapeHtml(theme.headerTagline)}</div>
          </td>
          <td style="text-align:right;vertical-align:top;">
            <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.08em;opacity:0.8;">${isFoodBill ? 'Restaurant & F&B Tax Invoice' : 'Tax Invoice Receipt'}</div>
            <div style="font-size:16px;font-weight:700;font-family:monospace;margin-top:2px;">${escapeHtml(invoice.invoiceNumber)}</div>
            <div style="font-size:11px;font-family:monospace;opacity:0.9;margin-top:2px;">Bill No: ${escapeHtml(billNo)}</div>
            <div style="font-size:11px;opacity:0.85;margin-top:2px;">Issued: ${escapeHtml(formatDateTimeDisplay(invoice.issuedAt))}</div>
          </td>
        </tr>
      </table>
    </div>
    <div style="padding:24px 28px;">
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;font-size:13px;">
        <tr>
          <td style="vertical-align:top;width:50%;padding-right:12px;">
            <div style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:4px;">Billed To</div>
            <div style="font-weight:600;color:#0f172a;">${escapeHtml(invoice.guestName)}</div>
            <div style="color:#475569;">Mobile: ${escapeHtml(invoice.guestMobile)}</div>
            ${invoice.companyName ? `<div style="color:#334155;margin-top:4px;font-weight:500;">${escapeHtml(invoice.companyName)}</div>` : ''}
            ${theme.showCompanyGstBlock && invoice.companyGst ? `<div style="color:#475569;font-family:monospace;font-size:12px;">GSTIN: ${escapeHtml(invoice.companyGst)}</div>` : ''}
          </td>
          <td style="vertical-align:top;width:50%;text-align:right;">
            <div style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:4px;">${isFoodBill ? 'Order & Supplier Details' : 'Stay Details'}</div>
            ${
              isFoodBill
                ? `<div style="color:#0f172a;">${escapeHtml(invoice.roomType || 'Restaurant / F&B')} · ${escapeHtml(invoice.roomNumber)}</div>
                   <div style="color:#475569;">Order Time: ${escapeHtml(formatStayDateTime(invoice.checkInDate, invoice.checkInTime))}</div>`
                : `<div style="color:#0f172a;">Room ${escapeHtml(invoice.roomNumber)} (${escapeHtml(invoice.roomType)})</div>
                   <div style="color:#475569;">Check-In: ${escapeHtml(formatStayDateTime(invoice.checkInDate, invoice.checkInTime))}</div>
                   <div style="color:#475569;">Check-Out: ${escapeHtml(formatStayDateTime(invoice.checkOutDate, invoice.checkOutTime))}</div>`
            }
            <div style="color:#475569;">Supplier GSTIN: <span style="font-family:monospace;">${escapeHtml(gst.hotelGstNumber)}</span></div>
          </td>
        </tr>
      </table>

      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border-top:2px solid ${accent};">
        <thead>
          <tr style="background:#f8fafc;">
            <th style="padding:10px 12px;text-align:left;font-size:11px;color:#475569;text-transform:uppercase;">Description</th>
            ${theme.showSacCodes ? `<th style="padding:10px 8px;text-align:left;font-size:11px;color:#475569;text-transform:uppercase;">SAC</th>` : ''}
            <th style="padding:10px 8px;text-align:right;font-size:11px;color:#475569;text-transform:uppercase;">Qty</th>
            <th style="padding:10px 8px;text-align:right;font-size:11px;color:#475569;text-transform:uppercase;">Rate</th>
            <th style="padding:10px 8px;text-align:right;font-size:11px;color:#475569;text-transform:uppercase;">GST</th>
            <th style="padding:10px 12px;text-align:right;font-size:11px;color:#475569;text-transform:uppercase;">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>

      <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:20px;">
        <tr>
          <td style="width:55%;vertical-align:top;font-size:12px;color:#475569;">
            ${theme.showPaymentSummary ? `
              <div style="font-weight:600;color:#0f172a;margin-bottom:4px;">Payment Settlement</div>
              <div>Method: ${escapeHtml(invoice.paymentMethod)}</div>
              ${invoice.paymentReference ? `<div>Ref: ${escapeHtml(invoice.paymentReference)}</div>` : ''}
              <div>Advance Adjusted: ${escapeHtml(formatCurrency(invoice.advancePaid, sym))}</div>
              <div>Net Settled: ${escapeHtml(formatCurrency(invoice.netPaid, sym))}</div>
            ` : ''}
          </td>
          <td style="width:45%;vertical-align:top;">
            <table width="100%" cellpadding="4" cellspacing="0" style="font-size:13px;">
              <tr><td style="color:#475569;">Taxable Value</td><td style="text-align:right;font-weight:500;">${escapeHtml(formatCurrency(invoice.taxableTotal, sym))}</td></tr>
              ${
                theme.showGstBreakdown
                  ? invoice.taxRegime === 'IGST'
                    ? `<tr><td style="color:#475569;">IGST</td><td style="text-align:right;">${escapeHtml(formatCurrency(invoice.igstAmount, sym))}</td></tr>`
                    : `<tr><td style="color:#475569;">CGST</td><td style="text-align:right;">${escapeHtml(formatCurrency(invoice.cgstAmount, sym))}</td></tr>
                       <tr><td style="color:#475569;">SGST</td><td style="text-align:right;">${escapeHtml(formatCurrency(invoice.sgstAmount, sym))}</td></tr>`
                  : `<tr><td style="color:#475569;">Total GST</td><td style="text-align:right;">${escapeHtml(formatCurrency(invoice.totalGst, sym))}</td></tr>`
              }
              <tr style="border-top:1px solid #cbd5e1;"><td style="font-weight:700;font-size:15px;padding-top:8px;">Grand Total</td><td style="text-align:right;font-weight:700;font-size:15px;padding-top:8px;color:${accent};">${escapeHtml(formatCurrency(invoice.grandTotal, sym))}</td></tr>
            </table>
          </td>
        </tr>
      </table>

      <div style="margin-top:24px;padding-top:16px;border-top:1px solid #e2e8f0;font-size:12px;color:#64748b;">
        <div style="color:#0f172a;font-weight:500;margin-bottom:4px;">${escapeHtml(theme.footerNote)}</div>
        <div>${escapeHtml(gst.hotelLegalName)} · ${escapeHtml(gst.hotelAddress)} · ${escapeHtml(gst.hotelPhone)}</div>
        ${
          !isFoodBill
            ? `<div style="margin-top:4px;font-size:11px;color:#64748b;">Standard Hotel Timing: Check-In ${escapeHtml(gst.checkInPolicyTime || '12:00 PM')} · Check-Out ${escapeHtml(gst.checkOutPolicyTime || '11:00 AM')}</div>`
            : ''
        }
      </div>
    </div>
  </div>
  ${options?.autoPrint ? '<script>window.addEventListener("load",function(){setTimeout(function(){window.print();},250);});</script>' : ''}
</body>
</html>`;
}

export async function dispatchInvoiceEmailReceipt(
  invoice: Invoice,
  gst: GstSettings,
  theme: InvoiceTheme,
  overrideEmail?: string
): Promise<EmailReceiptLog> {
  const recipientEmail = (overrideEmail || invoice.guestEmail || '').trim();
  const billNo =
    invoice.billNumber ||
    invoice.invoiceNumber.replace(/^(INV|FNB)-/, 'BILL-');
  const subject = `Tax Invoice ${invoice.invoiceNumber} (Bill ${billNo}) — ${gst.hotelTradeName}`;
  const htmlBody = buildThemedEmailHtml(invoice, gst, theme);
  const sentAt = new Date().toISOString();
  const logId = `em-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

  if (!recipientEmail) {
    return {
      id: logId,
      invoiceId: invoice.id,
      billNumber: billNo,
      invoiceNumber: invoice.invoiceNumber,
      recipientEmail: 'No email on guest profile',
      recipientName: invoice.guestName,
      subject,
      amount: invoice.grandTotal,
      status: 'Failed',
      sentAt,
      htmlBody,
      errorMessage: 'Guest profile does not contain an email address.',
    };
  }

  if (isSmtpConfigured()) {
    try {
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT || 587),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });

      await transporter.sendMail({
        from: process.env.SMTP_FROM || gst.hotelEmail || process.env.SMTP_USER,
        to: recipientEmail,
        subject,
        html: htmlBody,
      });

      return {
        id: logId,
        invoiceId: invoice.id,
        billNumber: billNo,
        invoiceNumber: invoice.invoiceNumber,
        recipientEmail,
        recipientName: invoice.guestName,
        subject,
        amount: invoice.grandTotal,
        status: 'Delivered (SMTP)',
        sentAt,
        htmlBody,
      };
    } catch (err) {
      return {
        id: logId,
        invoiceId: invoice.id,
        billNumber: billNo,
        invoiceNumber: invoice.invoiceNumber,
        recipientEmail,
        recipientName: invoice.guestName,
        subject,
        amount: invoice.grandTotal,
        status: 'Failed',
        sentAt,
        htmlBody,
        errorMessage: err instanceof Error ? err.message : 'SMTP delivery error',
      };
    }
  }

  // Local archive dispatch when external SMTP relay is not configured in env
  return {
    id: logId,
    invoiceId: invoice.id,
    billNumber: billNo,
    invoiceNumber: invoice.invoiceNumber,
    recipientEmail,
    recipientName: invoice.guestName,
    subject,
    amount: invoice.grandTotal,
    status: 'Archived Receipt (Local Dispatch)',
    sentAt,
    htmlBody,
  };
}
