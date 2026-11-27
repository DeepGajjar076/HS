import React, { useMemo, useState } from 'react';
import { X, UserPlus, Users, Clock, KeyRound } from 'lucide-react';
import { Booking, GstSettings, Guest, Room } from '../types/hotel';
import {
  computeNightsBetween,
  formatCurrency,
  formatStayDateTime,
  formatTime12h,
  getCurrentTime24h,
  parsePolicyTimeTo24h,
  resolveRoomGstRate,
  toLocalDateInput,
} from '../utils/billing';

interface CheckInModalProps {
  isOpen: boolean;
  initialMode: 'CheckedIn' | 'Held';
  initialRoomId?: string;
  initialCheckInDate?: string;
  rooms: Room[];
  guests: Guest[];
  bookings?: Booking[];
  gstSettings: GstSettings;
  onClose: () => void;
  onCreateGuest: (payload: Omit<Guest, 'id' | 'createdAt'>) => Promise<Guest>;
  onCreateBooking: (payload: {
    guestId: string;
    roomId: string;
    status: 'CheckedIn' | 'Held';
    checkInDate: string;
    checkInTime: string;
    checkOutDate: string;
    checkOutTime: string;
    nights: number;
    adults: number;
    children: number;
    roomRatePerNight: number;
    advancePaid: number;
    discount: number;
    specialRequests: string;
    holdExpiresAt?: string;
  }) => Promise<void>;
}

export const CheckInModal: React.FC<CheckInModalProps> = ({
  isOpen,
  initialMode,
  initialRoomId,
  initialCheckInDate,
  rooms,
  guests,
  bookings = [],
  gstSettings,
  onClose,
  onCreateGuest,
  onCreateBooking,
}) => {
  const selectableRooms = useMemo(
    () =>
      rooms.filter(
        (r) => r.status !== 'Maintenance' || r.id === initialRoomId
      ),
    [rooms, initialRoomId]
  );

  const pendingCheckoutByRoomId = useMemo(() => {
    const map = new Map<string, Booking>();
    for (const b of bookings) {
      if (b.status === 'CheckedIn') {
        map.set(b.roomId, b);
      }
    }
    return map;
  }, [bookings]);

  const todayStr = initialCheckInDate || toLocalDateInput();
  const baseDate = new Date(`${todayStr}T12:00:00`);
  const tomorrowDate = Number.isNaN(baseDate.getTime()) ? new Date() : baseDate;
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const tomorrowStr = toLocalDateInput(tomorrowDate.toISOString());

  const defaultRoom =
    selectableRooms.find((r) => r.id === initialRoomId) ||
    selectableRooms.find(
      (r) => r.status === 'Available' || r.status === 'Housekeeping'
    ) ||
    selectableRooms[0];
  const defaultRoomHasPendingCheckout = Boolean(
    defaultRoom &&
      (pendingCheckoutByRoomId.has(defaultRoom.id) ||
        defaultRoom.status === 'Occupied')
  );
  const [mode, setMode] = useState<'CheckedIn' | 'Held'>(
    defaultRoomHasPendingCheckout ? 'Held' : initialMode
  );
  const [guestMode, setGuestMode] = useState<'existing' | 'new'>(
    guests.length > 0 ? 'existing' : 'new'
  );
  const [guestSearch, setGuestSearch] = useState('');
  const [selectedGuestId, setSelectedGuestId] = useState(guests[0]?.id || '');

  // New guest inline form
  const [newName, setNewName] = useState('');
  const [newMobile, setNewMobile] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newCompanyName, setNewCompanyName] = useState('');
  const [newCompanyGst, setNewCompanyGst] = useState('');
  const [newIdType, setNewIdType] = useState<Guest['idProofType']>('Aadhaar');
  const [newIdNumber, setNewIdNumber] = useState('');

  const [roomId, setRoomId] = useState(defaultRoom?.id || '');
  const [rateOverride, setRateOverride] = useState<string>(
    defaultRoom ? String(defaultRoom.rate) : ''
  );
  const [checkInDate, setCheckInDate] = useState(todayStr);
  const [checkInTime, setCheckInTime] = useState(() =>
    initialMode === 'CheckedIn' && !defaultRoomHasPendingCheckout
      ? getCurrentTime24h()
      : parsePolicyTimeTo24h(gstSettings.checkInPolicyTime, '12:00')
  );
  const [checkOutDate, setCheckOutDate] = useState(tomorrowStr);
  const [checkOutTime, setCheckOutTime] = useState(() =>
    parsePolicyTimeTo24h(gstSettings.checkOutPolicyTime, '11:00')
  );
  const [adults, setAdults] = useState(1);
  const [children, setChildren] = useState(0);
  const [advancePaid, setAdvancePaid] = useState('0');
  const [discount, setDiscount] = useState('0');
  const [holdExpiresAt, setHoldExpiresAt] = useState(`${todayStr}T21:00`);
  const [specialRequests, setSpecialRequests] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const selectedRoom = rooms.find((r) => r.id === roomId);
  const selectedPendingBooking = roomId
    ? pendingCheckoutByRoomId.get(roomId)
    : undefined;
  const selectedRoomHasPendingCheckout = Boolean(
    selectedPendingBooking || selectedRoom?.status === 'Occupied'
  );
  const pendingOccupantGuest = selectedPendingBooking
    ? guests.find((g) => g.id === selectedPendingBooking.guestId)
    : undefined;
  const effectiveMode: 'CheckedIn' | 'Held' =
    selectedRoomHasPendingCheckout ? 'Held' : mode;

  const filteredGuests = guests.filter((g) => {
    const q = guestSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      g.name.toLowerCase().includes(q) ||
      g.mobile.toLowerCase().includes(q) ||
      g.companyName.toLowerCase().includes(q) ||
      g.companyGst.toLowerCase().includes(q)
    );
  });

  const nights = computeNightsBetween(checkInDate, checkOutDate);
  const effectiveRate = Number(rateOverride || selectedRoom?.rate || 0);
  const gstRate = resolveRoomGstRate(
    effectiveRate,
    gstSettings,
    selectedRoom?.gstRateOverride
  );
  const estimatedSubtotal = Math.max(0, nights * effectiveRate - (Number(discount) || 0));
  const estimatedTotal = estimatedSubtotal * (1 + gstRate / 100);

  const handleRoomChange = (nextId: string) => {
    setRoomId(nextId);
    const rm = rooms.find((r) => r.id === nextId);
    if (rm) setRateOverride(String(rm.rate));
    if (
      pendingCheckoutByRoomId.has(nextId) ||
      rm?.status === 'Occupied'
    ) {
      setMode('Held');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!roomId) {
      setError('Please select an available room.');
      return;
    }

    setSubmitting(true);
    try {
      let finalGuestId = selectedGuestId;
      if (guestMode === 'new') {
        if (!newName.trim() || !newMobile.trim()) {
          setError('Guest name and mobile number are required.');
          setSubmitting(false);
          return;
        }
        const created = await onCreateGuest({
          name: newName.trim(),
          mobile: newMobile.trim(),
          email: newEmail.trim(),
          companyName: newCompanyName.trim(),
          companyGst: newCompanyGst.trim().toUpperCase(),
          idProofType: newIdType,
          idProofNumber: newIdNumber.trim(),
          address: '',
          notes: '',
        });
        finalGuestId = created.id;
      } else if (!finalGuestId) {
        setError('Please select a guest or create a new guest.');
        setSubmitting(false);
        return;
      }

      const safeInTime = checkInTime || '12:00';
      const safeOutTime = checkOutTime || '11:00';

      await onCreateBooking({
        guestId: finalGuestId,
        roomId,
        status: effectiveMode,
        checkInDate: new Date(`${checkInDate}T${safeInTime}:00`).toISOString(),
        checkInTime: safeInTime,
        checkOutDate: new Date(`${checkOutDate}T${safeOutTime}:00`).toISOString(),
        checkOutTime: safeOutTime,
        nights,
        adults,
        children,
        roomRatePerNight: effectiveRate,
        advancePaid: Number(advancePaid) || 0,
        discount: Number(discount) || 0,
        specialRequests,
        holdExpiresAt:
          effectiveMode === 'Held' && holdExpiresAt
            ? new Date(holdExpiresAt).toISOString()
            : undefined,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save booking.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-[1px] p-4">
      <div className="bg-white border border-slate-200 rounded-xl shadow-xl w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              {effectiveMode === 'CheckedIn'
                ? 'New Guest Check-In'
                : 'Hold Check-In / Pending Check-Out Queue'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Assign room, verify GST details, and confirm arrival or hold status.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 rounded-md hover:bg-slate-100"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto p-6 space-y-6">
          {/* Action Mode Switch */}
          <div className="space-y-2.5">
            <div className="flex items-center gap-2 p-1 bg-slate-100 rounded-lg w-fit">
              <button
                type="button"
                disabled={selectedRoomHasPendingCheckout}
                onClick={() => setMode('CheckedIn')}
                className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 disabled:opacity-45 disabled:cursor-not-allowed ${
                  effectiveMode === 'CheckedIn'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span>Immediate Check-In</span>
              </button>
              <button
                type="button"
                onClick={() => setMode('Held')}
                className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  effectiveMode === 'Held'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>Hold Check-In (Reserve)</span>
              </button>
            </div>

            {selectedRoomHasPendingCheckout && selectedRoom && (
              <div className="p-3 text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-md">
                <strong>Room {selectedRoom.number}</strong> currently has a pending check-out
                {pendingOccupantGuest
                  ? ` (${pendingOccupantGuest.name}${selectedPendingBooking ? `, scheduled out ${formatStayDateTime(selectedPendingBooking.checkOutDate, selectedPendingBooking.checkOutTime)}` : ''})`
                  : ''}
                . This new check-in will automatically be saved under <strong>Held Check-Ins</strong> until checkout completes.
              </div>
            )}
          </div>

          {error && (
            <div className="p-3 text-xs font-medium text-rose-800 bg-rose-50 border border-rose-200 rounded-md">
              {error}
            </div>
          )}

          {/* Guest Selection / Creation */}
          <div className="space-y-3 pt-2 border-t border-slate-100">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                1. Guest Profile & Company GST
              </label>
              <div className="flex items-center gap-1 p-0.5 bg-slate-100 rounded-md">
                <button
                  type="button"
                  onClick={() => setGuestMode('existing')}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
                    guestMode === 'existing'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600'
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>Existing Guest</span>
                </button>
                <button
                  type="button"
                  onClick={() => setGuestMode('new')}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
                    guestMode === 'new'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600'
                  }`}
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>New Guest</span>
                </button>
              </div>
            </div>

            {guestMode === 'existing' ? (
              <div className="space-y-2.5">
                <input
                  type="text"
                  value={guestSearch}
                  onChange={(e) => setGuestSearch(e.target.value)}
                  placeholder="Search guest by name, mobile, company, or GSTIN..."
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900/15 focus:border-slate-900"
                />
                <select
                  value={selectedGuestId}
                  onChange={(e) => setSelectedGuestId(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/15 focus:border-slate-900"
                >
                  {filteredGuests.length === 0 && (
                    <option value="">No matching guest found — switch to New Guest</option>
                  )}
                  {filteredGuests.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name} · {g.mobile}
                      {g.companyName ? ` · ${g.companyName}` : ''}
                      {g.companyGst ? ` (${g.companyGst})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="e.g. Karthik Subramanian"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Mobile Number *
                  </label>
                  <input
                    type="tel"
                    value={newMobile}
                    onChange={(e) => setNewMobile(e.target.value)}
                    placeholder="e.g. 9820112233"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Email Address (for Receipts)
                  </label>
                  <input
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="guest@company.com"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Company Name
                  </label>
                  <input
                    type="text"
                    value={newCompanyName}
                    onChange={(e) => setNewCompanyName(e.target.value)}
                    placeholder="Optional B2B entity"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Company GST Number (GSTIN)
                  </label>
                  <input
                    type="text"
                    value={newCompanyGst}
                    onChange={(e) => setNewCompanyGst(e.target.value.toUpperCase())}
                    placeholder="27AABCU9603R1ZM"
                    maxLength={15}
                    className="w-full px-3 py-2 text-sm font-mono uppercase border border-slate-300 rounded-md"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      ID Type
                    </label>
                    <select
                      value={newIdType}
                      onChange={(e) =>
                        setNewIdType(e.target.value as Guest['idProofType'])
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
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      ID Number
                    </label>
                    <input
                      type="text"
                      value={newIdNumber}
                      onChange={(e) => setNewIdNumber(e.target.value)}
                      placeholder="ID ref"
                      className="w-full px-2.5 py-2 text-sm border border-slate-300 rounded-md"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Room & Dates */}
          <div className="space-y-3 pt-4 border-t border-slate-200">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
              2. Room Assignment & Tariff
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Room *
                </label>
                <select
                  value={roomId}
                  onChange={(e) => handleRoomChange(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md bg-white"
                >
                  {selectableRooms.length === 0 && (
                    <option value="">No rooms currently selectable</option>
                  )}
                  {selectableRooms.map((r) => {
                    const activeGuestBooking = pendingCheckoutByRoomId.get(r.id);
                    const activeGuest = activeGuestBooking
                      ? guests.find((g) => g.id === activeGuestBooking.guestId)
                      : undefined;
                    const statusSuffix =
                      activeGuestBooking || r.status === 'Occupied'
                        ? `Pending Check-Out${activeGuest ? `: ${activeGuest.name}` : ''}`
                        : r.status;
                    return (
                      <option key={r.id} value={r.id}>
                        Room {r.number} · {r.type} · Floor {r.floor} ·{' '}
                        {formatCurrency(r.rate, gstSettings.currencySymbol)}/night ({statusSuffix})
                      </option>
                    );
                  })}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Rate / Night ({gstSettings.currencySymbol})
                </label>
                <input
                  type="number"
                  min={0}
                  value={rateOverride}
                  onChange={(e) => setRateOverride(e.target.value)}
                  className="w-full px-3 py-2 text-sm font-mono tabular-nums border border-slate-300 rounded-md"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Check-In Date
                </label>
                <input
                  type="date"
                  value={checkInDate}
                  onChange={(e) => setCheckInDate(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md tabular-nums"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Check-In Time
                </label>
                <input
                  type="time"
                  value={checkInTime}
                  onChange={(e) => setCheckInTime(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md tabular-nums"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Check-Out Date
                </label>
                <input
                  type="date"
                  value={checkOutDate}
                  min={checkInDate}
                  onChange={(e) => setCheckOutDate(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md tabular-nums"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Check-Out Time
                </label>
                <input
                  type="time"
                  value={checkOutTime}
                  onChange={(e) => setCheckOutTime(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md tabular-nums"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Adults
                </label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={adults}
                  onChange={(e) => setAdults(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md tabular-nums"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Children
                </label>
                <input
                  type="number"
                  min={0}
                  max={10}
                  value={children}
                  onChange={(e) => setChildren(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md tabular-nums"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Advance Paid ({gstSettings.currencySymbol})
                </label>
                <input
                  type="number"
                  min={0}
                  value={advancePaid}
                  onChange={(e) => setAdvancePaid(e.target.value)}
                  className="w-full px-3 py-2 text-sm font-mono tabular-nums border border-slate-300 rounded-md"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Discount ({gstSettings.currencySymbol})
                </label>
                <input
                  type="number"
                  min={0}
                  value={discount}
                  onChange={(e) => setDiscount(e.target.value)}
                  className="w-full px-3 py-2 text-sm font-mono tabular-nums border border-slate-300 rounded-md"
                />
              </div>
            </div>

            {effectiveMode === 'Held' && (
              <div className="sm:max-w-xs">
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Hold Until
                </label>
                <input
                  type="datetime-local"
                  value={holdExpiresAt}
                  onChange={(e) => setHoldExpiresAt(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md tabular-nums"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Special Requests / Arrival Notes
              </label>
              <input
                type="text"
                value={specialRequests}
                onChange={(e) => setSpecialRequests(e.target.value)}
                placeholder="Early breakfast, airport pickup, extra bed..."
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
              />
            </div>
          </div>

          {/* Live Estimate Strip */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-slate-50 border border-slate-200 rounded-lg text-xs">
            <div className="space-x-2 text-slate-600 tabular-nums">
              <span>{nights} Night{nights > 1 ? 's' : ''}</span>
              <span>·</span>
              <span>
                In {formatTime12h(checkInTime) || '12:00 PM'} → Out{' '}
                {formatTime12h(checkOutTime) || '11:00 AM'}
              </span>
              <span>·</span>
              <span>
                GST {gstSettings.gstEnabled ? `${gstRate}%` : 'Disabled (0%)'}
              </span>
              <span>·</span>
              <span>{gstSettings.taxRegime === 'IGST' ? 'IGST' : 'CGST + SGST'}</span>
            </div>
            <div className="font-semibold text-slate-900 tabular-nums">
              Est. Stay Total (incl. GST):{' '}
              <span className="font-mono text-sm">
                {formatCurrency(estimatedTotal, gstSettings.currencySymbol)}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 whitespace-nowrap shrink-0"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || selectableRooms.length === 0}
              className="px-4 py-2 text-xs font-medium text-white bg-slate-900 rounded-md hover:bg-slate-800 disabled:opacity-50 whitespace-nowrap shrink-0"
            >
              {submitting
                ? 'Saving...'
                : effectiveMode === 'CheckedIn'
                  ? 'Confirm Check-In'
                  : selectedRoomHasPendingCheckout
                    ? 'Save Hold (Pending Check-Out)'
                    : 'Place Room on Hold'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
