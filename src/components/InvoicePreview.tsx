import React, { useEffect, useRef } from 'react';
import { Download, ExternalLink, Mail, MessageSquare, Printer } from 'lucide-react';
import {
  Booking,
  GstSettings,
  Guest,
  Invoice,
  InvoiceTheme,
  InvoiceThemePreset,
} from '../types/hotel';
import {
  amountInIndianWords,
  formatCurrency,
  formatDateTimeDisplay,
  formatStayDateTime,
  formatTemplateDateTime,
} from '../utils/billing';

interface InvoicePreviewProps {
  invoice: Invoice;
  gstSettings: GstSettings;
  theme: InvoiceTheme;
  guests?: Guest[];
  bookings?: Booking[];
  onResendEmail?: () => void;
  sendingEmail?: boolean;
  onSendMobile?: () => void;
  sendingMobile?: boolean;
  onSelectTemplate?: (preset: InvoiceThemePreset) => void;
  autoPrint?: boolean;
  compact?: boolean;
}

const TEMPLATE_OPTIONS: { id: InvoiceThemePreset; label: string }[] = [
  { id: 'shiv_residency_classic', label: 'Shiv Residency Classic (Orange Grid)' },
  { id: 'executive_classic', label: 'Executive Classic' },
  { id: 'modern_minimal', label: 'Modern Minimal' },
  { id: 'boutique_gold', label: 'Boutique Gold' },
  { id: 'corporate_slate', label: 'Corporate Slate' },
  { id: 'royal_heritage', label: 'Royal Heritage' },
];

export const InvoicePreview: React.FC<InvoicePreviewProps> = ({
  invoice,
  gstSettings,
  theme,
  guests,
  bookings,
  onResendEmail,
  sendingEmail,
  onSendMobile,
  sendingMobile,
  onSelectTemplate,
  autoPrint = false,
  compact = false,
}) => {
  const sym = gstSettings.currencySymbol || '₹';
  const isFoodBill = invoice.invoiceType === 'food';
  const billNo =
    invoice.billNumber ||
    invoice.invoiceNumber.replace(/^(INV|FNB)-/, 'BILL-');
  const activePreset = invoice.templatePreset || theme.preset;
  const autoPrintedRef = useRef<string | null>(null);

  const presetAccentOverride =
    activePreset === 'shiv_residency_classic'
      ? theme.accentColor && theme.accentColor !== '#0F172A'
        ? theme.accentColor
        : '#F58220'
      : activePreset === 'royal_heritage' && theme.accentColor === '#0F172A'
        ? '#7F1D1D'
        : activePreset === 'boutique_gold' && theme.accentColor === '#0F172A'
          ? '#78350F'
          : theme.accentColor || '#0F172A';

  const accent = presetAccentOverride;

  const isShivClassic = activePreset === 'shiv_residency_classic';
  const isGold = activePreset === 'boutique_gold';
  const isMinimal = activePreset === 'modern_minimal';
  const isClassic = activePreset === 'executive_classic';
  const isRoyal = activePreset === 'royal_heritage';

  const matchedGuest = guests?.find((g) => g.id === invoice.guestId);
  const matchedBooking = bookings?.find((b) => b.id === invoice.bookingId);
  const resolvedAddress = invoice.guestAddress || matchedGuest?.address || '—';
  const resolvedGuestCount =
    invoice.guestCount ??
    (matchedBooking
      ? Math.max(1, (matchedBooking.adults || 1) + (matchedBooking.children || 0))
      : 1);

  const formatPlain = (n: number) => {
    const safe = Number.isFinite(n) ? n : 0;
    return safe.toFixed(2);
  };

  const uniqueRates = Array.from(
    new Set(invoice.lineItems.map((l) => l.gstRate).filter((r) => r >= 0))
  );
  const singleGstRate = uniqueRates.length === 1 ? uniqueRates[0] : null;
  const halfRateLabel =
    singleGstRate !== null ? ` (${Number((singleGstRate / 2).toFixed(2))}%)` : '';
  const policyLines = (
    theme.termsAndConditions ||
    gstSettings.hotelPolicy ||
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
  const isShivBrand = gstSettings.hotelTradeName.toLowerCase().includes('shiv');

  const handlePrint = () => {
    const sheet = document.getElementById(`invoice-sheet-${invoice.id}`);
    if (!sheet) {
      window.print();
      return;
    }

    try {
      const styleNodes = Array.from(
        document.querySelectorAll('style, link[rel="stylesheet"]')
      )
        .map((node) => node.outerHTML)
        .join('\n');

      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      iframe.setAttribute('aria-hidden', 'true');
      document.body.appendChild(iframe);

      const doc = iframe.contentWindow?.document;
      if (!doc) {
        document.body.removeChild(iframe);
        window.print();
        return;
      }

      doc.open();
      doc.write(`<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${invoice.invoiceNumber}</title>
  ${styleNodes}
  <style>
    @page { size: A4 portrait; margin: 10mm; }
    html, body {
      margin: 0;
      padding: 0;
      background: #ffffff !important;
      width: 210mm;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    .print-only-container {
      width: 100% !important;
      min-height: 274mm !important;
      max-width: 100% !important;
      border-radius: 0 !important;
      box-shadow: none !important;
      display: flex !important;
      flex-direction: column !important;
      justify-content: space-between !important;
    }
  </style>
</head>
<body>${sheet.outerHTML}</body>
</html>`);
      doc.close();

      let printed = false;
      const runPrint = () => {
        if (printed) return;
        printed = true;
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
        } catch {
          window.print();
        }
        setTimeout(() => {
          if (iframe.parentNode) {
            iframe.parentNode.removeChild(iframe);
          }
        }, 1500);
      };

      iframe.onload = () => setTimeout(runPrint, 180);
      setTimeout(runPrint, 450);
    } catch {
      window.print();
    }
  };

  useEffect(() => {
    if (autoPrint && !compact && autoPrintedRef.current !== invoice.id) {
      autoPrintedRef.current = invoice.id;
      const timer = setTimeout(() => {
        handlePrint();
      }, 220);
      return () => clearTimeout(timer);
    }
  }, [autoPrint, compact, invoice.id]);

  const handleDownloadHtml = () => {
    const html = document.getElementById(`invoice-sheet-${invoice.id}`)?.outerHTML;
    if (!html) return;
    const styleNodes = Array.from(
      document.querySelectorAll('style, link[rel="stylesheet"]')
    )
      .map((node) => node.outerHTML)
      .join('\n');
    const doc = `<!doctype html><html><head><meta charset="utf-8"><title>${invoice.invoiceNumber}</title>${styleNodes}<style>@page{size:A4 portrait;margin:10mm;}@media print{body{width:210mm;-webkit-print-color-adjust:exact;print-color-adjust:exact;}}</style></head><body class="p-6 bg-white">${html}</body></html>`;
    const blob = new Blob([doc], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${invoice.invoiceNumber}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {!compact && (
        <div className="no-print flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200">
          <div className="flex flex-wrap items-center gap-3">
            <div className="text-sm text-slate-600">
              A4 Tax Invoice{' '}
              <span className="font-mono font-semibold text-slate-900">
                {invoice.invoiceNumber}
              </span>
              <span className="mx-1.5 text-slate-300">·</span>
              Bill{' '}
              <span className="font-mono font-semibold text-slate-800">
                {billNo}
              </span>
            </div>
            {onSelectTemplate && (
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-slate-500">Theme:</span>
                <select
                  value={activePreset}
                  onChange={(e) =>
                    onSelectTemplate(e.target.value as InvoiceThemePreset)
                  }
                  className="px-2.5 py-1 text-xs font-medium border border-slate-300 rounded-md bg-white text-slate-800"
                >
                  {TEMPLATE_OPTIONS.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {onSendMobile && (
              <button
                type="button"
                onClick={onSendMobile}
                disabled={sendingMobile}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 disabled:opacity-50"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>
                  {sendingMobile ? 'Sending SMS...' : 'Send to Guest Mobile'}
                </span>
              </button>
            )}
            {onResendEmail && (
              <button
                type="button"
                onClick={onResendEmail}
                disabled={sendingEmail}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 disabled:opacity-50"
              >
                <Mail className="w-3.5 h-3.5" />
                <span>{sendingEmail ? 'Sending...' : 'Send Email Receipt'}</span>
              </button>
            )}
            <button
              type="button"
              onClick={handleDownloadHtml}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export HTML</span>
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-slate-900 rounded-md hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print A4 / Save PDF</span>
            </button>
            {invoice.id !== 'preview' && (
              <a
                href={`/api/invoices/${invoice.id}/view?autoprint=1`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
                title="Open standalone A4 print view in a new browser tab"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Print Tab</span>
              </a>
            )}
          </div>
        </div>
      )}

      {/* Full A4 Sheet Container */}
      {isShivClassic ? (
        <div
          id={`invoice-sheet-${invoice.id}`}
          className="print-only-container bg-white border-[1.5px] border-black text-black flex flex-col justify-between font-sans"
        >
          <div>
            {/* Top Orange Strip */}
            <div
              className="flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 border-b border-black text-[11px] font-bold text-black"
              style={{ backgroundColor: accent }}
            >
              <span className="font-mono">
                GSTIN: {gstSettings.hotelGstNumber || 'N/A'}
              </span>
              <span className="text-xs tracking-wide">
                {isFoodBill ? 'Food Tax Invoice' : 'Tax Invoice'}
              </span>
              <span className="tabular-nums">
                Ph. {gstSettings.hotelPhone || '—'}
              </span>
            </div>

            {/* Hotel Header Block */}
            <div className="px-4 py-3 flex items-center justify-between gap-4 border-b border-black bg-white">
              <div className="flex-1 min-w-0">
                <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight text-black uppercase leading-tight">
                  {gstSettings.hotelTradeName}
                </h2>
                <div className="h-[2.5px] bg-black w-full max-w-[380px] my-1.5" />
                <div className="text-[11px] font-semibold text-black leading-snug">
                  {gstSettings.hotelAddress}
                </div>
                <div className="text-[11px] font-semibold text-black mt-0.5">
                  E-mail:- {gstSettings.hotelEmail}
                </div>
              </div>

              <div className="shrink-0 flex flex-col items-center justify-center">
                {isShivBrand ? (
                  <svg
                    viewBox="0 0 180 86"
                    className="w-32 h-16"
                    aria-label={gstSettings.hotelTradeName}
                  >
                    <text
                      x="20"
                      y="20"
                      fill="#DC2626"
                      fontSize="14"
                      fontWeight="800"
                      fontStyle="italic"
                      fontFamily="sans-serif"
                    >
                      hotel
                    </text>
                    <text
                      x="14"
                      y="58"
                      fill="#0284C7"
                      fontSize="48"
                      fontWeight="900"
                      fontStyle="italic"
                      letterSpacing="-2"
                      fontFamily="sans-serif"
                    >
                      shiv
                    </text>
                    <path
                      d="M16 62 Q95 54 160 60"
                      stroke="#0284C7"
                      strokeWidth="2.5"
                      fill="none"
                    />
                    <text
                      x="22"
                      y="78"
                      fill="#F58220"
                      fontSize="16"
                      fontWeight="800"
                      letterSpacing="1"
                      fontFamily="sans-serif"
                    >
                      RESIDENCY
                    </text>
                  </svg>
                ) : (
                  <div
                    className="px-4 py-2.5 border-2 border-black text-center"
                    style={{ backgroundColor: accent }}
                  >
                    <div className="text-lg font-black tracking-wider text-black">
                      {theme.monogram || 'HSR'}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Sub-header No. & Dated */}
            <div className="px-3 pt-2.5 pb-1.5 flex flex-wrap items-baseline justify-between gap-2 text-xs font-bold text-black">
              <div className="tabular-nums">
                Bill No.: <span className="font-mono">{billNo}</span>
              </div>
              <div className="tabular-nums">
                Dated :{' '}
                <span className="border-b border-dotted border-black pb-0.5 font-mono">
                  {formatTemplateDateTime(invoice.issuedAt)}
                </span>
              </div>
            </div>

            {/* Main Bordered Ledger Grid */}
            <div className="mx-3 mb-3 border border-black">
              {/* Guest & Stay Info Grid */}
              <table className="w-full border-collapse text-[11px] text-black">
                <tbody>
                  <tr>
                    <td
                      className="w-28 px-2.5 py-1.5 font-bold border-r border-b border-black align-middle"
                      style={{ backgroundColor: accent }}
                    >
                      Invoice No :
                    </td>
                    <td
                      colSpan={3}
                      className="px-2.5 py-1.5 border-b border-black font-mono font-semibold"
                    >
                      <div className="border-b border-dotted border-black pb-0.5">
                        {invoice.invoiceNumber}
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <td
                      className="px-2.5 py-1.5 font-bold border-r border-b border-black align-middle"
                      style={{ backgroundColor: accent }}
                    >
                      Guest Name:
                    </td>
                    <td
                      colSpan={3}
                      className="px-2.5 py-1.5 border-b border-black font-semibold"
                    >
                      <div className="border-b border-dotted border-black pb-0.5 flex flex-wrap justify-between gap-2">
                        <span>{invoice.guestName}</span>
                        {invoice.guestMobile && invoice.guestMobile !== '—' && (
                          <span className="font-mono text-[10px]">
                            Ph: {invoice.guestMobile}
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <td
                      className="px-2.5 py-1.5 font-bold border-r border-b border-black align-middle"
                      style={{ backgroundColor: accent }}
                    >
                      Address:
                    </td>
                    <td colSpan={3} className="px-2.5 py-1.5 border-b border-black">
                      <div className="border-b border-dotted border-black pb-0.5">
                        {resolvedAddress}
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <td
                      className="px-2.5 py-1.5 font-bold border-r border-b border-black align-middle"
                      style={{ backgroundColor: accent }}
                    >
                      {isFoodBill ? 'Service Type:' : 'Number of Person:'}
                    </td>
                    <td
                      colSpan={3}
                      className="px-2.5 py-1.5 border-b border-black tabular-nums"
                    >
                      <div className="border-b border-dotted border-black pb-0.5">
                        {isFoodBill
                          ? `${invoice.roomType || 'F&B'} · ${invoice.roomNumber}`
                          : resolvedGuestCount}
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <td
                      className="px-2.5 py-1.5 font-bold border-r border-b border-black align-middle"
                      style={{ backgroundColor: accent }}
                    >
                      Company Name:
                    </td>
                    <td colSpan={3} className="px-2.5 py-1.5 border-b border-black">
                      <div className="border-b border-dotted border-black pb-0.5">
                        {invoice.companyName || '—'}
                      </div>
                    </td>
                  </tr>
                  {theme.showCompanyGstBlock && (
                    <tr>
                      <td
                        className="px-2.5 py-1.5 font-bold border-r border-b border-black align-middle"
                        style={{ backgroundColor: accent }}
                      >
                        GSTIN:
                      </td>
                      <td
                        colSpan={3}
                        className="px-2.5 py-1.5 border-b border-black font-mono"
                      >
                        <div className="border-b border-dotted border-black pb-0.5">
                          {invoice.companyGst || '—'}
                        </div>
                      </td>
                    </tr>
                  )}
                  <tr>
                    <td
                      className="px-2.5 py-1.5 font-bold border-r border-b border-black align-middle"
                      style={{ backgroundColor: accent }}
                    >
                      {isFoodBill ? 'Order Date:' : 'Check In:'}
                    </td>
                    <td className="px-2.5 py-1.5 border-r border-b border-black tabular-nums">
                      <div className="border-b border-dotted border-black pb-0.5">
                        {formatTemplateDateTime(
                          invoice.checkInDate,
                          invoice.checkInTime
                        )}
                      </div>
                    </td>
                    <td
                      className="w-28 px-2.5 py-1.5 font-bold border-r border-b border-black align-middle"
                      style={{ backgroundColor: accent }}
                    >
                      {isFoodBill ? 'Bill Type:' : 'Check Out:'}
                    </td>
                    <td className="px-2.5 py-1.5 border-b border-black tabular-nums">
                      <div className="border-b border-dotted border-black pb-0.5">
                        {isFoodBill
                          ? invoice.serviceLabel || 'Restaurant / F&B'
                          : formatTemplateDateTime(
                              invoice.checkOutDate,
                              invoice.checkOutTime
                            )}
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* Line Items & Tax Summary Table */}
              <table className="w-full border-collapse text-[11px] text-black">
                <thead>
                  <tr
                    className="font-bold text-black"
                    style={{ backgroundColor: accent }}
                  >
                    <th className="px-2 py-1.5 border-r border-b border-black text-center w-10">
                      S.No.
                    </th>
                    <th className="px-2 py-1.5 border-r border-b border-black text-center w-16">
                      HSN/SAC
                    </th>
                    <th className="px-2 py-1.5 border-r border-b border-black text-left">
                      {isFoodBill ? 'Item Description' : 'Room No.'}
                    </th>
                    <th className="px-2 py-1.5 border-r border-b border-black text-center w-16">
                      {isFoodBill ? 'Qty' : 'No. Of Days'}
                    </th>
                    <th className="px-2 py-1.5 border-r border-b border-black text-right w-20">
                      {isFoodBill ? 'Rate' : 'Room Rent'}
                    </th>
                    <th className="px-2 py-1.5 border-r border-b border-black text-right w-24">
                      {isFoodBill ? 'Other Charges' : 'Extra Bed Charges'}
                    </th>
                    <th className="px-2 py-1.5 border-r border-b border-black text-right w-14">
                      GST %
                    </th>
                    <th className="px-2 py-1.5 border-b border-black text-right w-24">
                      Amount ({sym})
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {invoice.lineItems.map((line, idx) => {
                    const isFirstRoomRow = !isFoodBill && idx === 0;
                    return (
                      <tr key={idx}>
                        <td className="px-2 py-1.5 border-r border-b border-black text-center tabular-nums">
                          {idx + 1}
                        </td>
                        <td className="px-2 py-1.5 border-r border-b border-black text-center font-mono">
                          {theme.showSacCodes ? line.sac : '—'}
                        </td>
                        <td className="px-2 py-1.5 border-r border-b border-black">
                          {isFirstRoomRow
                            ? `(Room No. : ${invoice.roomNumber})`
                            : line.description}
                        </td>
                        <td className="px-2 py-1.5 border-r border-b border-black text-center tabular-nums">
                          {line.qty}
                        </td>
                        <td className="px-2 py-1.5 border-r border-b border-black text-right font-mono tabular-nums">
                          {formatPlain(line.rate)}
                        </td>
                        <td className="px-2 py-1.5 border-r border-b border-black text-right font-mono tabular-nums">
                          0.00
                        </td>
                        <td className="px-2 py-1.5 border-r border-b border-black text-right font-mono tabular-nums">
                          {formatPlain(line.gstRate)}%
                        </td>
                        <td className="px-2 py-1.5 border-b border-black text-right font-mono tabular-nums">
                          {formatPlain(line.taxable)}
                        </td>
                      </tr>
                    );
                  })}

                  {/* Totals & Tax Breakdown */}
                  {invoice.discountAmount > 0 && (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-2.5 py-1.5 border-r border-b border-black font-semibold"
                      >
                        Discount Applied
                      </td>
                      <td className="px-2 py-1.5 border-b border-black text-right font-mono tabular-nums">
                        -{formatPlain(invoice.discountAmount)}
                      </td>
                    </tr>
                  )}
                  <tr>
                    <td
                      colSpan={7}
                      className="px-2.5 py-1.5 border-r border-b border-black font-bold"
                    >
                      Total
                    </td>
                    <td className="px-2 py-1.5 border-b border-black text-right font-mono tabular-nums">
                      {formatPlain(invoice.taxableTotal)}
                    </td>
                  </tr>
                  {theme.showGstBreakdown && invoice.taxRegime === 'IGST' ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-2.5 py-1.5 border-r border-b border-black font-bold"
                      >
                        IGST{singleGstRate !== null ? ` (${singleGstRate}%)` : ''}
                      </td>
                      <td className="px-2 py-1.5 border-b border-black text-right font-mono tabular-nums">
                        {formatPlain(invoice.igstAmount)}
                      </td>
                    </tr>
                  ) : (
                    theme.showGstBreakdown && (
                      <>
                        <tr>
                          <td
                            colSpan={7}
                            className="px-2.5 py-1.5 border-r border-b border-black font-bold"
                          >
                            SGST{halfRateLabel}
                          </td>
                          <td className="px-2 py-1.5 border-b border-black text-right font-mono tabular-nums">
                            {formatPlain(invoice.sgstAmount)}
                          </td>
                        </tr>
                        <tr>
                          <td
                            colSpan={7}
                            className="px-2.5 py-1.5 border-r border-b border-black font-bold"
                          >
                            CGST{halfRateLabel}
                          </td>
                          <td className="px-2 py-1.5 border-b border-black text-right font-mono tabular-nums">
                            {formatPlain(invoice.cgstAmount)}
                          </td>
                        </tr>
                      </>
                    )
                  )}
                  <tr>
                    <td
                      colSpan={7}
                      className="px-2.5 py-1.5 border-r border-b border-black font-bold"
                    >
                      Total GST
                    </td>
                    <td className="px-2 py-1.5 border-b border-black text-right font-mono tabular-nums">
                      {formatPlain(invoice.totalGst)}
                    </td>
                  </tr>
                  <tr>
                    <td
                      colSpan={7}
                      className="px-2.5 py-2 border-r border-b border-black font-extrabold text-xs"
                    >
                      Grand Total
                    </td>
                    <td className="px-2 py-2 border-b border-black text-right font-mono font-extrabold text-xs tabular-nums">
                      {formatPlain(invoice.grandTotal)}
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* Amount in Words & Payment Method */}
              <table className="w-full border-collapse text-[11px] text-black">
                <tbody>
                  <tr>
                    <td className="w-32 px-2.5 py-2 font-bold border-r border-b border-black align-middle">
                      Amount in Words:-
                    </td>
                    <td className="px-2.5 py-2 border-b border-black font-bold">
                      {amountInIndianWords(invoice.grandTotal)}
                    </td>
                  </tr>
                  <tr>
                    <td className="px-2.5 py-2 font-bold border-r border-b border-black align-middle">
                      Payment Method:-
                    </td>
                    <td className="px-2.5 py-2 border-b border-black font-bold">
                      <span>{invoice.paymentMethod}</span>
                      {invoice.paymentReference && (
                        <span className="font-mono font-normal ml-2">
                          (Ref: {invoice.paymentReference})
                        </span>
                      )}
                      {theme.showPaymentSummary && invoice.advancePaid > 0 && (
                        <span className="font-normal ml-2 tabular-nums">
                          · Advance: {formatCurrency(invoice.advancePaid, sym)} · Net Paid:{' '}
                          {formatCurrency(invoice.netPaid, sym)}
                        </span>
                      )}
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* Signatures Block */}
              <div className="grid grid-cols-2 border-b border-black text-[11px] font-bold text-black">
                <div className="border-r border-black px-6 pt-12 pb-2.5 flex flex-col items-center justify-end">
                  <div className="w-full border-t border-black pt-1 text-center">
                    Guest&apos;s Sign
                  </div>
                </div>
                <div className="px-6 pt-12 pb-2.5 flex flex-col items-center justify-end">
                  <div className="w-full border-t border-black pt-1 text-center">
                    {theme.signatoryTitle || "Cashier's Sign"}
                  </div>
                </div>
              </div>

              {/* Terms and Conditions */}
              <table className="w-full border-collapse text-[11px] text-black">
                <tbody>
                  <tr>
                    <td className="w-32 px-2.5 py-2.5 font-bold border-r border-b border-black align-top">
                      Terms and Conditions
                    </td>
                    <td className="px-2.5 py-2.5 border-b border-black font-bold leading-snug space-y-0.5">
                      {policyLines.map((line, i) => (
                        <div key={i}>{line}</div>
                      ))}
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* Bottom Orange Footer Banner */}
              <div
                className="px-4 py-2.5 text-center font-bold text-xs text-black space-y-0.5"
                style={{ backgroundColor: accent }}
              >
                {footerLines.map((line, i) => (
                  <div key={i}>{line}</div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : (
      <div
        id={`invoice-sheet-${invoice.id}`}
        className={`print-only-container border rounded-lg overflow-hidden flex flex-col justify-between ${
          isGold
            ? 'bg-[#FFFDF8] border-amber-200'
            : isRoyal
              ? 'bg-[#FFFAFA] border-rose-200'
              : 'bg-white border-slate-200'
        }`}
      >
        {/* Top Accent Ribbon + Header */}
        <div>
          <div className="h-2 w-full" style={{ backgroundColor: accent }} />
          <div
            className={`px-8 py-7 ${
              isMinimal
                ? 'bg-white border-b border-slate-200 text-slate-900'
                : 'text-white'
            }`}
            style={!isMinimal ? { backgroundColor: accent } : undefined}
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-center gap-4">
                <div
                  className={`w-14 h-14 rounded-lg flex items-center justify-center font-mono text-base font-bold tracking-wider shrink-0 ${
                    isMinimal
                      ? 'text-white'
                      : 'bg-white/15 text-white border border-white/30'
                  }`}
                  style={isMinimal ? { backgroundColor: accent } : undefined}
                >
                  {theme.monogram || 'HSR'}
                </div>
                <div>
                  <div
                    className={`text-[10px] uppercase tracking-[0.2em] font-semibold ${
                      isMinimal ? 'text-slate-500' : 'text-white/75'
                    }`}
                  >
                    {isFoodBill ? 'Restaurant & F&B Tax Invoice' : 'Official Tax Invoice'}
                  </div>
                  <h2
                    className={`text-2xl font-bold tracking-tight mt-0.5 ${
                      isClassic || isGold || isRoyal
                        ? 'font-editorial'
                        : 'font-display'
                    }`}
                  >
                    {gstSettings.hotelTradeName}
                  </h2>
                  <p
                    className={`text-xs mt-1 ${
                      isMinimal ? 'text-slate-500' : 'text-white/80'
                    }`}
                  >
                    {theme.headerTagline}
                  </p>
                </div>
              </div>

              <div
                className={`px-4 py-3 rounded-md text-right ${
                  isMinimal
                    ? 'bg-slate-50 border border-slate-200'
                    : 'bg-white/10 border border-white/20'
                }`}
              >
                <div
                  className={`text-[10px] uppercase tracking-widest font-semibold ${
                    isMinimal ? 'text-slate-500' : 'text-white/75'
                  }`}
                >
                  Invoice Number
                </div>
                <div className="font-mono text-lg font-bold mt-0.5 tabular-nums">
                  {invoice.invoiceNumber}
                </div>
                <div
                  className={`text-xs font-mono mt-0.5 tabular-nums ${
                    isMinimal ? 'text-slate-700' : 'text-white/90'
                  }`}
                >
                  Bill No: {billNo}
                </div>
                <div
                  className={`text-xs mt-0.5 tabular-nums ${
                    isMinimal ? 'text-slate-600' : 'text-white/85'
                  }`}
                >
                  Issued: {formatDateTimeDisplay(invoice.issuedAt)}
                </div>
              </div>
            </div>
          </div>

          {/* Main Content Section */}
          <div className="px-8 py-6 space-y-6">
            {/* Billed To & Stay Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="p-4 rounded-md bg-slate-50/80 border border-slate-200 space-y-1">
                <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  Billed To Guest / Corporate
                </div>
                <div className="text-sm font-bold text-slate-900 pt-0.5">
                  {invoice.guestName}
                </div>
                <div className="text-slate-600 font-mono tabular-nums">
                  Mobile: {invoice.guestMobile}
                </div>
                {invoice.guestEmail && (
                  <div className="text-slate-600">{invoice.guestEmail}</div>
                )}
                {invoice.companyName && (
                  <div className="pt-1.5 font-semibold text-slate-800">
                    {invoice.companyName}
                  </div>
                )}
                {theme.showCompanyGstBlock && invoice.companyGst && (
                  <div className="font-mono text-slate-700">
                    Recipient GSTIN: {invoice.companyGst}
                  </div>
                )}
              </div>

              <div className="p-4 rounded-md bg-slate-50/80 border border-slate-200 space-y-1 sm:text-right">
                <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  {isFoodBill ? 'Supplier & F&B Order Details' : 'Supplier & Stay Folio Details'}
                </div>
                <div className="text-sm font-bold text-slate-900 pt-0.5">
                  {gstSettings.hotelLegalName}
                </div>
                <div className="font-mono text-slate-700">
                  Supplier GSTIN: {gstSettings.hotelGstNumber || 'N/A'}
                </div>
                {isFoodBill ? (
                  <>
                    <div className="text-slate-700 font-medium pt-1">
                      {invoice.roomType || 'Restaurant / F&B'} · {invoice.roomNumber}
                    </div>
                    <div className="text-slate-600 tabular-nums">
                      Order Time: {formatStayDateTime(invoice.checkInDate, invoice.checkInTime)}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="text-slate-700 font-medium pt-1">
                      Room {invoice.roomNumber} · {invoice.roomType} · {invoice.nights} Night
                      {invoice.nights > 1 ? 's' : ''}
                    </div>
                    <div className="text-slate-600 tabular-nums">
                      Check-In: {formatStayDateTime(invoice.checkInDate, invoice.checkInTime)}
                    </div>
                    <div className="text-slate-600 tabular-nums">
                      Check-Out: {formatStayDateTime(invoice.checkOutDate, invoice.checkOutTime)}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Line Items Table */}
            <div className="overflow-x-auto border border-slate-200 rounded-md">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr
                    className="text-[10px] uppercase tracking-wider text-white"
                    style={{ backgroundColor: accent }}
                  >
                    <th className="py-3 px-3.5 font-semibold">Particulars / Service</th>
                    {theme.showSacCodes && (
                      <th className="py-3 px-2.5 font-semibold">SAC</th>
                    )}
                    <th className="py-3 px-2.5 text-right font-semibold">Qty</th>
                    <th className="py-3 px-2.5 text-right font-semibold">Rate</th>
                    <th className="py-3 px-2.5 text-right font-semibold">Taxable</th>
                    <th className="py-3 px-2.5 text-right font-semibold">GST</th>
                    <th className="py-3 px-3.5 text-right font-semibold">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-xs">
                  {invoice.lineItems.map((line, idx) => (
                    <tr
                      key={idx}
                      className={idx % 2 === 1 ? 'bg-slate-50/60' : 'bg-white'}
                    >
                      <td className="py-3 px-3.5 font-medium text-slate-900">
                        {line.description}
                      </td>
                      {theme.showSacCodes && (
                        <td className="py-3 px-2.5 font-mono text-slate-500">
                          {line.sac}
                        </td>
                      )}
                      <td className="py-3 px-2.5 text-right tabular-nums text-slate-700">
                        {line.qty}
                      </td>
                      <td className="py-3 px-2.5 text-right font-mono tabular-nums text-slate-700">
                        {formatCurrency(line.rate, sym)}
                      </td>
                      <td className="py-3 px-2.5 text-right font-mono tabular-nums text-slate-700">
                        {formatCurrency(line.taxable, sym)}
                      </td>
                      <td className="py-3 px-2.5 text-right font-mono tabular-nums text-slate-600">
                        {line.gstRate}% ({formatCurrency(line.gstAmount, sym)})
                      </td>
                      <td className="py-3 px-3.5 text-right font-mono font-semibold tabular-nums text-slate-900">
                        {formatCurrency(line.total, sym)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Anchored Bottom Section for Balanced Full A4 Print */}
        <div className="px-8 pb-7 pt-4 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4 border-t border-slate-200">
            <div className="text-xs space-y-3">
              {theme.showPaymentSummary && (
                <div className="p-4 rounded-md bg-slate-50 border border-slate-200 space-y-1.5">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                    Payment Settlement Summary
                  </div>
                  <div className="flex justify-between text-slate-700">
                    <span>Payment Mode</span>
                    <span className="font-semibold text-slate-900">
                      {invoice.paymentMethod}
                    </span>
                  </div>
                  {invoice.paymentReference && (
                    <div className="flex justify-between text-slate-700">
                      <span>Transaction Ref</span>
                      <span className="font-mono text-slate-900">
                        {invoice.paymentReference}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between text-slate-700 tabular-nums">
                    <span>Advance Adjusted</span>
                    <span className="font-mono">
                      {formatCurrency(invoice.advancePaid, sym)}
                    </span>
                  </div>
                  <div className="flex justify-between font-bold text-slate-900 pt-1.5 border-t border-slate-200 tabular-nums">
                    <span>Net Balance Settled</span>
                    <span className="font-mono">
                      {formatCurrency(invoice.netPaid, sym)}
                    </span>
                  </div>
                </div>
              )}
              {theme.termsAndConditions && (
                <div className="space-y-1">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Terms & Tax Declaration
                  </div>
                  <p className="text-[11px] leading-relaxed text-slate-500">
                    {theme.termsAndConditions}
                  </p>
                </div>
              )}
            </div>

            <div className="flex flex-col justify-between space-y-4 text-xs">
              <div className="p-4 rounded-md border border-slate-200 space-y-2">
                {invoice.discountAmount > 0 && (
                  <div className="flex justify-between text-emerald-700 tabular-nums">
                    <span>Discount Applied</span>
                    <span className="font-mono">
                      -{formatCurrency(invoice.discountAmount, sym)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-slate-600 tabular-nums">
                  <span>Total Taxable Value</span>
                  <span className="font-mono font-semibold text-slate-900">
                    {formatCurrency(invoice.taxableTotal, sym)}
                  </span>
                </div>
                {theme.showGstBreakdown ? (
                  invoice.taxRegime === 'IGST' ? (
                    <div className="flex justify-between text-slate-600 tabular-nums">
                      <span>IGST Total</span>
                      <span className="font-mono">
                        {formatCurrency(invoice.igstAmount, sym)}
                      </span>
                    </div>
                  ) : (
                    <>
                      <div className="flex justify-between text-slate-600 tabular-nums">
                        <span>CGST (50%)</span>
                        <span className="font-mono">
                          {formatCurrency(invoice.cgstAmount, sym)}
                        </span>
                      </div>
                      <div className="flex justify-between text-slate-600 tabular-nums">
                        <span>SGST (50%)</span>
                        <span className="font-mono">
                          {formatCurrency(invoice.sgstAmount, sym)}
                        </span>
                      </div>
                    </>
                  )
                ) : (
                  <div className="flex justify-between text-slate-600 tabular-nums">
                    <span>Total GST</span>
                    <span className="font-mono">
                      {formatCurrency(invoice.totalGst, sym)}
                    </span>
                  </div>
                )}

                <div
                  className="flex justify-between items-baseline pt-3 mt-2 border-t-2 text-sm font-bold tabular-nums"
                  style={{ borderColor: accent, color: accent }}
                >
                  <span>Grand Total</span>
                  <span className="font-mono text-lg">
                    {formatCurrency(invoice.grandTotal, sym)}
                  </span>
                </div>
              </div>

              <div className="pt-8 text-right">
                <div className="inline-block min-w-[200px] border-t border-slate-400 pt-1.5 text-[11px] font-medium text-slate-600">
                  {theme.signatoryTitle}
                  <span className="block text-[10px] text-slate-400 font-normal">
                    For {gstSettings.hotelTradeName}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-200 text-center space-y-1">
            <div className="text-xs font-semibold text-slate-800">
              {theme.footerNote}
            </div>
            <div className="text-[11px] text-slate-500">
              {gstSettings.hotelAddress} · {gstSettings.hotelPhone} ·{' '}
              {gstSettings.hotelEmail}
            </div>
            {!isFoodBill && (
              <div className="text-[11px] text-slate-500 tabular-nums">
                Standard Hotel Timing: Check-In {gstSettings.checkInPolicyTime || '12:00 PM'} · Check-Out{' '}
                {gstSettings.checkOutPolicyTime || '10:00 AM'}
              </div>
            )}
          </div>
        </div>
      </div>
      )}
    </div>
  );
};
