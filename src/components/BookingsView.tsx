import React, { useMemo, useState } from 'react';
import {
  Calendar,
  Clock,
  FileText,
  KeyRound,
  Mail,
  MessageSquare,
  Plus,
  Printer,
  ReceiptText,
  Search,
  Trash2,
} from 'lucide-react';
import {
  Booking,
  GstSettings,
  Guest,
  Invoice,
  Room,
} from '../types/hotel';
import {
  computeBookingFolio,
  formatCurrency,
  formatDateTimeDisplay,
  formatStayDateTime,
  toLocalDateInput,
} from '../utils/billing';
import { StatusBadge } from './StatusBadge';

type BookingsTab = 'active' | 'held' | 'history' | 'bill_history' | 'all';

interface BookingsViewProps {
  bookings: Booking[];
  rooms: Room[];
  guests: Guest[];
  invoices: Invoice[];
  gstSettings: GstSettings;
  initialTab?: BookingsTab;
  onOpenCheckIn: (mode: 'CheckedIn' | 'Held') => void;
  onOpenFolio: (booking: Booking) => void;
  onConvertHold: (bookingId: string) => Promise<void>;
  onDeleteBooking: (bookingId: string) => Promise<void>;
  onViewInvoice: (invoice: Invoice, autoPrint?: boolean) => void;
  onResendEmail: (invoiceId: string) => Promise<void>;
  onSendMobile: (invoiceId: string) => Promise<void>;
}

export const BookingsView: React.FC<BookingsViewProps> = ({
  bookings,
  rooms,
  guests,
  invoices,
  gstSettings,
  initialTab = 'active',
  onOpenCheckIn,
  onOpenFolio,
  onConvertHold,
  onDeleteBooking,
  onViewInvoice,
  onResendEmail,
  onSendMobile,
}) => {
  const [tab, setTab] = useState<BookingsTab>(initialTab);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGuestKey, setSelectedGuestKey] = useState('');
  const [billTypeFilter, setBillTypeFilter] = useState<'all' | 'room' | 'food'>('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');

  const sym = gstSettings.currencySymbol || '₹';

  const guestMobileOptions = useMemo(() => {
    const map = new Map<string, { key: string; name: string; mobile: string }>();
    for (const inv of invoices) {
      const name = (inv.guestName || '').trim();
      const mobile = (inv.guestMobile || '').trim();
      if (!name) continue;
      const key = `${name.toLowerCase()}||${mobile.toLowerCase()}`;
      if (!map.has(key)) {
        map.set(key, { key, name, mobile });
      }
    }
    for (const g of guests) {
      const name = (g.name || '').trim();
      const mobile = (g.mobile || '').trim();
      if (!name) continue;
      const key = `${name.toLowerCase()}||${mobile.toLowerCase()}`;
      if (!map.has(key)) {
        map.set(key, { key, name, mobile });
      }
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [invoices, guests]);

  const activeCheckedInByRoomId = useMemo(() => {
    const map = new Map<string, Booking>();
    for (const b of bookings) {
      if (b.status === 'CheckedIn') {
        map.set(b.roomId, b);
      }
    }
    return map;
  }, [bookings]);

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

  const filteredBookings = useMemo(() => {
    return bookings.filter((b) => {
      if (tab === 'active' && b.status !== 'CheckedIn') return false;
      if (tab === 'held' && b.status !== 'Held') return false;
      if (tab === 'history' && b.status !== 'CheckedOut') return false;

      const guest = guests.find((g) => g.id === b.guestId);
      const room = rooms.find((r) => r.id === b.roomId);
      const invoice = b.invoiceId
        ? invoices.find((inv) => inv.id === b.invoiceId)
        : undefined;

      const q = searchQuery.trim().toLowerCase();
      if (q) {
        const hay = [
          guest?.name || '',
          guest?.mobile || '',
          guest?.companyName || '',
          guest?.companyGst || '',
          room?.number || '',
          b.bookingCode,
          invoice?.billNumber || '',
          invoice?.invoiceNumber || '',
        ]
          .join(' ')
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }

      if (selectedGuestKey) {
        const gKey = `${(guest?.name || '').trim().toLowerCase()}||${(guest?.mobile || '').trim().toLowerCase()}`;
        if (gKey !== selectedGuestKey) return false;
      }

      if (fromDate || toDate) {
        const refIso =
          tab === 'history'
            ? b.actualCheckOutAt || b.checkOutDate
            : b.checkInDate;
        const refDay = toLocalDateInput(refIso);
        if (fromDate && refDay < fromDate) return false;
        if (toDate && refDay > toDate) return false;
      }

      return true;
    });
  }, [bookings, tab, guests, rooms, invoices, searchQuery, selectedGuestKey, fromDate, toDate]);

  const filteredBillHistory = useMemo(() => {
    return invoices.filter((inv) => {
      const isFood = inv.invoiceType === 'food' || inv.invoiceNumber.startsWith('FNB-');
      if (billTypeFilter === 'room' && isFood) return false;
      if (billTypeFilter === 'food' && !isFood) return false;

      if (selectedGuestKey) {
        const key = `${(inv.guestName || '').trim().toLowerCase()}||${(inv.guestMobile || '').trim().toLowerCase()}`;
        if (key !== selectedGuestKey) return false;
      }

      const q = searchQuery.trim().toLowerCase();
      if (q) {
        const hay = [
          inv.billNumber || '',
          inv.invoiceNumber,
          inv.guestName,
          inv.guestMobile,
          inv.guestEmail || '',
          inv.companyName,
          inv.companyGst,
          inv.roomNumber,
          inv.roomType,
          inv.paymentMethod,
          inv.paymentReference,
        ]
          .join(' ')
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }

      if (fromDate || toDate) {
        const refDay = toLocalDateInput(inv.issuedAt || inv.checkOutDate || inv.checkInDate);
        if (fromDate && refDay < fromDate) return false;
        if (toDate && refDay > toDate) return false;
      }

      return true;
    });
  }, [invoices, billTypeFilter, selectedGuestKey, searchQuery, fromDate, toDate]);

  const billHistoryTotals = useMemo(() => {
    return filteredBillHistory.reduce(
      (acc, inv) => ({
        count: acc.count + 1,
        taxable: acc.taxable + inv.taxableTotal,
        gst: acc.gst + inv.totalGst,
        grandTotal: acc.grandTotal + inv.grandTotal,
      }),
      { count: 0, taxable: 0, gst: 0, grandTotal: 0 }
    );
  }, [filteredBillHistory]);

  const counts = useMemo(
    () => ({
      active: bookings.filter((b) => b.status === 'CheckedIn').length,
      held: bookings.filter((b) => b.status === 'Held').length,
      history: bookings.filter((b) => b.status === 'CheckedOut').length,
      billHistory: invoices.length,
      all: bookings.length,
    }),
    [bookings, invoices]
  );

  return (
    <div className="space-y-4">
      {/* Top Tabs & Primary Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg overflow-x-auto">
          <button
            type="button"
            onClick={() => setTab('active')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
              tab === 'active'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Active Check-Ins ({counts.active})
          </button>
          <button
            type="button"
            onClick={() => setTab('held')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
              tab === 'held'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Held Check-Ins ({counts.held})
          </button>
          <button
            type="button"
            onClick={() => setTab('history')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
              tab === 'history'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Checkout History ({counts.history})
          </button>
          <button
            type="button"
            onClick={() => setTab('bill_history')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
              tab === 'bill_history'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Bill History ({counts.billHistory})
          </button>
          <button
            type="button"
            onClick={() => setTab('all')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
              tab === 'all'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            All ({counts.all})
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onOpenCheckIn('Held')}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 whitespace-nowrap shrink-0"
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Hold Check-In</span>
          </button>
          <button
            type="button"
            onClick={() => onOpenCheckIn('CheckedIn')}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-white bg-slate-900 rounded-md hover:bg-slate-800 whitespace-nowrap shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Check-In</span>
          </button>
        </div>
      </div>

      {/* Search by Guest Name / Mobile & Date Selection */}
      <div className="bg-white border border-slate-200 rounded-lg p-3.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[260px]">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
                tab === 'bill_history'
                  ? 'Search bill #, invoice #, guest name, mobile #, or GSTIN...'
                  : 'Search by guest name, mobile number, company, room #, or bill #...'
              }
              className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900/15"
            />
          </div>

          <select
            value={selectedGuestKey}
            onChange={(e) => setSelectedGuestKey(e.target.value)}
            aria-label="Filter by guest name and mobile number"
            className="px-2.5 py-2 text-xs border border-slate-300 rounded-md bg-white text-slate-700 max-w-[260px]"
          >
            <option value="">All Guests (Name · Mobile)</option>
            {guestMobileOptions.map((opt) => (
              <option key={opt.key} value={opt.key}>
                {opt.name}
                {opt.mobile && opt.mobile !== '—' ? ` · ${opt.mobile}` : ''}
              </option>
            ))}
          </select>

          {tab === 'bill_history' && (
            <select
              value={billTypeFilter}
              onChange={(e) =>
                setBillTypeFilter(e.target.value as 'all' | 'room' | 'food')
              }
              aria-label="Filter bill type"
              className="px-2.5 py-2 text-xs border border-slate-300 rounded-md bg-white text-slate-700"
            >
              <option value="all">All Bills</option>
              <option value="room">Room Stay Bills</option>
              <option value="food">Food Bills</option>
            </select>
          )}
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
          <div className="flex items-center gap-1 pl-1">
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
            <button
              type="button"
              onClick={() => applyDatePreset('month')}
              className="px-2 py-1 text-[11px] font-medium text-slate-600 bg-slate-100 rounded hover:bg-slate-200 whitespace-nowrap"
            >
              This Month
            </button>
            {(fromDate || toDate || searchQuery || selectedGuestKey || billTypeFilter !== 'all') && (
              <button
                type="button"
                onClick={() => {
                  applyDatePreset('clear');
                  setSearchQuery('');
                  setSelectedGuestKey('');
                  setBillTypeFilter('all');
                }}
                className="px-2 py-1 text-[11px] font-medium text-rose-700 bg-rose-50 rounded hover:bg-rose-100 whitespace-nowrap"
              >
                Reset
              </button>
            )}
          </div>
        </div>
      </div>

      {actionError && (
        <div className="p-3 text-xs font-medium text-rose-800 bg-rose-50 border border-rose-200 rounded-md flex items-center justify-between gap-3">
          <span>{actionError}</span>
          <button
            type="button"
            onClick={() => setActionError('')}
            className="text-[11px] underline text-rose-700 shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      {tab === 'bill_history' ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-white border border-slate-200 rounded-lg p-3.5">
              <div className="text-[11px] font-medium text-slate-500">Bills Found</div>
              <div className="mt-1 text-xl font-bold text-slate-900 tabular-nums">
                {billHistoryTotals.count}
              </div>
            </div>
            <div className="bg-white border border-slate-200 rounded-lg p-3.5">
              <div className="text-[11px] font-medium text-slate-500">Taxable Value</div>
              <div className="mt-1 text-lg font-bold font-mono text-slate-900 tabular-nums">
                {formatCurrency(billHistoryTotals.taxable, sym)}
              </div>
            </div>
            <div className="bg-white border border-slate-200 rounded-lg p-3.5">
              <div className="text-[11px] font-medium text-slate-500">Total GST</div>
              <div className="mt-1 text-lg font-bold font-mono text-slate-900 tabular-nums">
                {formatCurrency(billHistoryTotals.gst, sym)}
              </div>
            </div>
            <div className="bg-white border border-slate-200 rounded-lg p-3.5">
              <div className="text-[11px] font-medium text-slate-500">Grand Total Billed</div>
              <div className="mt-1 text-lg font-bold font-mono text-emerald-700 tabular-nums">
                {formatCurrency(billHistoryTotals.grandTotal, sym)}
              </div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] uppercase tracking-wider text-slate-500">
                    <th className="py-3 px-4 font-semibold">Bill # & Invoice #</th>
                    <th className="py-3 px-4 font-semibold">Guest & Mobile</th>
                    <th className="py-3 px-4 font-semibold">Company / GSTIN</th>
                    <th className="py-3 px-4 font-semibold">Stay / Service & Timings</th>
                    <th className="py-3 px-4 font-semibold">Payment & Tax</th>
                    <th className="py-3 px-4 font-semibold text-right">Grand Total</th>
                    <th className="py-3 px-4 font-semibold text-right">Print / Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {filteredBillHistory.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-500">
                        No bills match the selected date or guest/mobile filter.
                      </td>
                    </tr>
                  )}
                  {filteredBillHistory.map((inv) => {
                    const isFood =
                      inv.invoiceType === 'food' || inv.invoiceNumber.startsWith('FNB-');
                    return (
                      <tr key={inv.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-4 tabular-nums">
                          <div className="font-mono font-semibold text-slate-900">
                            {inv.billNumber || '—'}
                          </div>
                          <div className="font-mono text-[11px] text-slate-700">
                            {inv.invoiceNumber}
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            {formatDateTimeDisplay(inv.issuedAt)}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-900">
                            {inv.guestName}
                          </div>
                          <div className="font-mono text-slate-600 tabular-nums">
                            {inv.guestMobile}
                          </div>
                          {inv.guestAddress && (
                            <div className="text-[11px] text-slate-500 max-w-[200px] truncate">
                              {inv.guestAddress}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <div className="text-slate-800">
                            {inv.companyName || 'Individual Guest'}
                          </div>
                          {inv.companyGst && (
                            <div className="font-mono text-[11px] text-slate-500">
                              {inv.companyGst}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4 tabular-nums">
                          {isFood ? (
                            <>
                              <div className="font-medium text-slate-800">
                                F&amp;B · {inv.roomType} ({inv.roomNumber})
                              </div>
                              <div className="text-[11px] text-slate-500">
                                Order: {formatStayDateTime(inv.checkInDate, inv.checkInTime)}
                              </div>
                            </>
                          ) : (
                            <>
                              <div className="font-medium text-slate-800">
                                Room {inv.roomNumber} · {inv.roomType} ({inv.nights}n)
                              </div>
                              <div className="text-[11px] text-slate-500">
                                In: {formatStayDateTime(inv.checkInDate, inv.checkInTime)}
                              </div>
                              <div className="text-[11px] text-slate-500">
                                Out: {formatStayDateTime(inv.checkOutDate, inv.checkOutTime)}
                              </div>
                            </>
                          )}
                        </td>
                        <td className="py-3 px-4 tabular-nums">
                          <div className="font-medium text-slate-800">
                            {inv.paymentMethod}
                            {inv.paymentReference ? ` · ${inv.paymentReference}` : ''}
                          </div>
                          <div className="text-[11px] text-slate-500 font-mono">
                            Taxable: {formatCurrency(inv.taxableTotal, sym)} · GST:{' '}
                            {formatCurrency(inv.totalGst, sym)}
                          </div>
                          {inv.advancePaid > 0 && (
                            <div className="text-[11px] text-slate-500 font-mono">
                              Adv: {formatCurrency(inv.advancePaid, sym)} · Net:{' '}
                              {formatCurrency(inv.netPaid, sym)}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right tabular-nums">
                          <div className="font-mono font-bold text-slate-900">
                            {formatCurrency(inv.grandTotal, sym)}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {inv.lineItems.length} item{inv.lineItems.length > 1 ? 's' : ''}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="inline-flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => onViewInvoice(inv, true)}
                              title="Print A4 Bill"
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-white bg-slate-900 rounded hover:bg-slate-800 whitespace-nowrap"
                            >
                              <Printer className="w-3 h-3" />
                              <span>Print</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => onViewInvoice(inv, false)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-50 whitespace-nowrap"
                            >
                              <FileText className="w-3 h-3" />
                              <span>View</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => onSendMobile(inv.id)}
                              title="Send to guest mobile"
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
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
      /* Bookings Ledger Table */
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] uppercase tracking-wider text-slate-500">
                <th className="py-3 px-4 font-semibold">Booking / Room</th>
                <th className="py-3 px-4 font-semibold">Guest & Mobile</th>
                <th className="py-3 px-4 font-semibold">Company / GSTIN</th>
                <th className="py-3 px-4 font-semibold">Stay Dates & Timings</th>
                <th className="py-3 px-4 font-semibold text-right">Folio / Bill</th>
                <th className="py-3 px-4 font-semibold">Status</th>
                <th className="py-3 px-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredBookings.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500">
                    No matching check-ins or checkout history records found.
                  </td>
                </tr>
              )}
              {filteredBookings.map((b) => {
                const guest = guests.find((g) => g.id === b.guestId);
                const room = rooms.find((r) => r.id === b.roomId);
                const invoice = b.invoiceId
                  ? invoices.find((inv) => inv.id === b.invoiceId)
                  : undefined;
                const folio = computeBookingFolio(b, room, gstSettings);
                const totalAmount = invoice ? invoice.grandTotal : folio.grandTotal;

                return (
                  <tr key={b.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-mono font-semibold text-slate-900">
                        Room {room?.number || '—'}
                      </div>
                      <div className="text-slate-500 font-mono text-[11px]">
                        {b.bookingCode} · {room?.type}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900">
                        {guest?.name || 'Unknown Guest'}
                      </div>
                      <div className="text-slate-500 font-mono tabular-nums">
                        {guest?.mobile || '—'}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="text-slate-800">
                        {guest?.companyName || 'Individual Guest'}
                      </div>
                      {guest?.companyGst && (
                        <div className="font-mono text-[11px] text-slate-500">
                          {guest.companyGst}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 tabular-nums">
                      <div className="text-slate-800">
                        In: {formatStayDateTime(b.checkInDate, b.checkInTime)}
                      </div>
                      <div className="text-slate-500">
                        Out:{' '}
                        {formatStayDateTime(b.actualCheckOutAt || b.checkOutDate, b.checkOutTime)} (
                        {b.nights}n)
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right tabular-nums">
                      <div className="font-mono font-semibold text-slate-900">
                        {formatCurrency(totalAmount, sym)}
                      </div>
                      {b.status === 'CheckedIn' && (
                        <div className="text-[11px] text-slate-500">
                          Due: {formatCurrency(folio.balanceDue, sym)}
                        </div>
                      )}
                      {invoice && (
                        <div className="font-mono text-[11px] text-slate-500">
                          {invoice.invoiceNumber}
                          {invoice.billNumber ? ` · ${invoice.billNumber}` : ''}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <StatusBadge status={b.status} />
                      {b.status === 'Held' &&
                        activeCheckedInByRoomId.has(b.roomId) &&
                        (() => {
                          const pendingStay = activeCheckedInByRoomId.get(b.roomId)!;
                          const pendingGuest = guests.find(
                            (g) => g.id === pendingStay.guestId
                          );
                          return (
                            <div className="mt-1 text-[10px] font-medium text-amber-800 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5 inline-block">
                              Pending Check-Out: {pendingGuest?.name || 'Occupied'}
                            </div>
                          );
                        })()}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="inline-flex items-center justify-end gap-1.5">
                        {b.status === 'Held' && (
                          <>
                            {activeCheckedInByRoomId.has(b.roomId) && (
                              <button
                                type="button"
                                onClick={() =>
                                  onOpenFolio(activeCheckedInByRoomId.get(b.roomId)!)
                                }
                                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-amber-900 bg-amber-100 border border-amber-300 rounded hover:bg-amber-200 whitespace-nowrap"
                              >
                                <ReceiptText className="w-3 h-3" />
                                <span>Checkout Current</span>
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={async () => {
                                setActionError('');
                                try {
                                  await onConvertHold(b.id);
                                } catch (err) {
                                  setActionError(
                                    err instanceof Error
                                      ? err.message
                                      : 'Unable to check in held booking.'
                                  );
                                }
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-white bg-slate-900 rounded hover:bg-slate-800 whitespace-nowrap"
                            >
                              <KeyRound className="w-3 h-3" />
                              <span>Check In</span>
                            </button>
                          </>
                        )}
                        {b.status === 'CheckedIn' && (
                          <button
                            type="button"
                            onClick={() => onOpenFolio(b)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-white bg-blue-700 rounded hover:bg-blue-800 whitespace-nowrap"
                          >
                            <ReceiptText className="w-3 h-3" />
                            <span>Folio / Checkout</span>
                          </button>
                        )}
                        {b.status === 'CheckedOut' && invoice && (
                          <>
                            <button
                              type="button"
                              onClick={() => onViewInvoice(invoice)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-50 whitespace-nowrap"
                            >
                              <FileText className="w-3 h-3" />
                              <span>Invoice</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => onViewInvoice(invoice, true)}
                              title="Print A4 Invoice"
                              className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-50 whitespace-nowrap"
                            >
                              <Printer className="w-3 h-3" />
                              <span>Print</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => onSendMobile(invoice.id)}
                              title="Send invoice to guest mobile"
                              className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-50"
                            >
                              <MessageSquare className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => onResendEmail(invoice.id)}
                              title="Send email receipt"
                              className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-50"
                            >
                              <Mail className="w-3 h-3" />
                            </button>
                          </>
                        )}

                        {confirmDeleteId === b.id ? (
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={async () => {
                                await onDeleteBooking(b.id);
                                setConfirmDeleteId(null);
                              }}
                              className="px-2 py-1 text-[11px] font-medium text-white bg-rose-600 rounded hover:bg-rose-700 whitespace-nowrap"
                            >
                              Confirm Delete
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(null)}
                              className="px-2 py-1 text-[11px] font-medium text-slate-600 bg-slate-100 rounded"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(b.id)}
                            title="Delete check-in"
                            className="p-1.5 text-slate-400 hover:text-rose-600 border border-slate-200 rounded hover:border-rose-200"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      )}
    </div>
  );
};
