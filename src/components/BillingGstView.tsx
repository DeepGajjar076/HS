import React, { useMemo, useState } from 'react';
import {
  Check,
  Copy,
  ExternalLink,
  Eye,
  FileText,
  Mail,
  MessageSquare,
  Palette,
  Percent,
  Printer,
  Search,
  Send,
  X,
} from 'lucide-react';
import {
  EmailReceiptLog,
  GstSettings,
  Invoice,
  InvoiceTheme,
  InvoiceThemePreset,
  MobileInvoiceLog,
} from '../types/hotel';
import { formatCurrency, formatDateTimeDisplay, formatStayDateTime } from '../utils/billing';
import { InvoicePreview } from './InvoicePreview';
import { StatusBadge } from './StatusBadge';

interface BillingGstViewProps {
  invoices: Invoice[];
  emailLogs: EmailReceiptLog[];
  mobileLogs: MobileInvoiceLog[];
  gstSettings: GstSettings;
  invoiceTheme: InvoiceTheme;
  smtpConfigured: boolean;
  smsConfigured: boolean;
  onUpdateGstSettings: (payload: Partial<GstSettings>) => Promise<GstSettings>;
  onUpdateInvoiceTheme: (payload: Partial<InvoiceTheme>) => Promise<InvoiceTheme>;
  onViewInvoice: (invoice: Invoice, autoPrint?: boolean) => void;
  onSendInvoiceEmail: (invoiceId: string, recipientEmail?: string) => Promise<void>;
  onSendInvoiceMobile: (
    invoiceId: string,
    recipientMobile?: string,
    channel?: 'SMS' | 'WhatsApp'
  ) => Promise<void>;
}

const THEME_PRESETS: { id: InvoiceThemePreset; label: string; desc: string }[] = [
  { id: 'shiv_residency_classic', label: 'Shiv Residency Classic', desc: 'Orange & black GST tax grid with signatures & terms' },
  { id: 'executive_classic', label: 'Executive Classic', desc: 'Editorial serif header & crisp borders' },
  { id: 'modern_minimal', label: 'Modern Minimal', desc: 'Clean white header with sharp rules' },
  { id: 'boutique_gold', label: 'Boutique Gold', desc: 'Warm ivory paper & champagne trim' },
  { id: 'corporate_slate', label: 'Corporate Slate', desc: 'High-contrast enterprise slate block' },
  { id: 'royal_heritage', label: 'Royal Heritage', desc: 'Regal burgundy header & warm tint' },
];

const ACCENT_SWATCHES = [
  { label: 'Shiv Saffron Orange', hex: '#F58220' },
  { label: 'Midnight Slate', hex: '#0F172A' },
  { label: 'Royal Sapphire', hex: '#1D4ED8' },
  { label: 'Forest Emerald', hex: '#065F46' },
  { label: 'Warm Bronze', hex: '#78350F' },
  { label: 'Royal Burgundy', hex: '#7F1D1D' },
];

export const BillingGstView: React.FC<BillingGstViewProps> = ({
  invoices,
  emailLogs,
  mobileLogs,
  gstSettings,
  invoiceTheme,
  smtpConfigured,
  smsConfigured,
  onUpdateGstSettings,
  onUpdateInvoiceTheme,
  onViewInvoice,
  onSendInvoiceEmail,
  onSendInvoiceMobile,
}) => {
  const [subTab, setSubTab] = useState<
    'invoices' | 'mobile' | 'emails' | 'gst' | 'theme'
  >('invoices');
  const [search, setSearch] = useState('');
  const [gstForm, setGstForm] = useState<GstSettings>(gstSettings);
  const [themeForm, setThemeForm] = useState<InvoiceTheme>(invoiceTheme);
  const [savingGst, setSavingGst] = useState(false);
  const [savingTheme, setSavingTheme] = useState(false);
  const [savedNotice, setSavedNotice] = useState('');
  const [previewEmailLog, setPreviewEmailLog] = useState<EmailReceiptLog | null>(null);
  const [previewMobileLog, setPreviewMobileLog] = useState<MobileInvoiceLog | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [customEmailTarget, setCustomEmailTarget] = useState<{
    invoiceId: string;
    email: string;
  } | null>(null);
  const [customMobileTarget, setCustomMobileTarget] = useState<{
    invoiceId: string;
    mobile: string;
    channel: 'SMS' | 'WhatsApp';
  } | null>(null);
  const [sendingId, setSendingId] = useState<string | null>(null);

  const sym = gstSettings.currencySymbol || '₹';

  const totals = useMemo(() => {
    const billed = invoices.reduce((s, i) => s + i.grandTotal, 0);
    const gstTotal = invoices.reduce((s, i) => s + i.totalGst, 0);
    const taxable = invoices.reduce((s, i) => s + i.taxableTotal, 0);
    return { billed, gstTotal, taxable };
  }, [invoices]);

  const filteredInvoices = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return invoices;
    return invoices.filter((inv) =>
      [
        inv.billNumber || '',
        inv.invoiceNumber,
        inv.guestName,
        inv.guestMobile,
        inv.companyName,
        inv.companyGst,
        inv.roomNumber,
      ]
        .join(' ')
        .toLowerCase()
        .includes(q)
    );
  }, [invoices, search]);

  const handleSaveGst = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingGst(true);
    try {
      await onUpdateGstSettings(gstForm);
      setSavedNotice('GST & Billing Controls saved');
      setTimeout(() => setSavedNotice(''), 3000);
    } finally {
      setSavingGst(false);
    }
  };

  const handleSaveTheme = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingTheme(true);
    try {
      await onUpdateInvoiceTheme(themeForm);
      setSavedNotice('Custom Invoice Theme saved');
      setTimeout(() => setSavedNotice(''), 3000);
    } finally {
      setSavingTheme(false);
    }
  };

  const buildWhatsAppShareUrl = (mobile: string, text: string) => {
    const digits = mobile.replace(/\D/g, '');
    const full = digits.length === 10 ? `91${digits}` : digits;
    return `https://wa.me/${full}?text=${encodeURIComponent(text)}`;
  };

  const handleCopyMessage = async (log: MobileInvoiceLog) => {
    try {
      await navigator.clipboard.writeText(log.messageText);
      setCopiedId(log.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // ignore clipboard permissions error
    }
  };

  const samplePreviewInvoice: Invoice = invoices[0] || {
    id: 'preview',
    billNumber: 'BILL-2026-PREVIEW',
    invoiceNumber: 'INV-2026-PREVIEW',
    bookingId: 'bk-preview',
    guestId: 'gst-preview',
    guestName: 'Raghavendra Kulkarni',
    guestMobile: '9820451290',
    guestEmail: 'raghav@kulkarnilogistics.in',
    guestAddress: 'Baner Road, Pune, Maharashtra',
    guestCount: 1,
    companyName: 'Kulkarni Precision Logistics Pvt Ltd',
    companyGst: '27AABCK4821M1Z5',
    roomNumber: '201',
    roomType: 'Deluxe Room',
    checkInDate: new Date().toISOString(),
    checkInTime: '14:00',
    checkOutDate: new Date().toISOString(),
    checkOutTime: '10:00',
    nights: 2,
    roomSubtotal: 10400,
    roomGstRate: 12,
    roomGstAmount: 1248,
    foodSubtotal: 620,
    foodGstAmount: 31,
    extraChargesSubtotal: 0,
    serviceChargeAmount: 0,
    discountAmount: 0,
    taxableTotal: 11020,
    taxRegime: gstForm.taxRegime,
    cgstAmount: gstForm.taxRegime === 'IGST' ? 0 : 639.5,
    sgstAmount: gstForm.taxRegime === 'IGST' ? 0 : 639.5,
    igstAmount: gstForm.taxRegime === 'IGST' ? 1279 : 0,
    totalGst: 1279,
    grandTotal: 12299,
    advancePaid: 5000,
    netPaid: 7299,
    paymentMethod: 'UPI',
    paymentReference: 'UPI-99412038',
    issuedAt: new Date().toISOString(),
    templatePreset: themeForm.preset,
    emailStatus: 'Archived',
    mobileStatus: 'Archived',
    lineItems: [
      {
        description: 'Room 201 (Deluxe Room) — 2 Nights',
        sac: gstForm.roomSacCode,
        qty: 2,
        rate: 5200,
        taxable: 10400,
        gstRate: 12,
        gstAmount: 1248,
        total: 11648,
      },
      {
        description: 'F&B: Paneer Tikka Makhani & Garlic Naan',
        sac: gstForm.foodSacCode,
        qty: 1,
        rate: 620,
        taxable: 620,
        gstRate: 5,
        gstAmount: 31,
        total: 651,
      },
    ],
  };

  return (
    <div className="space-y-5">
      {/* Sub-navigation & Save Notice */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg overflow-x-auto">
          <button
            type="button"
            onClick={() => setSubTab('invoices')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
              subTab === 'invoices'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Tax Invoices ({invoices.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setSubTab('mobile')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
              subTab === 'mobile'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Mobile Invoices ({mobileLogs.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setSubTab('emails')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
              subTab === 'emails'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Mail className="w-3.5 h-3.5" />
            <span>Email Receipts ({emailLogs.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setSubTab('gst')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
              subTab === 'gst'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Percent className="w-3.5 h-3.5" />
            <span>GST Control Center</span>
          </button>
          <button
            type="button"
            onClick={() => setSubTab('theme')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
              subTab === 'theme'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Palette className="w-3.5 h-3.5" />
            <span>Custom Invoice Theme</span>
          </button>
        </div>

        {savedNotice && (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700">
            <Check className="w-3.5 h-3.5" />
            <span>{savedNotice}</span>
          </span>
        )}
      </div>

      {/* TAB 1: TAX INVOICES */}
      {subTab === 'invoices' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-white border border-slate-200 rounded-lg p-4">
              <div className="text-xs text-slate-500">Total Taxable Revenue</div>
              <div className="mt-1 text-xl font-bold font-mono text-slate-900 tabular-nums">
                {formatCurrency(totals.taxable, sym)}
              </div>
            </div>
            <div className="bg-white border border-slate-200 rounded-lg p-4">
              <div className="text-xs text-slate-500">Total GST Collected</div>
              <div className="mt-1 text-xl font-bold font-mono text-slate-900 tabular-nums">
                {formatCurrency(totals.gstTotal, sym)}
              </div>
            </div>
            <div className="bg-white border border-slate-200 rounded-lg p-4">
              <div className="text-xs text-slate-500">Grand Total Billed</div>
              <div className="mt-1 text-xl font-bold font-mono text-slate-900 tabular-nums">
                {formatCurrency(totals.billed, sym)}
              </div>
            </div>
          </div>

          <div className="relative max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search bill #, invoice #, guest name, mobile, or GSTIN..."
              className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-slate-300 rounded-md"
            />
          </div>

          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] uppercase tracking-wider text-slate-500">
                    <th className="py-3 px-4 font-semibold">Bill # / Invoice #</th>
                    <th className="py-3 px-4 font-semibold">Guest & Mobile</th>
                    <th className="py-3 px-4 font-semibold">Stay / Service</th>
                    <th className="py-3 px-4 font-semibold text-right">Taxable</th>
                    <th className="py-3 px-4 font-semibold text-right">GST</th>
                    <th className="py-3 px-4 font-semibold text-right">Grand Total</th>
                    <th className="py-3 px-4 font-semibold">Mobile / Email</th>
                    <th className="py-3 px-4 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {filteredInvoices.map((inv) => {
                    const isFood =
                      inv.invoiceType === 'food' ||
                      inv.invoiceNumber.startsWith('FNB-');
                    return (
                    <tr key={inv.id} className="hover:bg-slate-50/70">
                      <td className="py-3 px-4">
                        <div className="font-mono font-semibold text-slate-900">
                          {inv.invoiceNumber}
                        </div>
                        {inv.billNumber && (
                          <div className="text-[11px] font-mono text-slate-600">
                            Bill: {inv.billNumber}
                          </div>
                        )}
                        <div className="text-[11px] text-slate-500 tabular-nums">
                          {formatDateTimeDisplay(inv.issuedAt)}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900">
                          {inv.guestName}
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono tabular-nums">
                          {inv.guestMobile}
                          {inv.companyName ? ` · ${inv.companyName}` : ''}
                        </div>
                      </td>
                      <td className="py-3 px-4 tabular-nums">
                        {isFood ? (
                          <>
                            <div className="font-mono text-slate-800">
                              {inv.roomType} · {inv.roomNumber}
                            </div>
                            <div className="text-[11px] text-slate-500">
                              Order {formatStayDateTime(inv.checkInDate, inv.checkInTime)}
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="font-mono text-slate-800">
                              Room {inv.roomNumber} ({inv.nights}n)
                            </div>
                            <div className="text-[11px] text-slate-500">
                              In {formatStayDateTime(inv.checkInDate, inv.checkInTime)}
                            </div>
                            <div className="text-[11px] text-slate-500">
                              Out {formatStayDateTime(inv.checkOutDate, inv.checkOutTime)}
                            </div>
                          </>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-700">
                        {formatCurrency(inv.taxableTotal, sym)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-700">
                        {formatCurrency(inv.totalGst, sym)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-semibold tabular-nums text-slate-900">
                        {formatCurrency(inv.grandTotal, sym)}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex flex-col gap-1 items-start">
                          <StatusBadge status={inv.mobileStatus || 'Archived'} />
                          <StatusBadge status={inv.emailStatus} />
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => onViewInvoice(inv)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-50 whitespace-nowrap"
                          >
                            <FileText className="w-3 h-3" />
                            <span>View</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => onViewInvoice(inv, true)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-50 whitespace-nowrap"
                            title="Print A4 Invoice"
                          >
                            <Printer className="w-3 h-3" />
                            <span>Print</span>
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setCustomMobileTarget({
                                invoiceId: inv.id,
                                mobile: inv.guestMobile || '',
                                channel:
                                  gstSettings.mobileDispatchChannel === 'WhatsApp'
                                    ? 'WhatsApp'
                                    : 'SMS',
                              })
                            }
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-white bg-slate-900 rounded hover:bg-slate-800 whitespace-nowrap"
                          >
                            <MessageSquare className="w-3 h-3" />
                            <span>Mobile</span>
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setCustomEmailTarget({
                                invoiceId: inv.id,
                                email: inv.guestEmail || '',
                              })
                            }
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-50 whitespace-nowrap"
                            title="Send Email Receipt"
                          >
                            <Mail className="w-3 h-3" />
                          </button>
                        </div>
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: AUTOMATED MOBILE INVOICES (SMS & WHATSAPP) */}
      {subTab === 'mobile' && (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-lg p-4 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="space-y-0.5">
              <div className="font-semibold text-slate-900">
                Automated Guest Mobile Number Invoice System (SMS & WhatsApp)
              </div>
              <p className="text-slate-500">
                Automatically dispatches itemized GST tax summary & shareable A4 invoice
                link to the guest&apos;s mobile number on every checkout.
                {smsConfigured
                  ? ' External SMS/WhatsApp Gateway is active.'
                  : ' No external Twilio/SMS webhook configured — receipts are archived and ready for instant WhatsApp share or SMS copy.'}
              </p>
            </div>
            <StatusBadge
              status={
                smsConfigured
                  ? 'Delivered (Gateway)'
                  : 'Archived Dispatch (Ready)'
              }
            />
          </div>

          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] uppercase tracking-wider text-slate-500">
                    <th className="py-3 px-4 font-semibold">Timestamp</th>
                    <th className="py-3 px-4 font-semibold">Guest & Mobile</th>
                    <th className="py-3 px-4 font-semibold">Channel / Invoice #</th>
                    <th className="py-3 px-4 font-semibold text-right">Amount</th>
                    <th className="py-3 px-4 font-semibold">Status</th>
                    <th className="py-3 px-4 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {mobileLogs.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-10 text-center text-slate-500">
                        No mobile invoice dispatches yet.
                      </td>
                    </tr>
                  )}
                  {mobileLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/70">
                      <td className="py-3 px-4 text-slate-600 tabular-nums">
                        {formatDateTimeDisplay(log.sentAt)}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900">
                          {log.recipientName}
                        </div>
                        <div className="font-mono text-slate-600 tabular-nums">
                          {log.recipientMobile}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-mono font-medium text-slate-900">
                          {log.invoiceNumber}
                          {log.billNumber ? ` · ${log.billNumber}` : ''} · {log.channel}
                        </div>
                        <div className="text-[11px] text-slate-500 max-w-xs truncate">
                          {log.messageText}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-semibold tabular-nums text-slate-900">
                        {formatCurrency(log.amount, sym)}
                      </td>
                      <td className="py-3 px-4">
                        <StatusBadge status={log.status} />
                        {log.errorMessage && (
                          <div className="text-[11px] text-rose-600 mt-0.5">
                            {log.errorMessage}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setPreviewMobileLog(log)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-50 whitespace-nowrap"
                          >
                            <Eye className="w-3 h-3" />
                            <span>View SMS</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleCopyMessage(log)}
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-50"
                            title="Copy SMS text"
                          >
                            {copiedId === log.id ? (
                              <Check className="w-3 h-3 text-emerald-600" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                          <a
                            href={buildWhatsAppShareUrl(
                              log.recipientMobile,
                              log.messageText
                            )}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-emerald-800 bg-emerald-50 border border-emerald-200 rounded hover:bg-emerald-100 whitespace-nowrap"
                          >
                            <ExternalLink className="w-3 h-3" />
                            <span>WhatsApp</span>
                          </a>
                          <button
                            type="button"
                            disabled={sendingId === log.invoiceId}
                            onClick={async () => {
                              setSendingId(log.invoiceId);
                              try {
                                await onSendInvoiceMobile(
                                  log.invoiceId,
                                  log.recipientMobile,
                                  log.channel
                                );
                              } finally {
                                setSendingId(null);
                              }
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-white bg-slate-900 rounded hover:bg-slate-800 whitespace-nowrap disabled:opacity-50"
                          >
                            <Send className="w-3 h-3" />
                            <span>Resend</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: AUTOMATED EMAIL RECEIPTS OUTBOX */}
      {subTab === 'emails' && (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-lg p-4 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="space-y-0.5">
              <div className="font-semibold text-slate-900">
                Automated Transaction Email Receipt Engine
              </div>
              <p className="text-slate-500">
                Every completed checkout automatically generates a themed HTML Tax Invoice receipt.
                {smtpConfigured
                  ? ' External SMTP relay is active — emails deliver directly to guest inboxes.'
                  : ' No external SMTP credentials set in environment — receipts are archived cleanly in the local dispatch log and ready for instant preview or export.'}
              </p>
            </div>
            <StatusBadge
              status={
                smtpConfigured ? 'Delivered (SMTP)' : 'Archived Receipt (Local Dispatch)'
              }
            />
          </div>

          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] uppercase tracking-wider text-slate-500">
                    <th className="py-3 px-4 font-semibold">Timestamp</th>
                    <th className="py-3 px-4 font-semibold">Recipient</th>
                    <th className="py-3 px-4 font-semibold">Invoice / Subject</th>
                    <th className="py-3 px-4 font-semibold text-right">Amount</th>
                    <th className="py-3 px-4 font-semibold">Delivery Status</th>
                    <th className="py-3 px-4 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {emailLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/70">
                      <td className="py-3 px-4 text-slate-600 tabular-nums">
                        {formatDateTimeDisplay(log.sentAt)}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900">
                          {log.recipientName}
                        </div>
                        <div className="text-slate-500">{log.recipientEmail}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-mono font-medium text-slate-900">
                          {log.invoiceNumber}
                          {log.billNumber ? ` · ${log.billNumber}` : ''}
                        </div>
                        <div className="text-[11px] text-slate-500 max-w-xs truncate">
                          {log.subject}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-semibold tabular-nums text-slate-900">
                        {formatCurrency(log.amount, sym)}
                      </td>
                      <td className="py-3 px-4">
                        <StatusBadge status={log.status} />
                        {log.errorMessage && (
                          <div className="text-[11px] text-rose-600 mt-0.5">
                            {log.errorMessage}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setPreviewEmailLog(log)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-50 whitespace-nowrap"
                          >
                            <Eye className="w-3 h-3" />
                            <span>Preview Email</span>
                          </button>
                          <button
                            type="button"
                            disabled={sendingId === log.invoiceId}
                            onClick={async () => {
                              setSendingId(log.invoiceId);
                              try {
                                await onSendInvoiceEmail(log.invoiceId);
                              } finally {
                                setSendingId(null);
                              }
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-white bg-slate-900 rounded hover:bg-slate-800 whitespace-nowrap disabled:opacity-50"
                          >
                            <Send className="w-3 h-3" />
                            <span>Resend</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: GST CONTROL CENTER */}
      {subTab === 'gst' && (
        <form
          onSubmit={handleSaveGst}
          className="bg-white border border-slate-200 rounded-lg p-6 space-y-6 text-xs"
        >
          <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-200">
            <div>
              <h3 className="text-base font-semibold text-slate-900">
                GST Control & Tax Rules
              </h3>
              <p className="text-slate-500 mt-0.5">
                Configure room tariff slabs, F&B GST rates, intra/inter-state regime,
                and automated receipt dispatch.
              </p>
            </div>
            <label className="inline-flex items-center gap-2.5 px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-md cursor-pointer">
              <input
                type="checkbox"
                checked={gstForm.gstEnabled}
                onChange={(e) =>
                  setGstForm({ ...gstForm, gstEnabled: e.target.checked })
                }
              />
              <span className="font-semibold text-slate-900">
                GST Billing Enabled
              </span>
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div>
              <label className="block font-medium text-slate-700 mb-1">
                Room Tariff GST Mode
              </label>
              <select
                value={gstForm.roomGstMode}
                onChange={(e) =>
                  setGstForm({
                    ...gstForm,
                    roomGstMode: e.target.value as GstSettings['roomGstMode'],
                  })
                }
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md bg-white"
              >
                <option value="auto_slab">
                  Indian Hotel Auto-Slab (0% ≤1k · 12% ≤7.5k · 18% &gt;7.5k)
                </option>
                <option value="custom">Custom Uniform Room GST %</option>
              </select>
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">
                Custom Room GST Rate (%)
              </label>
              <input
                type="number"
                min={0}
                max={28}
                disabled={gstForm.roomGstMode !== 'custom'}
                value={gstForm.customRoomGstRate}
                onChange={(e) =>
                  setGstForm({
                    ...gstForm,
                    customRoomGstRate: Number(e.target.value),
                  })
                }
                className="w-full px-3 py-2 text-sm font-mono tabular-nums border border-slate-300 rounded-md disabled:bg-slate-100"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">
                Tax Regime (CGST/SGST vs IGST)
              </label>
              <select
                value={gstForm.taxRegime}
                onChange={(e) =>
                  setGstForm({
                    ...gstForm,
                    taxRegime: e.target.value as GstSettings['taxRegime'],
                  })
                }
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md bg-white"
              >
                <option value="CGST_SGST">Intra-State (CGST 50% + SGST 50%)</option>
                <option value="IGST">Inter-State (IGST 100%)</option>
              </select>
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">
                Food & Beverage GST Mode
              </label>
              <select
                value={gstForm.foodGstMode}
                onChange={(e) =>
                  setGstForm({
                    ...gstForm,
                    foodGstMode: e.target.value as GstSettings['foodGstMode'],
                  })
                }
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md bg-white"
              >
                <option value="item_rate">Per-Item Menu GST Rate</option>
                <option value="uniform">Uniform F&B GST %</option>
              </select>
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">
                Uniform F&B GST Rate (%)
              </label>
              <input
                type="number"
                min={0}
                max={28}
                disabled={gstForm.foodGstMode !== 'uniform'}
                value={gstForm.customFoodGstRate}
                onChange={(e) =>
                  setGstForm({
                    ...gstForm,
                    customFoodGstRate: Number(e.target.value),
                  })
                }
                className="w-full px-3 py-2 text-sm font-mono tabular-nums border border-slate-300 rounded-md disabled:bg-slate-100"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">
                Service Charge (%)
              </label>
              <input
                type="number"
                min={0}
                max={20}
                value={gstForm.serviceChargeRate}
                onChange={(e) =>
                  setGstForm({
                    ...gstForm,
                    serviceChargeRate: Number(e.target.value),
                  })
                }
                className="w-full px-3 py-2 text-sm font-mono tabular-nums border border-slate-300 rounded-md"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-slate-200">
            <div className="flex flex-wrap items-center gap-6">
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={gstForm.autoSmsReceipts}
                  onChange={(e) =>
                    setGstForm({
                      ...gstForm,
                      autoSmsReceipts: e.target.checked,
                    })
                  }
                />
                <span className="font-medium text-slate-800">
                  Auto-send invoice to guest mobile
                </span>
              </label>
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={gstForm.autoEmailReceipts}
                  onChange={(e) =>
                    setGstForm({
                      ...gstForm,
                      autoEmailReceipts: e.target.checked,
                    })
                  }
                />
                <span className="font-medium text-slate-800">
                  Auto-send email receipts
                </span>
              </label>
            </div>

            <button
              type="submit"
              disabled={savingGst}
              className="px-5 py-2.5 text-xs font-semibold text-white bg-slate-900 rounded-md hover:bg-slate-800 disabled:opacity-50"
            >
              {savingGst ? 'Saving...' : 'Save GST Settings'}
            </button>
          </div>
        </form>
      )}

      {/* TAB 5: CUSTOM INVOICE THEME STUDIO */}
      {subTab === 'theme' && (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
          <form
            onSubmit={handleSaveTheme}
            className="xl:col-span-5 bg-white border border-slate-200 rounded-lg p-5 space-y-5 text-xs"
          >
            <div>
              <h3 className="text-base font-semibold text-slate-900">
                Custom Invoice Template Theme Studio
              </h3>
              <p className="text-slate-500 mt-0.5">
                Select and customize your A4 invoice & automated email template in real
                time.
              </p>
            </div>

            <div className="space-y-2">
              <label className="block font-semibold text-slate-700">
                Select Template Theme
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {THEME_PRESETS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setThemeForm({ ...themeForm, preset: p.id })}
                    className={`p-2.5 text-left border rounded-md transition-colors ${
                      themeForm.preset === p.id
                        ? 'border-slate-900 bg-slate-50 ring-1 ring-slate-900'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="font-semibold text-slate-900">{p.label}</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">{p.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="block font-semibold text-slate-700">
                Accent Brand Color
              </label>
              <div className="flex flex-wrap items-center gap-2">
                {ACCENT_SWATCHES.map((sw) => (
                  <button
                    key={sw.hex}
                    type="button"
                    onClick={() =>
                      setThemeForm({ ...themeForm, accentColor: sw.hex })
                    }
                    className={`w-7 h-7 rounded-md border-2 transition-transform ${
                      themeForm.accentColor.toLowerCase() === sw.hex.toLowerCase()
                        ? 'border-slate-900 scale-110'
                        : 'border-transparent'
                    }`}
                    style={{ backgroundColor: sw.hex }}
                    title={sw.label}
                  />
                ))}
                <input
                  type="color"
                  value={themeForm.accentColor}
                  onChange={(e) =>
                    setThemeForm({ ...themeForm, accentColor: e.target.value })
                  }
                  className="w-8 h-8 rounded border border-slate-300 cursor-pointer"
                />
                <span className="font-mono text-slate-600">
                  {themeForm.accentColor}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Monogram
                </label>
                <input
                  type="text"
                  maxLength={3}
                  value={themeForm.monogram}
                  onChange={(e) =>
                    setThemeForm({
                      ...themeForm,
                      monogram: e.target.value.toUpperCase(),
                    })
                  }
                  className="w-full px-3 py-2 text-sm font-mono font-bold border border-slate-300 rounded-md"
                />
              </div>
              <div className="col-span-2">
                <label className="block font-medium text-slate-700 mb-1">
                  Signatory Label
                </label>
                <input
                  type="text"
                  value={themeForm.signatoryTitle}
                  onChange={(e) =>
                    setThemeForm({ ...themeForm, signatoryTitle: e.target.value })
                  }
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
                />
              </div>
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">
                Header Tagline
              </label>
              <input
                type="text"
                value={themeForm.headerTagline}
                onChange={(e) =>
                  setThemeForm({ ...themeForm, headerTagline: e.target.value })
                }
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">
                Footer Thank-You Message
              </label>
              <input
                type="text"
                value={themeForm.footerNote}
                onChange={(e) =>
                  setThemeForm({ ...themeForm, footerNote: e.target.value })
                }
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">
                Terms & GST Declaration
              </label>
              <textarea
                rows={2}
                value={themeForm.termsAndConditions}
                onChange={(e) =>
                  setThemeForm({
                    ...themeForm,
                    termsAndConditions: e.target.value,
                  })
                }
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
              />
            </div>

            <div className="grid grid-cols-2 gap-2.5 pt-2 border-t border-slate-200">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={themeForm.showGstBreakdown}
                  onChange={(e) =>
                    setThemeForm({
                      ...themeForm,
                      showGstBreakdown: e.target.checked,
                    })
                  }
                />
                <span>CGST/SGST Breakdown</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={themeForm.showSacCodes}
                  onChange={(e) =>
                    setThemeForm({
                      ...themeForm,
                      showSacCodes: e.target.checked,
                    })
                  }
                />
                <span>Show SAC Codes</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={themeForm.showCompanyGstBlock}
                  onChange={(e) =>
                    setThemeForm({
                      ...themeForm,
                      showCompanyGstBlock: e.target.checked,
                    })
                  }
                />
                <span>Company GSTIN Block</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={themeForm.showPaymentSummary}
                  onChange={(e) =>
                    setThemeForm({
                      ...themeForm,
                      showPaymentSummary: e.target.checked,
                    })
                  }
                />
                <span>Payment Summary Box</span>
              </label>
            </div>

            <button
              type="submit"
              disabled={savingTheme}
              className="w-full py-2.5 text-xs font-semibold text-white bg-slate-900 rounded-md hover:bg-slate-800 disabled:opacity-50"
            >
              {savingTheme ? 'Saving Theme...' : 'Save Custom Invoice Theme'}
            </button>
          </form>

          {/* Live Preview */}
          <div className="xl:col-span-7">
            <div className="mb-2 text-xs font-medium text-slate-500">
              Live A4 Invoice Template Preview ({THEME_PRESETS.find((p) => p.id === themeForm.preset)?.label})
            </div>
            <InvoicePreview
              invoice={{ ...samplePreviewInvoice, templatePreset: themeForm.preset }}
              gstSettings={gstForm}
              theme={themeForm}
              compact
            />
          </div>
        </div>
      )}

      {/* Email Receipt HTML Preview Modal */}
      {previewEmailLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="bg-white border border-slate-200 rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">
                  {previewEmailLog.subject}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  To: {previewEmailLog.recipientEmail} ·{' '}
                  {formatDateTimeDisplay(previewEmailLog.sentAt)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPreviewEmailLog(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 bg-slate-100 p-4 overflow-hidden">
              <iframe
                title="Email Receipt Preview"
                srcDoc={previewEmailLog.htmlBody}
                sandbox=""
                className="w-full h-[65vh] bg-white border border-slate-200 rounded-md"
              />
            </div>
          </div>
        </div>
      )}

      {/* Mobile SMS / WhatsApp Message Preview Modal */}
      {previewMobileLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="bg-white border border-slate-200 rounded-xl shadow-xl w-full max-w-lg overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">
                  Mobile Invoice Message ({previewMobileLog.channel})
                </h3>
                <p className="text-xs text-slate-500 mt-0.5 tabular-nums">
                  To: {previewMobileLog.recipientName} ({previewMobileLog.recipientMobile})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPreviewMobileLog(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-4 text-xs">
              <pre className="whitespace-pre-wrap font-mono text-xs bg-slate-50 border border-slate-200 rounded-lg p-4 text-slate-800 leading-relaxed">
                {previewMobileLog.messageText}
              </pre>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <a
                  href={previewMobileLog.invoiceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-700 hover:underline"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Open Linked A4 Invoice Page</span>
                </a>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleCopyMessage(previewMobileLog)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 font-medium text-slate-700 bg-white border border-slate-300 rounded-md"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>{copiedId === previewMobileLog.id ? 'Copied!' : 'Copy Text'}</span>
                  </button>
                  <a
                    href={buildWhatsAppShareUrl(
                      previewMobileLog.recipientMobile,
                      previewMobileLog.messageText
                    )}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 font-medium text-white bg-emerald-700 rounded-md hover:bg-emerald-800"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Open WhatsApp</span>
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Send / Override Recipient Email Modal */}
      {customEmailTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="bg-white border border-slate-200 rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
              <h3 className="text-sm font-semibold text-slate-900">
                Send Automated Email Receipt
              </h3>
              <button
                type="button"
                onClick={() => setCustomEmailTarget(null)}
                className="p-1 text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setSendingId(customEmailTarget.invoiceId);
                try {
                  await onSendInvoiceEmail(
                    customEmailTarget.invoiceId,
                    customEmailTarget.email
                  );
                  setCustomEmailTarget(null);
                  setSubTab('emails');
                } finally {
                  setSendingId(null);
                }
              }}
              className="p-5 space-y-4 text-xs"
            >
              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Recipient Email Address
                </label>
                <input
                  type="email"
                  required
                  value={customEmailTarget.email}
                  onChange={(e) =>
                    setCustomEmailTarget({
                      ...customEmailTarget,
                      email: e.target.value,
                    })
                  }
                  placeholder="guest@company.com"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setCustomEmailTarget(null)}
                  className="px-4 py-2 font-medium text-slate-700 bg-white border border-slate-300 rounded-md"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={sendingId === customEmailTarget.invoiceId}
                  className="px-4 py-2 font-medium text-white bg-slate-900 rounded-md hover:bg-slate-800"
                >
                  {sendingId ? 'Dispatching...' : 'Send Receipt'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Send / Override Recipient Mobile Modal */}
      {customMobileTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="bg-white border border-slate-200 rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
              <h3 className="text-sm font-semibold text-slate-900">
                Send Invoice to Guest Mobile Number
              </h3>
              <button
                type="button"
                onClick={() => setCustomMobileTarget(null)}
                className="p-1 text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setSendingId(customMobileTarget.invoiceId);
                try {
                  await onSendInvoiceMobile(
                    customMobileTarget.invoiceId,
                    customMobileTarget.mobile,
                    customMobileTarget.channel
                  );
                  setCustomMobileTarget(null);
                  setSubTab('mobile');
                } finally {
                  setSendingId(null);
                }
              }}
              className="p-5 space-y-4 text-xs"
            >
              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Guest Mobile Number
                </label>
                <input
                  type="tel"
                  required
                  value={customMobileTarget.mobile}
                  onChange={(e) =>
                    setCustomMobileTarget({
                      ...customMobileTarget,
                      mobile: e.target.value,
                    })
                  }
                  placeholder="9820451290"
                  className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-md"
                />
              </div>
              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Dispatch Channel
                </label>
                <select
                  value={customMobileTarget.channel}
                  onChange={(e) =>
                    setCustomMobileTarget({
                      ...customMobileTarget,
                      channel: e.target.value as 'SMS' | 'WhatsApp',
                    })
                  }
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md bg-white"
                >
                  <option value="SMS">SMS</option>
                  <option value="WhatsApp">WhatsApp</option>
                </select>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setCustomMobileTarget(null)}
                  className="px-4 py-2 font-medium text-slate-700 bg-white border border-slate-300 rounded-md"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={sendingId === customMobileTarget.invoiceId}
                  className="px-4 py-2 font-medium text-white bg-slate-900 rounded-md hover:bg-slate-800"
                >
                  {sendingId ? 'Sending...' : 'Send to Mobile'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
