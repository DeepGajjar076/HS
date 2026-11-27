import React, { useMemo, useState } from 'react';
import {
  Building2,
  Edit3,
  History,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import {
  Booking,
  GstSettings,
  Guest,
  Invoice,
  Room,
} from '../types/hotel';
import { formatCurrency, formatStayDateTime } from '../utils/billing';
import { StatusBadge } from './StatusBadge';

interface GuestsViewProps {
  guests: Guest[];
  bookings: Booking[];
  rooms: Room[];
  invoices: Invoice[];
  gstSettings: GstSettings;
  onCreateGuest: (payload: Omit<Guest, 'id' | 'createdAt'>) => Promise<Guest>;
  onUpdateGuest: (id: string, payload: Partial<Guest>) => Promise<Guest>;
  onDeleteGuest: (id: string) => Promise<void>;
  onViewInvoice: (invoice: Invoice) => void;
}

const EMPTY_FORM: Omit<Guest, 'id' | 'createdAt'> = {
  name: '',
  mobile: '',
  email: '',
  companyName: '',
  companyGst: '',
  idProofType: 'Aadhaar',
  idProofNumber: '',
  address: '',
  notes: '',
};

export const GuestsView: React.FC<GuestsViewProps> = ({
  guests,
  bookings,
  rooms,
  invoices,
  gstSettings,
  onCreateGuest,
  onUpdateGuest,
  onDeleteGuest,
  onViewInvoice,
}) => {
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingGuest, setEditingGuest] = useState<Guest | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [historyGuest, setHistoryGuest] = useState<Guest | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const sym = gstSettings.currencySymbol || '₹';

  const filteredGuests = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return guests;
    return guests.filter((g) =>
      [g.name, g.mobile, g.email, g.companyName, g.companyGst]
        .join(' ')
        .toLowerCase()
        .includes(q)
    );
  }, [guests, search]);

  const openAdd = () => {
    setEditingGuest(null);
    setForm(EMPTY_FORM);
    setError('');
    setModalOpen(true);
  };

  const openEdit = (guest: Guest) => {
    setEditingGuest(guest);
    setForm({
      name: guest.name,
      mobile: guest.mobile,
      email: guest.email,
      companyName: guest.companyName,
      companyGst: guest.companyGst,
      idProofType: guest.idProofType,
      idProofNumber: guest.idProofNumber,
      address: guest.address,
      notes: guest.notes,
    });
    setError('');
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.mobile.trim()) {
      setError('Guest full name and mobile number are required.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      if (editingGuest) {
        await onUpdateGuest(editingGuest.id, form);
      } else {
        await onCreateGuest(form);
      }
      setModalOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save guest.');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (guest: Guest) => {
    try {
      await onDeleteGuest(guest.id);
      if (historyGuest?.id === guest.id) setHistoryGuest(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete guest.');
    }
  };

  const getGuestStats = (guestId: string) => {
    const stays = bookings.filter((b) => b.guestId === guestId);
    const guestInvoices = invoices.filter((i) => i.guestId === guestId);
    const totalSpend = guestInvoices.reduce((s, inv) => s + inv.grandTotal, 0);
    return { staysCount: stays.length, totalSpend, stays, guestInvoices };
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex-1 min-w-[260px] max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search guests by name, mobile, company, or GSTIN..."
            className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900/15"
          />
        </div>
        <button
          type="button"
          onClick={openAdd}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-slate-900 rounded-md hover:bg-slate-800 whitespace-nowrap shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Guest</span>
        </button>
      </div>

      {error && !modalOpen && (
        <div className="p-3 text-xs font-medium text-rose-800 bg-rose-50 border border-rose-200 rounded-md">
          {error}
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] uppercase tracking-wider text-slate-500">
                <th className="py-3 px-4 font-semibold">Guest Name</th>
                <th className="py-3 px-4 font-semibold">Mobile & Email</th>
                <th className="py-3 px-4 font-semibold">Company Name</th>
                <th className="py-3 px-4 font-semibold">Company GST Number</th>
                <th className="py-3 px-4 font-semibold text-right">Bookings</th>
                <th className="py-3 px-4 font-semibold text-right">Billed Total</th>
                <th className="py-3 px-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredGuests.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500">
                    No guests found matching your filter.
                  </td>
                </tr>
              )}
              {filteredGuests.map((guest) => {
                const { staysCount, totalSpend } = getGuestStats(guest.id);
                return (
                  <tr key={guest.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900">{guest.name}</div>
                      <div className="text-[11px] text-slate-500">
                        {guest.idProofType}
                        {guest.idProofNumber ? ` · ${guest.idProofNumber}` : ''}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-mono font-medium text-slate-900 tabular-nums">
                        {guest.mobile}
                      </div>
                      <div className="text-slate-500">{guest.email || 'No email'}</div>
                    </td>
                    <td className="py-3 px-4">
                      {guest.companyName ? (
                        <span className="inline-flex items-center gap-1.5 text-slate-800 font-medium">
                          <Building2 className="w-3.5 h-3.5 text-slate-400" />
                          <span>{guest.companyName}</span>
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-700">
                      {guest.companyGst || '—'}
                    </td>
                    <td className="py-3 px-4 text-right tabular-nums font-medium text-slate-900">
                      {staysCount}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-semibold tabular-nums text-slate-900">
                      {formatCurrency(totalSpend, sym)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setHistoryGuest(guest)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-50 whitespace-nowrap"
                        >
                          <History className="w-3 h-3" />
                          <span>Booking History</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => openEdit(guest)}
                          title="Edit guest"
                          className="p-1.5 text-slate-500 hover:text-slate-900 border border-slate-200 rounded"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(guest)}
                          title="Delete guest"
                          className="p-1.5 text-slate-400 hover:text-rose-600 border border-slate-200 rounded"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
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

      {/* Add / Edit Guest Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="bg-white border border-slate-200 rounded-xl shadow-xl w-full max-w-xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h3 className="text-base font-semibold text-slate-900">
                {editingGuest ? 'Edit Guest Profile' : 'Add New Guest'}
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4 text-xs">
              {error && (
                <div className="p-2.5 text-rose-800 bg-rose-50 border border-rose-200 rounded">
                  {error}
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Mobile Number *
                  </label>
                  <input
                    type="tel"
                    required
                    value={form.mobile}
                    onChange={(e) => setForm({ ...form, mobile: e.target.value })}
                    className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Company Name
                  </label>
                  <input
                    type="text"
                    value={form.companyName}
                    onChange={(e) => setForm({ ...form, companyName: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Company GST Number (15-char GSTIN)
                  </label>
                  <input
                    type="text"
                    maxLength={15}
                    value={form.companyGst}
                    onChange={(e) =>
                      setForm({ ...form, companyGst: e.target.value.toUpperCase() })
                    }
                    placeholder="27AABCM7492R1Z3"
                    className="w-full px-3 py-2 text-sm font-mono uppercase border border-slate-300 rounded-md"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">
                      ID Proof Type
                    </label>
                    <select
                      value={form.idProofType}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          idProofType: e.target.value as Guest['idProofType'],
                        })
                      }
                      className="w-full px-2.5 py-2 text-sm border border-slate-300 rounded-md bg-white"
                    >
                      <option value="Aadhaar">Aadhaar</option>
                      <option value="Passport">Passport</option>
                      <option value="Driving License">Driving License</option>
                      <option value="Voter ID">Voter ID</option>
                      <option value="Corporate ID">Corporate ID</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">
                      ID Number
                    </label>
                    <input
                      type="text"
                      value={form.idProofNumber}
                      onChange={(e) =>
                        setForm({ ...form, idProofNumber: e.target.value })
                      }
                      className="w-full px-2.5 py-2 text-sm border border-slate-300 rounded-md"
                    />
                  </div>
                </div>
              </div>
              <div>
                <label className="block font-medium text-slate-700 mb-1">Address</label>
                <input
                  type="text"
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
                />
              </div>
              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Preferences / Notes
                </label>
                <input
                  type="text"
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
                />
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="px-4 py-2 text-xs font-medium text-white bg-slate-900 rounded-md hover:bg-slate-800 disabled:opacity-50"
                >
                  {busy ? 'Saving...' : editingGuest ? 'Update Guest' : 'Save Guest'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Booking History Drawer / Modal */}
      {historyGuest && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40">
          <div className="bg-white w-full max-w-2xl h-full border-l border-slate-200 shadow-2xl flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <div>
                <h3 className="text-base font-semibold text-slate-900">
                  {historyGuest.name} — Booking History
                </h3>
                <p className="text-xs text-slate-500 mt-0.5 tabular-nums">
                  {historyGuest.mobile}
                  {historyGuest.companyName ? ` · ${historyGuest.companyName}` : ''}
                  {historyGuest.companyGst ? ` · GSTIN ${historyGuest.companyGst}` : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setHistoryGuest(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-5 flex-1">
              {(() => {
                const { stays, guestInvoices, totalSpend } = getGuestStats(
                  historyGuest.id
                );
                const totalNights = stays.reduce((acc, s) => acc + s.nights, 0);
                return (
                  <>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="p-3 bg-slate-50 border border-slate-200 rounded-md">
                        <div className="text-[11px] text-slate-500">Total Stays</div>
                        <div className="text-lg font-bold text-slate-900 tabular-nums mt-0.5">
                          {stays.length}
                        </div>
                      </div>
                      <div className="p-3 bg-slate-50 border border-slate-200 rounded-md">
                        <div className="text-[11px] text-slate-500">Total Nights</div>
                        <div className="text-lg font-bold text-slate-900 tabular-nums mt-0.5">
                          {totalNights}
                        </div>
                      </div>
                      <div className="p-3 bg-slate-50 border border-slate-200 rounded-md">
                        <div className="text-[11px] text-slate-500">Lifetime Billed</div>
                        <div className="text-lg font-bold font-mono text-slate-900 tabular-nums mt-0.5">
                          {formatCurrency(totalSpend, sym)}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2.5">
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                        Stay & Invoice Ledger
                      </h4>
                      {stays.length === 0 ? (
                        <p className="text-xs text-slate-500 py-6 text-center border border-dashed border-slate-200 rounded-md">
                          No stays recorded for this guest yet.
                        </p>
                      ) : (
                        <div className="border border-slate-200 rounded-md divide-y divide-slate-100">
                          {stays.map((st) => {
                            const rm = rooms.find((r) => r.id === st.roomId);
                            const inv = guestInvoices.find(
                              (i) => i.id === st.invoiceId
                            );
                            return (
                              <div
                                key={st.id}
                                className="p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs"
                              >
                                <div className="space-y-0.5">
                                  <div className="flex items-center gap-2">
                                    <span className="font-mono font-semibold text-slate-900">
                                      {st.bookingCode}
                                    </span>
                                    <span className="text-slate-500">
                                      Room {rm?.number || '—'} ({rm?.type})
                                    </span>
                                  </div>
                                  <div className="text-slate-500 tabular-nums">
                                    {formatStayDateTime(st.checkInDate, st.checkInTime)} →{' '}
                                    {formatStayDateTime(
                                      st.actualCheckOutAt || st.checkOutDate,
                                      st.checkOutTime
                                    )}{' '}
                                    · {st.nights} night{st.nights > 1 ? 's' : ''}
                                  </div>
                                </div>
                                <div className="flex items-center gap-3">
                                  <StatusBadge status={st.status} />
                                  {inv && (
                                    <button
                                      type="button"
                                      onClick={() => onViewInvoice(inv)}
                                      className="px-2.5 py-1 font-mono font-medium text-slate-800 bg-slate-100 hover:bg-slate-200 rounded"
                                    >
                                      {inv.invoiceNumber}
                                      {inv.billNumber ? ` (${inv.billNumber})` : ''} ·{' '}
                                      {formatCurrency(inv.grandTotal, sym)}
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
