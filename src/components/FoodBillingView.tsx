import React, { useMemo, useState } from 'react';
import {
  Calendar,
  FileText,
  Mail,
  MessageSquare,
  Plus,
  Printer,
  Search,
} from 'lucide-react';
import { GstSettings, Invoice } from '../types/hotel';
import { formatCurrency, formatStayDateTime } from '../utils/billing';
import { StatusBadge } from './StatusBadge';

interface FoodBillingViewProps {
  invoices: Invoice[];
  gstSettings: GstSettings;
  onOpenNewFoodBill: () => void;
  onViewInvoice: (invoice: Invoice, autoPrint?: boolean) => void;
  onResendEmail: (invoiceId: string) => Promise<void>;
  onSendMobile: (invoiceId: string) => Promise<void>;
}

export const FoodBillingView: React.FC<FoodBillingViewProps> = ({
  invoices,
  gstSettings,
  onOpenNewFoodBill,
  onViewInvoice,
  onResendEmail,
  onSendMobile,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const sym = gstSettings.currencySymbol || '₹';

  const foodInvoices = useMemo(
    () =>
      invoices.filter(
        (inv) =>
          inv.invoiceType === 'food' || inv.invoiceNumber.startsWith('FNB-')
      ),
    [invoices]
  );

  const filteredFoodInvoices = useMemo(() => {
    return foodInvoices.filter((inv) => {
      const q = searchQuery.trim().toLowerCase();
      if (q) {
        const hay = [
          inv.billNumber || '',
          inv.invoiceNumber,
          inv.guestName,
          inv.guestMobile,
          inv.companyName,
          inv.companyGst,
          inv.roomNumber,
          inv.roomType,
        ]
          .join(' ')
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }

      if (fromDate || toDate) {
        const refDay = (inv.checkInDate || inv.issuedAt).slice(0, 10);
        if (fromDate && refDay < fromDate) return false;
        if (toDate && refDay > toDate) return false;
      }

      return true;
    });
  }, [foodInvoices, searchQuery, fromDate, toDate]);

  const totals = useMemo(() => {
    const taxable = filteredFoodInvoices.reduce((s, i) => s + i.taxableTotal, 0);
    const gst = filteredFoodInvoices.reduce((s, i) => s + i.totalGst, 0);
    const billed = filteredFoodInvoices.reduce((s, i) => s + i.grandTotal, 0);
    return { count: filteredFoodInvoices.length, taxable, gst, billed };
  }, [filteredFoodInvoices]);

  const applyDatePreset = (preset: 'today' | 'week' | 'month' | 'clear') => {
    const today = new Date();
    const toIso = today.toISOString().slice(0, 10);
    if (preset === 'clear') {
      setFromDate('');
      setToDate('');
      return;
    }
    if (preset === 'today') {
      setFromDate(toIso);
      setToDate(toIso);
      return;
    }
    if (preset === 'week') {
      const d = new Date(today);
      d.setDate(d.getDate() - 7);
      setFromDate(d.toISOString().slice(0, 10));
      setToDate(toIso);
      return;
    }
    if (preset === 'month') {
      const d = new Date(today.getFullYear(), today.getMonth(), 1);
      setFromDate(d.toISOString().slice(0, 10));
      setToDate(toIso);
    }
  };

  return (
    <div className="space-y-4">
      {/* KPI Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="text-xs font-medium text-slate-500">Food Bills Issued</div>
          <div className="mt-1 text-2xl font-bold text-slate-900 tabular-nums">
            {totals.count}
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="text-xs font-medium text-slate-500">Taxable F&B Revenue</div>
          <div className="mt-1 text-xl font-bold font-mono text-slate-900 tabular-nums">
            {formatCurrency(totals.taxable, sym)}
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="text-xs font-medium text-slate-500">Food GST Collected</div>
          <div className="mt-1 text-xl font-bold font-mono text-slate-900 tabular-nums">
            {formatCurrency(totals.gst, sym)}
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="text-xs font-medium text-slate-500">Total Food Billed</div>
          <div className="mt-1 text-xl font-bold font-mono text-slate-900 tabular-nums">
            {formatCurrency(totals.billed, sym)}
          </div>
        </div>
      </div>

      {/* Search, Date Range & New Food Bill Action */}
      <div className="bg-white border border-slate-200 rounded-lg p-3.5 flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search food bills by guest name, mobile, table, or invoice #..."
            className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900/15"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Calendar className="w-3.5 h-3.5 text-slate-400" />
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="px-2.5 py-1.5 border border-slate-300 rounded-md tabular-nums"
            aria-label="From date"
          />
          <span className="text-slate-400">to</span>
          <input
            type="date"
            value={toDate}
            min={fromDate || undefined}
            onChange={(e) => setToDate(e.target.value)}
            className="px-2.5 py-1.5 border border-slate-300 rounded-md tabular-nums"
            aria-label="To date"
          />
          <button
            type="button"
            onClick={() => applyDatePreset('today')}
            className="px-2 py-1 text-[11px] font-medium text-slate-600 bg-slate-100 rounded hover:bg-slate-200 whitespace-nowrap"
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => applyDatePreset('week')}
            className="px-2 py-1 text-[11px] font-medium text-slate-600 bg-slate-100 rounded hover:bg-slate-200 whitespace-nowrap"
          >
            7 Days
          </button>
          {(fromDate || toDate || searchQuery) && (
            <button
              type="button"
              onClick={() => {
                applyDatePreset('clear');
                setSearchQuery('');
              }}
              className="px-2 py-1 text-[11px] font-medium text-rose-700 bg-rose-50 rounded hover:bg-rose-100 whitespace-nowrap"
            >
              Reset
            </button>
          )}
          <button
            type="button"
            onClick={onOpenNewFoodBill}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-slate-900 rounded-md hover:bg-slate-800 whitespace-nowrap shrink-0 ml-1"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Food Bill</span>
          </button>
        </div>
      </div>

      {/* Standalone Food Bills Ledger */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] uppercase tracking-wider text-slate-500">
                <th className="py-3 px-4 font-semibold">Bill # & Order Time</th>
                <th className="py-3 px-4 font-semibold">Guest & Mobile</th>
                <th className="py-3 px-4 font-semibold">Service / Table</th>
                <th className="py-3 px-4 font-semibold text-right">Taxable</th>
                <th className="py-3 px-4 font-semibold text-right">GST</th>
                <th className="py-3 px-4 font-semibold text-right">Grand Total</th>
                <th className="py-3 px-4 font-semibold">Dispatch</th>
                <th className="py-3 px-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredFoodInvoices.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-12 text-center space-y-3">
                    <div className="text-slate-500">
                      No separate food bills generated yet. Create a standalone Dine-In, Takeaway, or Guest Food Bill with GST & A4 printing.
                    </div>
                    <button
                      type="button"
                      onClick={onOpenNewFoodBill}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-slate-900 rounded-md hover:bg-slate-800"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Create First Food Bill</span>
                    </button>
                  </td>
                </tr>
              )}
              {filteredFoodInvoices.map((inv) => (
                <tr key={inv.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-3 px-4 tabular-nums">
                    <div className="font-mono font-semibold text-slate-900">
                      {inv.invoiceNumber}
                    </div>
                    {inv.billNumber && (
                      <div className="text-[11px] font-mono text-slate-600">
                        Bill: {inv.billNumber}
                      </div>
                    )}
                    <div className="text-[11px] text-slate-500">
                      {formatStayDateTime(inv.checkInDate, inv.checkInTime)}
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
                  <td className="py-3 px-4">
                    <div className="font-medium text-slate-800">
                      {inv.roomType || 'F&B'} · {inv.roomNumber}
                    </div>
                    <div className="text-[11px] text-slate-500 tabular-nums">
                      {inv.lineItems.length} item{inv.lineItems.length > 1 ? 's' : ''} · {inv.paymentMethod}
                    </div>
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
                      <StatusBadge status={inv.mobileStatus || 'Skipped'} />
                      <StatusBadge status={inv.emailStatus} />
                    </div>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="inline-flex items-center justify-end gap-1.5">
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
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-white bg-slate-900 rounded hover:bg-slate-800 whitespace-nowrap"
                        title="Print A4 Food Bill"
                      >
                        <Printer className="w-3 h-3" />
                        <span>Print</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onSendMobile(inv.id)}
                        title="Send bill to guest mobile"
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-50"
                      >
                        <MessageSquare className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onResendEmail(inv.id)}
                        title="Send email receipt"
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-50"
                      >
                        <Mail className="w-3 h-3" />
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
  );
};
