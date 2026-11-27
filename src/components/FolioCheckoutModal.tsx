import React, { useState } from 'react';
import {
  CheckCircle2,
  Mail,
  MessageSquare,
  Plus,
  Trash2,
  UtensilsCrossed,
  X,
} from 'lucide-react';
import {
  Booking,
  FoodItem,
  GstSettings,
  Guest,
  InvoiceThemePreset,
  PaymentMethod,
  Room,
  RoomStatus,
} from '../types/hotel';
import {
  computeBookingFolio,
  computeNightsBetween,
  extractTime24h,
  formatCurrency,
  formatDateDisplay,
  formatTime12h,
  getCurrentTime24h,
  toLocalDateInput,
} from '../utils/billing';

interface FolioCheckoutModalProps {
  booking: Booking | null;
  room: Room | undefined;
  guest: Guest | undefined;
  foodMenu: FoodItem[];
  gstSettings: GstSettings;
  defaultThemePreset: InvoiceThemePreset;
  onClose: () => void;
  onAddFoodOrder: (bookingId: string, foodItemId: string, quantity: number) => Promise<void>;
  onRemoveFoodOrder: (bookingId: string, orderId: string) => Promise<void>;
  onUpdateBooking: (bookingId: string, payload: Partial<Booking>) => Promise<void>;
  onCompleteCheckout: (
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
  ) => Promise<void>;
}

export const FolioCheckoutModal: React.FC<FolioCheckoutModalProps> = ({
  booking,
  room,
  guest,
  foodMenu,
  gstSettings,
  defaultThemePreset,
  onClose,
  onAddFoodOrder,
  onRemoveFoodOrder,
  onUpdateBooking,
  onCompleteCheckout,
}) => {
  const [selectedFoodId, setSelectedFoodId] = useState(
    foodMenu.find((f) => f.available)?.id || foodMenu[0]?.id || ''
  );
  const [foodQty, setFoodQty] = useState(1);

  const [extraDesc, setExtraDesc] = useState('');
  const [extraAmount, setExtraAmount] = useState('');

  const [nights, setNights] = useState(booking?.nights || 1);
  const [checkInDate, setCheckInDate] = useState(() =>
    toLocalDateInput(booking?.checkInDate)
  );
  const [checkInTime, setCheckInTime] = useState(() =>
    extractTime24h(booking?.checkInDate, booking?.checkInTime)
  );
  const [checkOutDate, setCheckOutDate] = useState(() =>
    toLocalDateInput(booking?.checkOutDate)
  );
  const [checkOutTime, setCheckOutTime] = useState(() => getCurrentTime24h());
  const [discount, setDiscount] = useState(booking?.discount || 0);
  const [advancePaid, setAdvancePaid] = useState(booking?.advancePaid || 0);

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('UPI');
  const [paymentRef, setPaymentRef] = useState('');
  const [nextRoomStatus, setNextRoomStatus] = useState<RoomStatus>('Housekeeping');
  const [templatePreset, setTemplatePreset] =
    useState<InvoiceThemePreset>(defaultThemePreset);
  const [sendEmailReceipt, setSendEmailReceipt] = useState(
    gstSettings.autoEmailReceipts
  );
  const [sendMobileInvoice, setSendMobileInvoice] = useState(
    gstSettings.autoSmsReceipts
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (!booking) return null;

  const handleCheckInDateChange = (nextDate: string) => {
    setCheckInDate(nextDate);
    if (nextDate && checkOutDate) {
      setNights(computeNightsBetween(nextDate, checkOutDate));
    }
  };

  const handleCheckOutDateChange = (nextDate: string) => {
    setCheckOutDate(nextDate);
    if (nextDate && checkInDate) {
      setNights(computeNightsBetween(checkInDate, nextDate));
    }
  };

  const previewBooking: Booking = {
    ...booking,
    nights,
    discount,
    advancePaid,
  };
  const folio = computeBookingFolio(previewBooking, room, gstSettings);
  const sym = gstSettings.currencySymbol || '₹';

  const handleAddFood = async () => {
    if (!selectedFoodId) return;
    setBusy(true);
    setError('');
    try {
      await onAddFoodOrder(booking.id, selectedFoodId, foodQty);
      setFoodQty(1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add food item.');
    } finally {
      setBusy(false);
    }
  };

  const handleAddExtra = async () => {
    const amt = Number(extraAmount);
    if (!extraDesc.trim() || Number.isNaN(amt) || amt <= 0) return;
    setBusy(true);
    try {
      const nextExtras = [
        ...(booking.extraCharges || []),
        {
          id: `ex-${Date.now()}`,
          description: extraDesc.trim(),
          amount: amt,
          taxable: true,
        },
      ];
      await onUpdateBooking(booking.id, { extraCharges: nextExtras });
      setExtraDesc('');
      setExtraAmount('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add charge.');
    } finally {
      setBusy(false);
    }
  };

  const handleRemoveExtra = async (extraId: string) => {
    setBusy(true);
    try {
      await onUpdateBooking(booking.id, {
        extraCharges: (booking.extraCharges || []).filter((e) => e.id !== extraId),
      });
    } finally {
      setBusy(false);
    }
  };

  const handleCheckout = async () => {
    setBusy(true);
    setError('');
    try {
      const safeInTime = checkInTime || '12:00';
      const safeOutTime = checkOutTime || getCurrentTime24h();
      const checkInIso = checkInDate
        ? new Date(`${checkInDate}T${safeInTime}:00`).toISOString()
        : booking.checkInDate;
      const checkOutIso = checkOutDate
        ? new Date(`${checkOutDate}T${safeOutTime}:00`).toISOString()
        : new Date().toISOString();
      await onCompleteCheckout(booking.id, {
        paymentMethod,
        paymentReference: paymentRef,
        discount,
        advancePaid,
        nights,
        checkInDate: checkInIso,
        checkInTime: safeInTime,
        checkOutDate: checkOutIso,
        checkOutTime: safeOutTime,
        nextRoomStatus,
        sendEmailReceipt,
        sendMobileInvoice,
        templatePreset,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Checkout failed.');
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-[1px] p-4">
      <div className="bg-white border border-slate-200 rounded-xl shadow-xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Stay Folio & Checkout — Room {room?.number} ({booking.bookingCode})
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {guest?.name} · {guest?.mobile}
              {guest?.companyName ? ` · ${guest.companyName}` : ''}
              {guest?.companyGst ? ` (GSTIN: ${guest.companyGst})` : ''}
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

        <div className="overflow-y-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Folio Adjustments, Food & Extras */}
          <div className="lg:col-span-7 space-y-5">
            {error && (
              <div className="p-3 text-xs font-medium text-rose-800 bg-rose-50 border border-rose-200 rounded-md">
                {error}
              </div>
            )}

            {/* Stay Parameters & Timings */}
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                    Check-In Date
                  </label>
                  <input
                    type="date"
                    value={checkInDate}
                    onChange={(e) => handleCheckInDateChange(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs font-mono tabular-nums bg-white border border-slate-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                    Check-In Time
                  </label>
                  <input
                    type="time"
                    value={checkInTime}
                    onChange={(e) => setCheckInTime(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs font-mono tabular-nums bg-white border border-slate-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                    Check-Out Date
                  </label>
                  <input
                    type="date"
                    value={checkOutDate}
                    min={checkInDate}
                    onChange={(e) => handleCheckOutDateChange(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs font-mono tabular-nums bg-white border border-slate-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                    Check-Out Time
                  </label>
                  <input
                    type="time"
                    value={checkOutTime}
                    onChange={(e) => setCheckOutTime(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs font-mono tabular-nums bg-white border border-slate-300 rounded-md"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                    Billable Nights
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={nights}
                    onChange={(e) => setNights(Math.max(1, Number(e.target.value)))}
                    className="w-full px-2.5 py-1.5 text-sm font-mono tabular-nums bg-white border border-slate-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                    Discount ({sym})
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={discount}
                    onChange={(e) => setDiscount(Math.max(0, Number(e.target.value)))}
                    className="w-full px-2.5 py-1.5 text-sm font-mono tabular-nums bg-white border border-slate-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                    Advance Paid ({sym})
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={advancePaid}
                    onChange={(e) => setAdvancePaid(Math.max(0, Number(e.target.value)))}
                    className="w-full px-2.5 py-1.5 text-sm font-mono tabular-nums bg-white border border-slate-300 rounded-md"
                  />
                </div>
              </div>
            </div>

            {/* Add Food / Room Service */}
            <div className="space-y-2.5">
              <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
                <UtensilsCrossed className="w-3.5 h-3.5" />
                <span>Post Food & Beverage to Room</span>
              </div>
              <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
                <select
                  value={selectedFoodId}
                  onChange={(e) => setSelectedFoodId(e.target.value)}
                  className="flex-1 min-w-[200px] px-3 py-2 text-xs border border-slate-300 rounded-md bg-white"
                >
                  {foodMenu
                    .filter((f) => f.available)
                    .map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name} — {formatCurrency(f.rate, sym)} (+{f.gstRate}% GST)
                      </option>
                    ))}
                </select>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={foodQty}
                  onChange={(e) => setFoodQty(Math.max(1, Number(e.target.value)))}
                  className="w-16 px-2.5 py-2 text-xs font-mono tabular-nums border border-slate-300 rounded-md"
                />
                <button
                  type="button"
                  onClick={handleAddFood}
                  disabled={busy || !selectedFoodId}
                  className="inline-flex items-center gap-1 px-3 py-2 text-xs font-medium text-white bg-slate-900 rounded-md hover:bg-slate-800 whitespace-nowrap shrink-0 disabled:opacity-50"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Item</span>
                </button>
              </div>

              {(booking.foodOrders || []).length > 0 && (
                <div className="border border-slate-200 rounded-md divide-y divide-slate-100">
                  {booking.foodOrders.map((order) => (
                    <div
                      key={order.id}
                      className="flex items-center justify-between px-3 py-2 text-xs"
                    >
                      <div>
                        <span className="font-medium text-slate-900">{order.name}</span>
                        <span className="text-slate-500 ml-2 tabular-nums">
                          {order.quantity} × {formatCurrency(order.rate, sym)}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-mono font-medium tabular-nums text-slate-900">
                          {formatCurrency(order.quantity * order.rate, sym)}
                        </span>
                        <button
                          type="button"
                          onClick={() => onRemoveFoodOrder(booking.id, order.id)}
                          disabled={busy}
                          className="text-slate-400 hover:text-rose-600"
                          aria-label="Remove food order"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Extra Charges */}
            <div className="space-y-2.5">
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Add Miscellaneous Charge (Laundry, Cab, Spa)
              </div>
              <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
                <input
                  type="text"
                  value={extraDesc}
                  onChange={(e) => setExtraDesc(e.target.value)}
                  placeholder="Charge description"
                  className="flex-1 px-3 py-2 text-xs border border-slate-300 rounded-md"
                />
                <input
                  type="number"
                  min={0}
                  value={extraAmount}
                  onChange={(e) => setExtraAmount(e.target.value)}
                  placeholder="Amount"
                  className="w-28 px-2.5 py-2 text-xs font-mono tabular-nums border border-slate-300 rounded-md"
                />
                <button
                  type="button"
                  onClick={handleAddExtra}
                  disabled={busy || !extraDesc.trim() || !extraAmount}
                  className="inline-flex items-center gap-1 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 whitespace-nowrap shrink-0 disabled:opacity-50"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Charge</span>
                </button>
              </div>
              {(booking.extraCharges || []).length > 0 && (
                <div className="border border-slate-200 rounded-md divide-y divide-slate-100">
                  {booking.extraCharges.map((ex) => (
                    <div
                      key={ex.id}
                      className="flex items-center justify-between px-3 py-2 text-xs"
                    >
                      <span className="font-medium text-slate-900">{ex.description}</span>
                      <div className="flex items-center gap-3">
                        <span className="font-mono font-medium tabular-nums">
                          {formatCurrency(ex.amount, sym)}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveExtra(ex.id)}
                          className="text-slate-400 hover:text-rose-600"
                          aria-label="Remove charge"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Live GST Tax Bill & Settlement */}
          <div className="lg:col-span-5 space-y-4">
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-3 text-xs">
              <div className="border-b border-slate-200 pb-2 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-900 uppercase tracking-wider text-[11px]">
                    Live GST Folio Summary
                  </span>
                  <span className="text-[11px] text-slate-500 tabular-nums">
                    {nights} Night{nights > 1 ? 's' : ''}
                  </span>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-600 tabular-nums">
                  <span>
                    In: {formatDateDisplay(`${checkInDate}T12:00:00`)} · {formatTime12h(checkInTime)}
                  </span>
                  <span>
                    Out: {formatDateDisplay(`${checkOutDate}T12:00:00`)} · {formatTime12h(checkOutTime)}
                  </span>
                </div>
              </div>

              <div className="space-y-1.5 tabular-nums">
                <div className="flex justify-between text-slate-700">
                  <span>
                    Room ({nights} × {formatCurrency(booking.roomRatePerNight, sym)})
                  </span>
                  <span className="font-mono">
                    {formatCurrency(folio.roomSubtotal, sym)}
                  </span>
                </div>
                {folio.discountAmount > 0 && (
                  <div className="flex justify-between text-emerald-700">
                    <span>Discount</span>
                    <span className="font-mono">
                      -{formatCurrency(folio.discountAmount, sym)}
                    </span>
                  </div>
                )}
                {folio.foodSubtotal > 0 && (
                  <div className="flex justify-between text-slate-700">
                    <span>Food & Beverages</span>
                    <span className="font-mono">
                      {formatCurrency(folio.foodSubtotal, sym)}
                    </span>
                  </div>
                )}
                {folio.extraChargesSubtotal > 0 && (
                  <div className="flex justify-between text-slate-700">
                    <span>Extra Charges</span>
                    <span className="font-mono">
                      {formatCurrency(folio.extraChargesSubtotal, sym)}
                    </span>
                  </div>
                )}
                {folio.serviceChargeAmount > 0 && (
                  <div className="flex justify-between text-slate-700">
                    <span>Service Charge ({gstSettings.serviceChargeRate}%)</span>
                    <span className="font-mono">
                      {formatCurrency(folio.serviceChargeAmount, sym)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-slate-600 pt-1 border-t border-slate-200">
                  <span>Taxable Value</span>
                  <span className="font-mono font-medium text-slate-900">
                    {formatCurrency(folio.taxableTotal, sym)}
                  </span>
                </div>
                {gstSettings.taxRegime === 'IGST' ? (
                  <div className="flex justify-between text-slate-600">
                    <span>IGST ({folio.roomGstRate}% / F&B)</span>
                    <span className="font-mono">
                      {formatCurrency(folio.igstAmount, sym)}
                    </span>
                  </div>
                ) : (
                  <>
                    <div className="flex justify-between text-slate-600">
                      <span>CGST</span>
                      <span className="font-mono">
                        {formatCurrency(folio.cgstAmount, sym)}
                      </span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>SGST</span>
                      <span className="font-mono">
                        {formatCurrency(folio.sgstAmount, sym)}
                      </span>
                    </div>
                  </>
                )}
                <div className="flex justify-between font-bold text-sm text-slate-900 pt-2 border-t border-slate-300">
                  <span>Grand Total</span>
                  <span className="font-mono">
                    {formatCurrency(folio.grandTotal, sym)}
                  </span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Less Advance Paid</span>
                  <span className="font-mono">
                    -{formatCurrency(folio.advancePaid, sym)}
                  </span>
                </div>
                <div className="flex justify-between font-bold text-sm text-blue-700 pt-1">
                  <span>Net Payable Now</span>
                  <span className="font-mono">
                    {formatCurrency(folio.balanceDue, sym)}
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-3 p-4 border border-slate-200 rounded-lg text-xs">
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Payment Method
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                    className="w-full px-2.5 py-2 border border-slate-300 rounded-md bg-white"
                  >
                    <option value="UPI">UPI</option>
                    <option value="Card">Card</option>
                    <option value="Cash">Cash</option>
                    <option value="Corporate Credit">Corporate Credit</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                  </select>
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Room Post-Checkout
                  </label>
                  <select
                    value={nextRoomStatus}
                    onChange={(e) => setNextRoomStatus(e.target.value as RoomStatus)}
                    className="w-full px-2.5 py-2 border border-slate-300 rounded-md bg-white"
                  >
                    <option value="Housekeeping">Needs Housekeeping</option>
                    <option value="Available">Immediately Available</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Transaction / UPI / Card Ref
                  </label>
                  <input
                    type="text"
                    value={paymentRef}
                    onChange={(e) => setPaymentRef(e.target.value)}
                    placeholder="Optional ref #"
                    className="w-full px-2.5 py-2 font-mono border border-slate-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Invoice Template Theme
                  </label>
                  <select
                    value={templatePreset}
                    onChange={(e) =>
                      setTemplatePreset(e.target.value as InvoiceThemePreset)
                    }
                    className="w-full px-2.5 py-2 border border-slate-300 rounded-md bg-white"
                  >
                    <option value="shiv_residency_classic">Shiv Residency Classic (Orange Grid)</option>
                    <option value="executive_classic">Executive Classic</option>
                    <option value="modern_minimal">Modern Minimal</option>
                    <option value="boutique_gold">Boutique Gold</option>
                    <option value="corporate_slate">Corporate Slate</option>
                    <option value="royal_heritage">Royal Heritage</option>
                  </select>
                </div>
              </div>

              <label className="flex items-start gap-2.5 pt-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={sendMobileInvoice}
                  onChange={(e) => setSendMobileInvoice(e.target.checked)}
                  className="mt-0.5 rounded border-slate-300 text-slate-900"
                />
                <span className="text-slate-700 leading-snug">
                  <span className="font-medium text-slate-900 inline-flex items-center gap-1">
                    <MessageSquare className="w-3.5 h-3.5" />
                    Auto-send invoice to guest mobile ({gstSettings.mobileDispatchChannel})
                  </span>
                  <span className="block text-[11px] text-slate-500 mt-0.5 tabular-nums">
                    {guest?.mobile
                      ? `Send invoice & A4 link to ${guest.mobile}`
                      : 'Guest mobile missing — will log status'}
                  </span>
                </span>
              </label>

              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={sendEmailReceipt}
                  onChange={(e) => setSendEmailReceipt(e.target.checked)}
                  className="mt-0.5 rounded border-slate-300 text-slate-900"
                />
                <span className="text-slate-700 leading-snug">
                  <span className="font-medium text-slate-900 inline-flex items-center gap-1">
                    <Mail className="w-3.5 h-3.5" />
                    Send automated email receipt
                  </span>
                  <span className="block text-[11px] text-slate-500 mt-0.5">
                    {guest?.email
                      ? `Dispatch GST invoice to ${guest.email}`
                      : 'Guest email missing — will log status in Outbox'}
                  </span>
                </span>
              </label>

              <button
                type="button"
                onClick={handleCheckout}
                disabled={busy}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-slate-900 rounded-md hover:bg-slate-800 disabled:opacity-50"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>
                  {busy ? 'Processing Checkout...' : 'Settle & Complete Checkout'}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
