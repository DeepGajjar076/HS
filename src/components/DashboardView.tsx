import React, { useMemo, useState } from 'react';
import {
  BedDouble,
  CalendarCheck,
  ChevronLeft,
  ChevronRight,
  Clock,
  KeyRound,
  ReceiptText,
  Sparkles,
  Trash2,
} from 'lucide-react';
import {
  Booking,
  GstSettings,
  Guest,
  Invoice,
  Room,
  RoomStatus,
} from '../types/hotel';
import {
  computeBookingFolio,
  formatCurrency,
  formatDateDisplay,
  formatStayDateTime,
  resolveRoomGstRate,
  toLocalDateInput,
} from '../utils/billing';
import { StatusBadge } from './StatusBadge';

interface DashboardViewProps {
  rooms: Room[];
  guests: Guest[];
  bookings: Booking[];
  invoices: Invoice[];
  gstSettings: GstSettings;
  onOpenCheckIn: (mode: 'CheckedIn' | 'Held', roomId?: string, date?: string) => void;
  onOpenFolio: (booking: Booking) => void;
  onViewInvoice: (invoice: Invoice) => void;
  onConvertHoldToCheckIn: (bookingId: string) => Promise<void>;
  onDeleteBooking: (bookingId: string) => Promise<void>;
  onUpdateRoomStatus: (roomId: string, status: RoomStatus) => Promise<void>;
}

const CHART_DAYS = 16;

function addDaysIso(baseIso: string, offsetDays: number): string {
  const d = new Date(`${baseIso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return baseIso;
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatShortChartDate(dayIso: string): string {
  const [, m, d] = dayIso.split('-');
  const yy = dayIso.slice(2, 4);
  return `${Number(d)}.${Number(m)}.${yy}`;
}

function formatShortWeekday(dayIso: string): string {
  const dt = new Date(`${dayIso}T12:00:00`);
  if (Number.isNaN(dt.getTime())) return '';
  return dt.toLocaleDateString('en-IN', { weekday: 'short' });
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  rooms,
  guests,
  bookings,
  invoices,
  gstSettings,
  onOpenCheckIn,
  onOpenFolio,
  onViewInvoice,
  onConvertHoldToCheckIn,
  onDeleteBooking,
  onUpdateRoomStatus,
}) => {
  const [floorFilter, setFloorFilter] = useState<'all' | number>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | RoomStatus>('all');

  const todayStr = toLocalDateInput();
  const [chartStartDate, setChartStartDate] = useState(() => addDaysIso(todayStr, -3));
  const [checkAvailStart, setCheckAvailStart] = useState(todayStr);
  const [checkAvailEnd, setCheckAvailEnd] = useState(() => addDaysIso(todayStr, 1));

  const sym = gstSettings.currencySymbol || '₹';

  const activeBookings = useMemo(
    () => bookings.filter((b) => b.status === 'CheckedIn' || b.status === 'Held'),
    [bookings]
  );

  const stats = useMemo(() => {
    const available = rooms.filter((r) => r.status === 'Available').length;
    const occupied = rooms.filter((r) => r.status === 'Occupied').length;
    const held = rooms.filter((r) => r.status === 'Held').length;
    const maintenance = rooms.filter((r) => r.status === 'Maintenance').length;
    const housekeeping = rooms.filter((r) => r.status === 'Housekeeping').length;

    const activeFolioTotal = activeBookings
      .filter((b) => b.status === 'CheckedIn')
      .reduce((acc, b) => {
        const rm = rooms.find((r) => r.id === b.roomId);
        return acc + computeBookingFolio(b, rm, gstSettings).grandTotal;
      }, 0);

    const occupancyPct =
      rooms.length > 0 ? Math.round(((occupied + held) / rooms.length) * 100) : 0;

    return {
      available,
      occupied,
      held,
      maintenance,
      housekeeping,
      activeFolioTotal,
      occupancyPct,
    };
  }, [rooms, activeBookings, gstSettings]);

  const floors = useMemo(
    () => Array.from(new Set(rooms.map((r) => r.floor))).sort((a, b) => a - b),
    [rooms]
  );

  const chartDays = useMemo(
    () => Array.from({ length: CHART_DAYS }, (_, i) => addDaysIso(chartStartDate, i)),
    [chartStartDate]
  );

  // Build fast lookup for room + date cells:
  // 1) Green cell: Bill / Invoice created for room & date
  // 2) Gray cell: Active Check-In / Held / Pending bill / Maintenance on that date
  // 3) White cell: Available
  type CellState =
    | { kind: 'billed'; label: string; fullName: string; invoice: Invoice }
    | { kind: 'pending'; label: string; fullName: string; booking?: Booking; reason: 'CheckedIn' | 'Held' | 'Maintenance' }
    | { kind: 'available' };

  const roomDayMap = useMemo(() => {
    const map = new Map<string, CellState>();

    // Populate Billed Invoices first (room bills only)
    for (const inv of invoices) {
      if (inv.invoiceType === 'food' || inv.invoiceNumber.startsWith('FNB-')) {
        continue;
      }
      const inDay = toLocalDateInput(inv.checkInDate);
      const outDay = toLocalDateInput(inv.checkOutDate);
      const issuedDay = toLocalDateInput(inv.issuedAt);
      const lastStayDay = outDay > inDay ? addDaysIso(outDay, -1) : inDay;
      const guestShort = (inv.guestName || 'GUEST').toUpperCase();

      const datesToMark = new Set<string>();
      let cur = inDay;
      let guard = 0;
      while (cur <= lastStayDay && guard < 60) {
        datesToMark.add(cur);
        cur = addDaysIso(cur, 1);
        guard++;
      }
      if (issuedDay) {
        datesToMark.add(issuedDay);
      }

      for (const day of datesToMark) {
        map.set(`${inv.roomNumber}::${day}`, {
          kind: 'billed',
          label: guestShort,
          fullName: inv.guestName,
          invoice: inv,
        });
      }
    }

    // Overlay Active Check-Ins & Held reservations (unbilled -> Gray cell)
    for (const bk of activeBookings) {
      const rm = rooms.find((r) => r.id === bk.roomId);
      if (!rm) continue;
      const guest = guests.find((g) => g.id === bk.guestId);
      const inDay = toLocalDateInput(bk.checkInDate);
      const outDay = toLocalDateInput(bk.checkOutDate);
      const lastDay = outDay > inDay ? addDaysIso(outDay, -1) : inDay;
      const guestName = guest?.name || 'Guest';
      const label =
        bk.status === 'Held'
          ? `${guestName.toUpperCase()} (HOLD)`
          : guestName.toUpperCase();

      let cur = inDay;
      let guard = 0;
      while (cur <= lastDay && guard < 60) {
        map.set(`${rm.number}::${cur}`, {
          kind: 'pending',
          label,
          fullName: guestName,
          booking: bk,
          reason: bk.status === 'Held' ? 'Held' : 'CheckedIn',
        });
        cur = addDaysIso(cur, 1);
        guard++;
      }
    }

    // Overlay Maintenance rooms on today if not already occupied/billed
    for (const rm of rooms) {
      if (rm.status === 'Maintenance') {
        const key = `${rm.number}::${todayStr}`;
        if (!map.has(key)) {
          map.set(key, {
            kind: 'pending',
            label: 'MAINT.',
            fullName: 'Under Maintenance',
            reason: 'Maintenance',
          });
        }
      }
    }

    return map;
  }, [invoices, activeBookings, rooms, guests, todayStr]);

  // Check date-range conflicts for availability checker
  const conflictedRoomIds = useMemo(() => {
    const startMs = new Date(`${checkAvailStart}T00:00:00`).getTime();
    const endMs = new Date(`${checkAvailEnd}T23:59:59`).getTime();
    const set = new Set<string>();
    for (const b of activeBookings) {
      const bIn = new Date(b.checkInDate).getTime();
      const bOut = new Date(b.checkOutDate).getTime();
      if (bIn <= endMs && bOut >= startMs) {
        set.add(b.roomId);
      }
    }
    return set;
  }, [activeBookings, checkAvailStart, checkAvailEnd]);

  const visibleFloors = useMemo(
    () => (floorFilter === 'all' ? floors : floors.filter((f) => f === floorFilter)),
    [floors, floorFilter]
  );

  const filteredRooms = useMemo(
    () =>
      rooms.filter((r) => {
        if (floorFilter !== 'all' && r.floor !== floorFilter) return false;
        if (statusFilter !== 'all' && r.status !== statusFilter) return false;
        return true;
      }),
    [rooms, floorFilter, statusFilter]
  );

  const dateAvailableCount = rooms.filter(
    (r) => r.status !== 'Maintenance' && !conflictedRoomIds.has(r.id)
  ).length;

  return (
    <div className="space-y-6">
      {/* Top KPI Strip: Available, Occupied, Held Check-Ins, Under Maintenance, Active Folio Value */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="text-xs font-medium text-slate-500">Available Rooms</div>
          <div className="mt-1.5 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-emerald-700 tabular-nums">
              {stats.available}
            </span>
            <span className="text-xs text-slate-500 tabular-nums">
              of {rooms.length} rooms
            </span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="text-xs font-medium text-slate-500">Occupied Rooms</div>
          <div className="mt-1.5 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-blue-700 tabular-nums">
              {stats.occupied}
            </span>
            <span className="text-xs text-slate-500 tabular-nums">
              {stats.occupancyPct}% committed
            </span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="text-xs font-medium text-slate-500">Held Check-Ins</div>
          <div className="mt-1.5 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-amber-700 tabular-nums">
              {stats.held}
            </span>
            <span className="text-xs text-slate-500">awaiting arrival</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="text-xs font-medium text-slate-500">Under Maintenance</div>
          <div className="mt-1.5 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-slate-800 tabular-nums">
              {stats.maintenance}
            </span>
            <span className="text-xs text-slate-500 tabular-nums">
              {stats.housekeeping > 0
                ? `+ ${stats.housekeeping} cleaning`
                : 'room service hold'}
            </span>
          </div>
        </div>

        <div className="col-span-2 md:col-span-1 bg-white border border-slate-200 rounded-lg p-4">
          <div className="text-xs font-medium text-slate-500">Active Folio Value</div>
          <div className="mt-1.5">
            <span className="text-xl font-bold font-mono text-slate-900 tabular-nums">
              {formatCurrency(stats.activeFolioTotal, sym)}
            </span>
          </div>
        </div>
      </div>

      {/* Floor Filter + Window Availability Controls */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-md">
            <button
              type="button"
              onClick={() => setFloorFilter('all')}
              className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
                floorFilter === 'all'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All Floors
            </button>
            {floors.map((fl) => (
              <button
                key={fl}
                type="button"
                onClick={() => setFloorFilter(fl)}
                className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
                  floorFilter === fl
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Floor {fl}
              </button>
            ))}
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'all' | RoomStatus)}
            className="px-3 py-1.5 text-xs font-medium border border-slate-300 rounded-md bg-white text-slate-700"
          >
            <option value="all">All Statuses</option>
            <option value="Available">Available</option>
            <option value="Occupied">Occupied</option>
            <option value="Held">Held</option>
            <option value="Housekeeping">Housekeeping</option>
            <option value="Maintenance">Under Maintenance</option>
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="font-medium text-slate-600 inline-flex items-center gap-1.5">
            <CalendarCheck className="w-3.5 h-3.5 text-slate-400" />
            <span>Availability Window:</span>
          </span>
          <input
            type="date"
            value={checkAvailStart}
            onChange={(e) => setCheckAvailStart(e.target.value)}
            className="px-2 py-1 border border-slate-300 rounded text-xs tabular-nums"
          />
          <span className="text-slate-400">to</span>
          <input
            type="date"
            value={checkAvailEnd}
            min={checkAvailStart}
            onChange={(e) => setCheckAvailEnd(e.target.value)}
            className="px-2 py-1 border border-slate-300 rounded text-xs tabular-nums"
          />
          <span className="font-semibold text-emerald-700 tabular-nums ml-1">
            {dateAvailableCount} free
          </span>
        </div>
      </div>

      {/* Spreadsheet-Style Room & Date Availability Chart */}
      <div className="bg-white border border-slate-300 rounded-lg overflow-hidden shadow-xs">
        <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-4">
            <h2 className="text-sm font-semibold text-slate-900">
              Room &amp; Date Availability Chart
            </h2>
            <div className="flex flex-wrap items-center gap-3 text-[11px] font-medium text-slate-700">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-3.5 h-3.5 rounded-xs bg-emerald-200 border border-emerald-600 inline-block" />
                <span>Bill Created (Guest Name)</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-3.5 h-3.5 rounded-xs bg-slate-300 border border-slate-500 inline-block" />
                <span>Occupied / Hold / Unbilled / Maint.</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-3.5 h-3.5 rounded-xs bg-white border border-slate-400 inline-block" />
                <span>Available</span>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-xs">
            <button
              type="button"
              onClick={() => setChartStartDate((prev) => addDaysIso(prev, -7))}
              className="inline-flex items-center gap-1 px-2 py-1 font-medium text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-100"
              title="Previous 7 days"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>7d</span>
            </button>
            <input
              type="date"
              value={chartStartDate}
              onChange={(e) => setChartStartDate(e.target.value)}
              className="px-2 py-1 border border-slate-300 rounded bg-white text-xs tabular-nums"
              aria-label="Chart start date"
            />
            <button
              type="button"
              onClick={() => setChartStartDate(addDaysIso(todayStr, -3))}
              className="px-2.5 py-1 font-medium text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-100"
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => setChartStartDate((prev) => addDaysIso(prev, 7))}
              className="inline-flex items-center gap-1 px-2 py-1 font-medium text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-100"
              title="Next 7 days"
            >
              <span>7d</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[11px] select-none">
            <thead>
              <tr className="bg-slate-100 text-slate-900 font-bold">
                <th className="sticky left-0 z-20 bg-slate-200 border-r border-b border-slate-400 px-2.5 py-2 text-center w-20 min-w-[72px]">
                  ROOM
                </th>
                {chartDays.map((dayIso) => {
                  const isToday = dayIso === todayStr;
                  return (
                    <th
                      key={dayIso}
                      className={`border-r border-b border-slate-400 px-1.5 py-1.5 text-center min-w-[84px] tabular-nums ${
                        isToday ? 'bg-amber-100 text-slate-950' : 'bg-slate-100'
                      }`}
                    >
                      <div className="font-bold">{formatShortChartDate(dayIso)}</div>
                      <div className="text-[9px] font-medium text-slate-500 uppercase">
                        {isToday ? 'Today' : formatShortWeekday(dayIso)}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {visibleFloors.map((floorNum) => {
                const floorRooms = rooms
                  .filter((r) => r.floor === floorNum)
                  .sort((a, b) =>
                    a.number.localeCompare(b.number, undefined, { numeric: true })
                  );
                if (floorRooms.length === 0) return null;

                return (
                  <React.Fragment key={floorNum}>
                    {/* Floor Group Banner Row */}
                    <tr>
                      <td
                        colSpan={chartDays.length + 1}
                        className="bg-slate-500 text-white font-bold text-[11px] tracking-wider uppercase text-center py-1 border-b border-slate-500"
                      >
                        FLOOR {floorNum} ROOMS
                      </td>
                    </tr>

                    {floorRooms.map((rm) => (
                      <tr key={rm.id} className="hover:bg-slate-50/40">
                        <td
                          className="sticky left-0 z-10 bg-slate-50 border-r border-b border-slate-400 px-2 py-1.5 text-center font-mono font-bold text-slate-900"
                          title={`Room ${rm.number} (${rm.type})`}
                        >
                          {rm.number}
                        </td>
                        {chartDays.map((dayIso) => {
                          const cell =
                            roomDayMap.get(`${rm.number}::${dayIso}`) ||
                            ({ kind: 'available' } as const);

                          if (cell.kind === 'billed') {
                            return (
                              <td
                                key={dayIso}
                                onClick={() => onViewInvoice(cell.invoice)}
                                title={`Bill ${cell.invoice.invoiceNumber} — ${cell.fullName} (Click to view/print)`}
                                className="border-r border-b border-slate-400 px-1.5 py-1.5 bg-emerald-200/85 hover:bg-emerald-300/90 text-emerald-950 font-bold uppercase tracking-tight cursor-pointer max-w-[100px] truncate"
                              >
                                {cell.label}
                              </td>
                            );
                          }

                          if (cell.kind === 'pending') {
                            return (
                              <td
                                key={dayIso}
                                onClick={() => {
                                  if (cell.booking?.status === 'CheckedIn') {
                                    onOpenFolio(cell.booking);
                                  } else if (cell.booking?.status === 'Held') {
                                    void onConvertHoldToCheckIn(cell.booking.id);
                                  }
                                }}
                                title={
                                  cell.booking
                                    ? `${cell.fullName} (${cell.reason}) — Click to manage`
                                    : cell.fullName
                                }
                                className="border-r border-b border-slate-400 px-1.5 py-1.5 bg-slate-300/85 hover:bg-slate-400/70 text-slate-900 font-bold uppercase tracking-tight cursor-pointer max-w-[100px] truncate"
                              >
                                {cell.label}
                              </td>
                            );
                          }

                          return (
                            <td
                              key={dayIso}
                              onClick={() => onOpenCheckIn('CheckedIn', rm.id, dayIso)}
                              title={`Room ${rm.number} available on ${formatDateDisplay(dayIso)} — Click to Check In`}
                              className="border-r border-b border-slate-300 px-1.5 py-1.5 bg-white hover:bg-emerald-50/70 cursor-pointer"
                            />
                          );
                        })}
                      </tr>
                    ))}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Floor-by-Floor Room Matrix with Availability Dates (All Floors / Floor 1 / Floor 2 / Floor 3) */}
      <div className="space-y-6">
        {visibleFloors.map((floorNum) => {
          const floorRooms = filteredRooms
            .filter((r) => r.floor === floorNum)
            .sort((a, b) =>
              a.number.localeCompare(b.number, undefined, { numeric: true })
            );
          if (floorRooms.length === 0) return null;

          const floorAvail = floorRooms.filter((r) => r.status === 'Available').length;
          const floorOcc = floorRooms.filter((r) => r.status === 'Occupied').length;
          const floorHeld = floorRooms.filter((r) => r.status === 'Held').length;

          return (
            <section key={floorNum} className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-200">
                <div className="flex items-baseline gap-2.5">
                  <h3 className="text-sm font-bold text-slate-900">
                    Floor {floorNum} Rooms
                  </h3>
                  <span className="text-xs text-slate-500 tabular-nums">
                    {floorRooms.length} room{floorRooms.length > 1 ? 's' : ''}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-xs tabular-nums">
                  <span className="text-emerald-700 font-medium">
                    {floorAvail} Available
                  </span>
                  <span className="text-blue-700 font-medium">
                    {floorOcc} Occupied
                  </span>
                  {floorHeld > 0 && (
                    <span className="text-amber-700 font-medium">
                      {floorHeld} Held
                    </span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
                {floorRooms.map((room) => {
                  const booking = activeBookings.find((b) => b.roomId === room.id);
                  const guest = booking
                    ? guests.find((g) => g.id === booking.guestId)
                    : undefined;
                  const gstRate = resolveRoomGstRate(
                    room.rate,
                    gstSettings,
                    room.gstRateOverride
                  );
                  const folio = booking
                    ? computeBookingFolio(booking, room, gstSettings)
                    : null;
                  const isWindowFree =
                    room.status !== 'Maintenance' && !conflictedRoomIds.has(room.id);

                  return (
                    <div
                      key={room.id}
                      className="bg-white border border-slate-200 rounded-lg p-4 flex flex-col justify-between gap-3 hover:border-slate-300 transition-colors"
                    >
                      <div className="space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-baseline gap-2">
                              <span className="font-mono text-base font-bold text-slate-900 tabular-nums">
                                {room.number}
                              </span>
                              <span className="text-xs font-medium text-slate-500">
                                {room.type}
                              </span>
                            </div>
                            <div className="text-xs text-slate-500 mt-0.5 tabular-nums">
                              Floor {room.floor} · {formatCurrency(room.rate, sym)}/nt ·{' '}
                              {gstSettings.gstEnabled ? `${gstRate}% GST` : 'No GST'}
                            </div>
                          </div>
                          <StatusBadge status={room.status} />
                        </div>

                        {booking && guest ? (
                          <div className="pt-2 border-t border-slate-100 text-xs space-y-1">
                            <div className="font-semibold text-slate-900 truncate">
                              {guest.name}
                            </div>
                            <div className="text-slate-500 tabular-nums">
                              {guest.mobile}
                              {guest.companyName ? ` · ${guest.companyName}` : ''}
                            </div>
                            <div className="flex items-center justify-between text-slate-600 pt-1 tabular-nums">
                              <span className="truncate">
                                Free from:{' '}
                                {formatStayDateTime(
                                  booking.checkOutDate,
                                  booking.checkOutTime
                                )}
                              </span>
                              {folio && (
                                <span className="font-mono font-semibold text-slate-900 shrink-0 ml-2">
                                  {formatCurrency(folio.grandTotal, sym)}
                                </span>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div className="pt-2 border-t border-slate-100 text-xs text-slate-500">
                            {room.amenities.slice(0, 3).join(' · ')}
                            <div className="mt-1 text-[11px] text-slate-500 tabular-nums">
                              {formatDateDisplay(checkAvailStart)} –{' '}
                              {formatDateDisplay(checkAvailEnd)}:{' '}
                              <span
                                className={
                                  isWindowFree
                                    ? 'text-emerald-700 font-semibold'
                                    : 'text-amber-700 font-semibold'
                                }
                              >
                                {room.status === 'Maintenance'
                                  ? 'Under Maintenance'
                                  : isWindowFree
                                    ? 'Available'
                                    : 'Booked in window'}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Room Card Action Bar */}
                      <div className="pt-2 border-t border-slate-100 flex items-center gap-2">
                        {room.status === 'Available' && (
                          <>
                            <button
                              type="button"
                              onClick={() => onOpenCheckIn('CheckedIn', room.id)}
                              className="flex-1 inline-flex items-center justify-center gap-1 px-2.5 py-1.5 text-xs font-medium text-white bg-slate-900 rounded hover:bg-slate-800 whitespace-nowrap"
                            >
                              <KeyRound className="w-3.5 h-3.5" />
                              <span>Check In</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => onOpenCheckIn('Held', room.id)}
                              className="inline-flex items-center justify-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-50 whitespace-nowrap"
                            >
                              <Clock className="w-3.5 h-3.5" />
                              <span>Hold</span>
                            </button>
                          </>
                        )}

                        {room.status === 'Occupied' && booking && (
                          <>
                            <button
                              type="button"
                              onClick={() => onOpenFolio(booking)}
                              className="flex-1 inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-white bg-blue-700 rounded hover:bg-blue-800 whitespace-nowrap"
                            >
                              <ReceiptText className="w-3.5 h-3.5" />
                              <span>Folio / Checkout</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => onDeleteBooking(booking.id)}
                              title="Delete check-in"
                              className="p-1.5 text-slate-400 hover:text-rose-600 border border-slate-200 rounded hover:border-rose-200"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}

                        {room.status === 'Held' && booking && (
                          <>
                            <button
                              type="button"
                              onClick={() => onConvertHoldToCheckIn(booking.id)}
                              className="flex-1 inline-flex items-center justify-center gap-1 px-2.5 py-1.5 text-xs font-medium text-white bg-slate-900 rounded hover:bg-slate-800 whitespace-nowrap"
                            >
                              <KeyRound className="w-3.5 h-3.5" />
                              <span>Convert Check-In</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => onDeleteBooking(booking.id)}
                              title="Release / Delete held check-in"
                              className="p-1.5 text-slate-400 hover:text-rose-600 border border-slate-200 rounded hover:border-rose-200"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}

                        {room.status === 'Housekeeping' && (
                          <button
                            type="button"
                            onClick={() => onUpdateRoomStatus(room.id, 'Available')}
                            className="flex-1 inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-emerald-800 bg-emerald-50 border border-emerald-200 rounded hover:bg-emerald-100 whitespace-nowrap"
                          >
                            <Sparkles className="w-3.5 h-3.5" />
                            <span>Mark Clean &amp; Ready</span>
                          </button>
                        )}

                        {room.status === 'Maintenance' && (
                          <button
                            type="button"
                            onClick={() => onUpdateRoomStatus(room.id, 'Available')}
                            className="flex-1 inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-50 whitespace-nowrap"
                          >
                            <BedDouble className="w-3.5 h-3.5" />
                            <span>Restore to Service</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
};
