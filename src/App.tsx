import React, { useEffect, useState } from 'react';
import {
  BedDouble,
  Building2,
  CalendarRange,
  CheckCircle2,
  Clock,
  LayoutDashboard,
  Menu,
  Plus,
  ReceiptIndianRupee,
  ReceiptText,
  UserCheck,
  Users,
  UtensilsCrossed,
  X,
} from 'lucide-react';
import { api } from './api/client';
import { BillingGstView } from './components/BillingGstView';
import { BookingsView } from './components/BookingsView';
import { CheckInModal } from './components/CheckInModal';
import { DashboardView } from './components/DashboardView';
import { FolioCheckoutModal } from './components/FolioCheckoutModal';
import { FoodBillingModal } from './components/FoodBillingModal';
import { FoodBillingView } from './components/FoodBillingView';
import { FoodMenuView } from './components/FoodMenuView';
import { GuestsView } from './components/GuestsView';
import { HotelSettingsView } from './components/HotelSettingsView';
import { InvoicePreview } from './components/InvoicePreview';
import { RoomsView } from './components/RoomsView';
import { StaffView } from './components/StaffView';
import {
  Booking,
  EmailReceiptLog,
  ExtraChargeItem,
  FoodItem,
  GstSettings,
  Guest,
  Invoice,
  InvoiceTheme,
  InvoiceThemePreset,
  MobileInvoiceLog,
  PaymentMethod,
  Room,
  RoomStatus,
  StaffMember,
} from './types/hotel';

type NavSection =
  | 'dashboard'
  | 'bookings'
  | 'guests'
  | 'rooms'
  | 'food'
  | 'foodBilling'
  | 'staff'
  | 'billing'
  | 'hotel';

const NAV_ITEMS: { id: NavSection; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'dashboard', label: 'Availability Desk', icon: LayoutDashboard },
  { id: 'bookings', label: 'Check-Ins & History', icon: CalendarRange },
  { id: 'guests', label: 'Guests & GSTIN', icon: Users },
  { id: 'rooms', label: 'Rooms & Tariffs', icon: BedDouble },
  { id: 'food', label: 'Food & Room Service', icon: UtensilsCrossed },
  { id: 'foodBilling', label: 'Food Billing', icon: ReceiptText },
  { id: 'staff', label: 'Staff & Shifts', icon: UserCheck },
  { id: 'billing', label: 'Billing, GST & Themes', icon: ReceiptIndianRupee },
  { id: 'hotel', label: 'Hotel & Policy', icon: Building2 },
];

export default function App() {
  const [section, setSection] = useState<NavSection>('dashboard');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [rooms, setRooms] = useState<Room[]>([]);
  const [guests, setGuests] = useState<Guest[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [foodMenu, setFoodMenu] = useState<FoodItem[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [emailLogs, setEmailLogs] = useState<EmailReceiptLog[]>([]);
  const [mobileLogs, setMobileLogs] = useState<MobileInvoiceLog[]>([]);
  const [gstSettings, setGstSettings] = useState<GstSettings | null>(null);
  const [invoiceTheme, setInvoiceTheme] = useState<InvoiceTheme | null>(null);
  const [smtpConfigured, setSmtpConfigured] = useState(false);
  const [smsConfigured, setSmsConfigured] = useState(false);

  // Modals
  const [checkInModal, setCheckInModal] = useState<{
    open: boolean;
    mode: 'CheckedIn' | 'Held';
    roomId?: string;
    date?: string;
  }>({ open: false, mode: 'CheckedIn' });
  const [folioBookingId, setFolioBookingId] = useState<string | null>(null);
  const [foodBillingModalOpen, setFoodBillingModalOpen] = useState(false);
  const [viewingInvoice, setViewingInvoice] = useState<Invoice | null>(null);
  const [autoPrintInvoice, setAutoPrintInvoice] = useState(false);
  const [sendingInvoiceEmail, setSendingInvoiceEmail] = useState(false);
  const [sendingInvoiceMobile, setSendingInvoiceMobile] = useState(false);
  const [toast, setToast] = useState<string>('');

  const openInvoiceViewer = (inv: Invoice, autoPrint = false) => {
    setAutoPrintInvoice(autoPrint);
    setViewingInvoice(inv);
  };

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3500);
  };

  const loadAll = async () => {
    setLoading(true);
    setLoadError('');
    try {
      const data = await api.bootstrap();
      setRooms(data.rooms);
      setGuests(data.guests);
      setBookings(data.bookings);
      setFoodMenu(data.foodMenu);
      setStaff(data.staff);
      setInvoices(data.invoices);
      setEmailLogs(data.emailLogs);
      setMobileLogs(data.mobileLogs || []);
      setGstSettings(data.gstSettings);
      setInvoiceTheme(data.invoiceTheme);
      setSmtpConfigured(data.smtpConfigured);
      setSmsConfigured(Boolean(data.smsConfigured));
    } catch (err) {
      setLoadError(
        err instanceof Error ? err.message : 'Unable to load hotel database.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAll();
  }, []);

  // --- Handlers ---
  const handleCreateGuest = async (payload: Omit<Guest, 'id' | 'createdAt'>) => {
    const created = await api.createGuest(payload);
    setGuests((prev) => [created, ...prev]);
    showToast(`Guest ${created.name} added.`);
    return created;
  };

  const handleUpdateGuest = async (id: string, payload: Partial<Guest>) => {
    const updated = await api.updateGuest(id, payload);
    setGuests((prev) => prev.map((g) => (g.id === id ? updated : g)));
    showToast(`Guest ${updated.name} updated.`);
    return updated;
  };

  const handleDeleteGuest = async (id: string) => {
    await api.deleteGuest(id);
    setGuests((prev) => prev.filter((g) => g.id !== id));
    showToast('Guest removed.');
  };

  const handleCreateRoom = async (payload: Omit<Room, 'id'>) => {
    const created = await api.createRoom(payload);
    setRooms((prev) =>
      [...prev, created].sort((a, b) =>
        a.number.localeCompare(b.number, undefined, { numeric: true })
      )
    );
    showToast(`Room ${created.number} added.`);
    return created;
  };

  const handleUpdateRoom = async (id: string, payload: Partial<Room>) => {
    const updated = await api.updateRoom(id, payload);
    setRooms((prev) => prev.map((r) => (r.id === id ? updated : r)));
    return updated;
  };

  const handleDeleteRoom = async (id: string) => {
    await api.deleteRoom(id);
    setRooms((prev) => prev.filter((r) => r.id !== id));
    showToast('Room deleted.');
  };

  const handleCreateFoodItem = async (payload: Omit<FoodItem, 'id'>) => {
    const created = await api.createFoodItem(payload);
    setFoodMenu((prev) => [...prev, created]);
    showToast(`${created.name} added to menu.`);
    return created;
  };

  const handleUpdateFoodItem = async (id: string, payload: Partial<FoodItem>) => {
    const updated = await api.updateFoodItem(id, payload);
    setFoodMenu((prev) => prev.map((f) => (f.id === id ? updated : f)));
    return updated;
  };

  const handleDeleteFoodItem = async (id: string) => {
    await api.deleteFoodItem(id);
    setFoodMenu((prev) => prev.filter((f) => f.id !== id));
    showToast('Menu item deleted.');
  };

  const handleCreateStaff = async (payload: Omit<StaffMember, 'id'>) => {
    const created = await api.createStaff(payload);
    setStaff((prev) => [...prev, created]);
    showToast(`${created.name} added to staff roster.`);
    return created;
  };

  const handleUpdateStaff = async (id: string, payload: Partial<StaffMember>) => {
    const updated = await api.updateStaff(id, payload);
    setStaff((prev) => prev.map((s) => (s.id === id ? updated : s)));
    return updated;
  };

  const handleDeleteStaff = async (id: string) => {
    await api.deleteStaff(id);
    setStaff((prev) => prev.filter((s) => s.id !== id));
    showToast('Staff member removed.');
  };

  const handleCreateBooking = async (payload: {
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
  }) => {
    const { booking, room } = await api.createBooking(payload);
    setBookings((prev) => [booking, ...prev]);
    setRooms((prev) => prev.map((r) => (r.id === room.id ? room : r)));
    showToast(
      booking.status === 'Held'
        ? room.status === 'Occupied'
          ? `New check-in for Room ${room.number} saved in Held Check-Ins (${booking.bookingCode}) until current checkout.`
          : `Room ${room.number} placed on hold (${booking.bookingCode}).`
        : `Checked in Room ${room.number} (${booking.bookingCode}).`
    );
  };

  const handleConvertHold = async (bookingId: string) => {
    const { booking, room } = await api.updateBooking(bookingId, {
      status: 'CheckedIn',
    });
    setBookings((prev) => prev.map((b) => (b.id === bookingId ? booking : b)));
    if (room) {
      setRooms((prev) => prev.map((r) => (r.id === room.id ? room : r)));
    }
    showToast(`Hold ${booking.bookingCode} converted to active Check-In.`);
  };

  const handleUpdateBooking = async (
    bookingId: string,
    payload: Partial<Booking>
  ) => {
    const { booking } = await api.updateBooking(bookingId, payload);
    setBookings((prev) => prev.map((b) => (b.id === bookingId ? booking : b)));
  };

  const handleDeleteBooking = async (bookingId: string) => {
    const { room } = await api.deleteBooking(bookingId);
    setBookings((prev) => prev.filter((b) => b.id !== bookingId));
    if (room) {
      setRooms((prev) => prev.map((r) => (r.id === room.id ? room : r)));
    }
    showToast('Check-in record deleted and room released.');
  };

  const handleAddFoodOrder = async (
    bookingId: string,
    foodItemId: string,
    quantity: number
  ) => {
    const updatedBooking = await api.addFoodOrder(bookingId, {
      foodItemId,
      quantity,
    });
    setBookings((prev) =>
      prev.map((b) => (b.id === bookingId ? updatedBooking : b))
    );
  };

  const handleRemoveFoodOrder = async (bookingId: string, orderId: string) => {
    const updatedBooking = await api.removeFoodOrder(bookingId, orderId);
    setBookings((prev) =>
      prev.map((b) => (b.id === bookingId ? updatedBooking : b))
    );
  };

  const handleCompleteCheckout = async (
    bookingId: string,
    payload: {
      paymentMethod: PaymentMethod;
      paymentReference: string;
      discount: number;
      advancePaid: number;
      nights: number;
      checkInDate: string;
      checkInTime: string;
      checkOutDate: string;
      checkOutTime: string;
      nextRoomStatus: RoomStatus;
      sendEmailReceipt: boolean;
      sendMobileInvoice: boolean;
      templatePreset: InvoiceThemePreset;
    }
  ) => {
    const { booking, room, invoice, emailLog, mobileLog } = await api.checkoutBooking(
      bookingId,
      payload
    );
    setBookings((prev) => prev.map((b) => (b.id === bookingId ? booking : b)));
    if (room) {
      setRooms((prev) => prev.map((r) => (r.id === room.id ? room : r)));
    }
    setInvoices((prev) => [invoice, ...prev]);
    if (emailLog) {
      setEmailLogs((prev) => [emailLog, ...prev]);
    }
    if (mobileLog) {
      setMobileLogs((prev) => [mobileLog, ...prev]);
    }
    setFolioBookingId(null);
    openInvoiceViewer(invoice, false);
    const channels: string[] = [];
    if (emailLog) channels.push('email');
    if (mobileLog) channels.push(`mobile (${mobileLog.recipientMobile})`);
    const billLabel = invoice.billNumber
      ? `Bill ${invoice.billNumber} / ${invoice.invoiceNumber}`
      : invoice.invoiceNumber;
    showToast(
      channels.length > 0
        ? `Checkout completed (${billLabel}) & sent via ${channels.join(' + ')}.`
        : `Checkout completed (${billLabel}).`
    );
  };

  const handleCreateFoodBill = async (payload: {
    guestId?: string;
    guestName: string;
    guestMobile: string;
    guestEmail?: string;
    companyName?: string;
    companyGst?: string;
    serviceType: 'Dine-In' | 'Takeaway' | 'Room Direct' | 'Delivery';
    tableOrRef?: string;
    orderDate: string;
    orderTime: string;
    items: { foodItemId: string; quantity: number }[];
    extraCharges?: ExtraChargeItem[];
    discount?: number;
    advancePaid?: number;
    paymentMethod: PaymentMethod;
    paymentReference?: string;
    sendEmailReceipt: boolean;
    sendMobileInvoice: boolean;
    templatePreset: InvoiceThemePreset;
  }) => {
    const { invoice, emailLog, mobileLog } = await api.createFoodBill(payload);
    setInvoices((prev) => [invoice, ...prev]);
    if (emailLog) {
      setEmailLogs((prev) => [emailLog, ...prev]);
    }
    if (mobileLog) {
      setMobileLogs((prev) => [mobileLog, ...prev]);
    }
    setFoodBillingModalOpen(false);
    openInvoiceViewer(invoice, false);
    const channels: string[] = [];
    if (emailLog) channels.push('email');
    if (mobileLog) channels.push(`mobile (${mobileLog.recipientMobile})`);
    const billLabel = invoice.billNumber
      ? `Bill ${invoice.billNumber} / ${invoice.invoiceNumber}`
      : invoice.invoiceNumber;
    showToast(
      channels.length > 0
        ? `Food bill ${billLabel} generated & sent via ${channels.join(' + ')}.`
        : `Food bill ${billLabel} generated.`
    );
  };

  const handleSendInvoiceEmail = async (
    invoiceId: string,
    recipientEmail?: string
  ) => {
    setSendingInvoiceEmail(true);
    try {
      const { invoice, emailLog } = await api.sendInvoiceEmail(
        invoiceId,
        recipientEmail
      );
      setInvoices((prev) => prev.map((i) => (i.id === invoiceId ? invoice : i)));
      setEmailLogs((prev) => [emailLog, ...prev]);
      if (viewingInvoice?.id === invoiceId) {
        setViewingInvoice(invoice);
      }
      showToast(`Email receipt processed for ${emailLog.recipientEmail}.`);
    } finally {
      setSendingInvoiceEmail(false);
    }
  };

  const handleSendInvoiceMobile = async (
    invoiceId: string,
    recipientMobile?: string,
    channel?: 'SMS' | 'WhatsApp'
  ) => {
    setSendingInvoiceMobile(true);
    try {
      const { invoice, mobileLog } = await api.sendInvoiceMobile(
        invoiceId,
        recipientMobile,
        channel
      );
      setInvoices((prev) => prev.map((i) => (i.id === invoiceId ? invoice : i)));
      setMobileLogs((prev) => [mobileLog, ...prev]);
      if (viewingInvoice?.id === invoiceId) {
        setViewingInvoice(invoice);
      }
      showToast(`Mobile invoice queued for ${mobileLog.recipientMobile}.`);
    } finally {
      setSendingInvoiceMobile(false);
    }
  };

  const handleUpdateGstSettings = async (payload: Partial<GstSettings>) => {
    const updated = await api.updateGstSettings(payload);
    setGstSettings(updated);
    return updated;
  };

  const handleUpdateInvoiceTheme = async (payload: Partial<InvoiceTheme>) => {
    const updated = await api.updateInvoiceTheme(payload);
    setInvoiceTheme(updated);
    return updated;
  };

  const activeFolioBooking = folioBookingId
    ? bookings.find((b) => b.id === folioBookingId) || null
    : null;

  const activeSectionMeta = NAV_ITEMS.find((item) => item.id === section);

  if (loading || !gstSettings || !invoiceTheme) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="bg-white border border-slate-200 rounded-lg p-6 max-w-sm w-full space-y-3">
          {loadError ? (
            <>
              <div className="text-sm font-semibold text-rose-700">
                Connection Error
              </div>
              <p className="text-xs text-slate-600">{loadError}</p>
              <button
                type="button"
                onClick={loadAll}
                className="px-4 py-2 text-xs font-medium text-white bg-slate-900 rounded-md"
              >
                Retry
              </button>
            </>
          ) : (
            <div className="space-y-2">
              <div className="h-4 w-40 bg-slate-200 rounded animate-pulse" />
              <div className="h-3 w-full bg-slate-100 rounded animate-pulse" />
              <div className="h-3 w-2/3 bg-slate-100 rounded animate-pulse" />
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar Navigation (Desktop) */}
      <aside className="no-print hidden lg:flex lg:flex-col w-64 bg-slate-900 text-slate-200 shrink-0 sticky top-0 h-screen">
        <div className="px-5 py-5 border-b border-slate-800">
          <div className="font-display text-base font-bold tracking-tight text-white whitespace-nowrap">
            {gstSettings.hotelTradeName}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5 font-mono">
            GSTIN {gstSettings.hotelGstNumber || 'Unconfigured'}
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = section === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setSection(item.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  active
                    ? 'bg-white/12 text-white'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-800 text-[11px] text-slate-400 space-y-1">
          <div className="flex justify-between tabular-nums">
            <span>Available Rooms</span>
            <span className="font-mono text-white">
              {rooms.filter((r) => r.status === 'Available').length}/{rooms.length}
            </span>
          </div>
          <div className="flex justify-between tabular-nums">
            <span>Active Check-Ins</span>
            <span className="font-mono text-white">
              {bookings.filter((b) => b.status === 'CheckedIn').length}
            </span>
          </div>
          <div className="flex justify-between tabular-nums">
            <span>Held Rooms</span>
            <span className="font-mono text-white">
              {bookings.filter((b) => b.status === 'Held').length}
            </span>
          </div>
        </div>
      </aside>

      {/* Mobile Sidebar Drawer */}
      {mobileNavOpen && (
        <div className="no-print fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/50"
            onClick={() => setMobileNavOpen(false)}
          />
          <aside className="relative w-64 bg-slate-900 text-slate-200 h-full flex flex-col z-10">
            <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
              <span className="font-display text-sm font-bold text-white">
                {gstSettings.hotelTradeName}
              </span>
              <button
                type="button"
                onClick={() => setMobileNavOpen(false)}
                className="p-1 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <nav className="flex-1 p-3 space-y-1">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const active = section === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setSection(item.id);
                      setMobileNavOpen(false);
                    }}
                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-xs font-medium rounded-md ${
                      active
                        ? 'bg-white/12 text-white'
                        : 'text-slate-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </aside>
        </div>
      )}

      {/* Main Workspace */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top Bar Contract */}
        <header className="no-print bg-white border-b border-slate-200 px-6 py-3.5 flex items-center justify-between gap-4 sticky top-0 z-30">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              className="lg:hidden p-1.5 text-slate-600 hover:text-slate-900 border border-slate-200 rounded-md"
              aria-label="Open navigation"
            >
              <Menu className="w-4 h-4" />
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span>Operations</span>
                <span aria-hidden="true">/</span>
                <span className="font-semibold text-slate-900 truncate">
                  {activeSectionMeta?.label}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() =>
                setCheckInModal({ open: true, mode: 'Held', roomId: undefined })
              }
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 whitespace-nowrap shrink-0"
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Hold Room</span>
            </button>
            <button
              type="button"
              onClick={() =>
                setCheckInModal({
                  open: true,
                  mode: 'CheckedIn',
                  roomId: undefined,
                })
              }
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-slate-900 rounded-md hover:bg-slate-800 whitespace-nowrap shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Check-In</span>
            </button>
          </div>
        </header>

        {/* Viewport Content */}
        <main className="no-print flex-1 p-6 max-w-[1440px] w-full mx-auto">
          {section === 'dashboard' && (
            <DashboardView
              rooms={rooms}
              guests={guests}
              bookings={bookings}
              invoices={invoices}
              gstSettings={gstSettings}
              onOpenCheckIn={(mode, roomId, date) =>
                setCheckInModal({ open: true, mode, roomId, date })
              }
              onOpenFolio={(booking) => setFolioBookingId(booking.id)}
              onViewInvoice={(inv) => openInvoiceViewer(inv, false)}
              onConvertHoldToCheckIn={handleConvertHold}
              onDeleteBooking={handleDeleteBooking}
              onUpdateRoomStatus={(roomId, status) =>
                handleUpdateRoom(roomId, { status }).then(() => undefined)
              }
            />
          )}

          {section === 'bookings' && (
            <BookingsView
              bookings={bookings}
              rooms={rooms}
              guests={guests}
              invoices={invoices}
              gstSettings={gstSettings}
              onOpenCheckIn={(mode) =>
                setCheckInModal({ open: true, mode, roomId: undefined })
              }
              onOpenFolio={(booking) => setFolioBookingId(booking.id)}
              onConvertHold={handleConvertHold}
              onDeleteBooking={handleDeleteBooking}
              onViewInvoice={openInvoiceViewer}
              onResendEmail={(invId) => handleSendInvoiceEmail(invId)}
              onSendMobile={(invId) => handleSendInvoiceMobile(invId)}
            />
          )}

          {section === 'guests' && (
            <GuestsView
              guests={guests}
              bookings={bookings}
              rooms={rooms}
              invoices={invoices}
              gstSettings={gstSettings}
              onCreateGuest={handleCreateGuest}
              onUpdateGuest={handleUpdateGuest}
              onDeleteGuest={handleDeleteGuest}
              onViewInvoice={(inv) => openInvoiceViewer(inv, false)}
            />
          )}

          {section === 'rooms' && (
            <RoomsView
              rooms={rooms}
              gstSettings={gstSettings}
              onCreateRoom={handleCreateRoom}
              onUpdateRoom={handleUpdateRoom}
              onDeleteRoom={handleDeleteRoom}
            />
          )}

          {section === 'food' && (
            <FoodMenuView
              foodMenu={foodMenu}
              bookings={bookings}
              rooms={rooms}
              guests={guests}
              gstSettings={gstSettings}
              onCreateFoodItem={handleCreateFoodItem}
              onUpdateFoodItem={handleUpdateFoodItem}
              onDeleteFoodItem={handleDeleteFoodItem}
              onAddFoodOrder={handleAddFoodOrder}
              onOpenFoodBill={() => setFoodBillingModalOpen(true)}
            />
          )}

          {section === 'foodBilling' && (
            <FoodBillingView
              invoices={invoices}
              gstSettings={gstSettings}
              onOpenNewFoodBill={() => setFoodBillingModalOpen(true)}
              onViewInvoice={openInvoiceViewer}
              onResendEmail={(invId) => handleSendInvoiceEmail(invId)}
              onSendMobile={(invId) => handleSendInvoiceMobile(invId)}
            />
          )}

          {section === 'staff' && (
            <StaffView
              staff={staff}
              onCreateStaff={handleCreateStaff}
              onUpdateStaff={handleUpdateStaff}
              onDeleteStaff={handleDeleteStaff}
            />
          )}

          {section === 'billing' && (
            <BillingGstView
              invoices={invoices}
              emailLogs={emailLogs}
              mobileLogs={mobileLogs}
              gstSettings={gstSettings}
              invoiceTheme={invoiceTheme}
              smtpConfigured={smtpConfigured}
              smsConfigured={smsConfigured}
              onUpdateGstSettings={handleUpdateGstSettings}
              onUpdateInvoiceTheme={handleUpdateInvoiceTheme}
              onViewInvoice={openInvoiceViewer}
              onSendInvoiceEmail={handleSendInvoiceEmail}
              onSendInvoiceMobile={handleSendInvoiceMobile}
            />
          )}

          {section === 'hotel' && (
            <HotelSettingsView
              gstSettings={gstSettings}
              smtpConfigured={smtpConfigured}
              smsConfigured={smsConfigured}
              onUpdateGstSettings={async (payload) => {
                const updated = await handleUpdateGstSettings(payload);
                showToast('Hotel profile, GSTIN & policy saved.');
                return updated;
              }}
            />
          )}
        </main>

        {/* Web Bottom Signature Footer */}
        <footer className="no-print border-t border-slate-200 bg-white px-6 py-3 mt-auto">
          <div className="max-w-[1440px] w-full mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
            <span>{gstSettings.hotelTradeName}</span>
            <span className="font-medium text-slate-700">
              Devloped by - Deep
            </span>
          </div>
        </footer>
      </div>

      {/* Toast Notification */}
      {toast && (
        <div className="no-print fixed bottom-5 right-5 z-50 flex items-center gap-2 px-4 py-2.5 bg-slate-900 text-white text-xs font-medium rounded-lg shadow-lg border border-slate-700">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toast}</span>
        </div>
      )}

      {/* Check-In / Hold Modal */}
      {checkInModal.open && (
        <CheckInModal
          isOpen={checkInModal.open}
          initialMode={checkInModal.mode}
          initialRoomId={checkInModal.roomId}
          initialCheckInDate={checkInModal.date}
          rooms={rooms}
          guests={guests}
          bookings={bookings}
          gstSettings={gstSettings}
          onClose={() => setCheckInModal({ open: false, mode: 'CheckedIn' })}
          onCreateGuest={handleCreateGuest}
          onCreateBooking={handleCreateBooking}
        />
      )}

      {/* Folio & Checkout Modal */}
      {activeFolioBooking && (
        <FolioCheckoutModal
          booking={activeFolioBooking}
          room={rooms.find((r) => r.id === activeFolioBooking.roomId)}
          guest={guests.find((g) => g.id === activeFolioBooking.guestId)}
          foodMenu={foodMenu}
          gstSettings={gstSettings}
          defaultThemePreset={invoiceTheme.preset}
          onClose={() => setFolioBookingId(null)}
          onAddFoodOrder={handleAddFoodOrder}
          onRemoveFoodOrder={handleRemoveFoodOrder}
          onUpdateBooking={handleUpdateBooking}
          onCompleteCheckout={handleCompleteCheckout}
        />
      )}

      {/* Separate Food Billing Modal */}
      {foodBillingModalOpen && (
        <FoodBillingModal
          isOpen={foodBillingModalOpen}
          foodMenu={foodMenu}
          guests={guests}
          gstSettings={gstSettings}
          defaultThemePreset={invoiceTheme.preset}
          onClose={() => setFoodBillingModalOpen(false)}
          onCreateGuest={handleCreateGuest}
          onCreateFoodBill={handleCreateFoodBill}
        />
      )}

      {/* Tax Invoice Viewer & Print Modal */}
      {viewingInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 print:static print:block print:bg-white print:p-0">
          <div className="bg-white border border-slate-200 rounded-xl shadow-xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden print:block print:overflow-visible print:border-none print:shadow-none print:max-h-none print:rounded-none">
            <div className="no-print flex items-center justify-between px-6 py-3.5 border-b border-slate-200">
              <span className="text-sm font-semibold text-slate-900">
                Tax Invoice — {viewingInvoice.invoiceNumber}
                {viewingInvoice.billNumber ? ` · Bill ${viewingInvoice.billNumber}` : ''}
              </span>
              <button
                type="button"
                onClick={() => {
                  setViewingInvoice(null);
                  setAutoPrintInvoice(false);
                }}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="overflow-y-auto p-6 print:overflow-visible print:p-0">
              <InvoicePreview
                invoice={viewingInvoice}
                gstSettings={gstSettings}
                theme={invoiceTheme}
                guests={guests}
                bookings={bookings}
                autoPrint={autoPrintInvoice}
                sendingEmail={sendingInvoiceEmail}
                onResendEmail={() => handleSendInvoiceEmail(viewingInvoice.id)}
                sendingMobile={sendingInvoiceMobile}
                onSendMobile={() => handleSendInvoiceMobile(viewingInvoice.id)}
                onSelectTemplate={(preset) =>
                  setViewingInvoice((prev) =>
                    prev ? { ...prev, templatePreset: preset } : prev
                  )
                }
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
