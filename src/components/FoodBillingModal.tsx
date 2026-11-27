import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  Mail,
  MessageSquare,
  Minus,
  Plus,
  Trash2,
  UserPlus,
  Users,
  UtensilsCrossed,
  X,
} from 'lucide-react';
import {
  ExtraChargeItem,
  FoodItem,
  FoodOrderItem,
  GstSettings,
  Guest,
  InvoiceThemePreset,
  PaymentMethod,
} from '../types/hotel';
import {
  computeFoodBillFolio,
  formatCurrency,
  formatDateDisplay,
  formatTime12h,
  getCurrentTime24h,
  toLocalDateInput,
} from '../utils/billing';

interface FoodBillingModalProps {
  isOpen: boolean;
  foodMenu: FoodItem[];
  guests: Guest[];
  gstSettings: GstSettings;
  defaultThemePreset: InvoiceThemePreset;
  onClose: () => void;
  onCreateGuest: (payload: Omit<Guest, 'id' | 'createdAt'>) => Promise<Guest>;
  onCreateFoodBill: (payload: {
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
  }) => Promise<void>;
}

export const FoodBillingModal: React.FC<FoodBillingModalProps> = ({
  isOpen,
  foodMenu,
  guests,
  gstSettings,
  defaultThemePreset,
  onClose,
  onCreateGuest,
  onCreateFoodBill,
}) => {
  const [guestMode, setGuestMode] = useState<'existing' | 'new'>('new');
  const [guestSearch, setGuestSearch] = useState('');
  const [selectedGuestId, setSelectedGuestId] = useState(guests[0]?.id || '');

  const [newName, setNewName] = useState('');
  const [newMobile, setNewMobile] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newCompanyName, setNewCompanyName] = useState('');
  const [newCompanyGst, setNewCompanyGst] = useState('');
  const [saveGuestProfile, setSaveGuestProfile] = useState(true);

  const [serviceType, setServiceType] = useState<
    'Dine-In' | 'Takeaway' | 'Room Direct' | 'Delivery'
  >('Dine-In');
  const [tableOrRef, setTableOrRef] = useState('Table 1');
  const [orderDate, setOrderDate] = useState(() => toLocalDateInput());
  const [orderTime, setOrderTime] = useState(() => getCurrentTime24h());

  const availableMenu = useMemo(
    () => foodMenu.filter((f) => f.available),
    [foodMenu]
  );
  const [selectedFoodId, setSelectedFoodId] = useState(
    availableMenu[0]?.id || foodMenu[0]?.id || ''
  );
  const [foodQty, setFoodQty] = useState(1);
  const [cart, setCart] = useState<FoodOrderItem[]>([]);

  const [extraDesc, setExtraDesc] = useState('');
  const [extraAmount, setExtraAmount] = useState('');
  const [extraCharges, setExtraCharges] = useState<ExtraChargeItem[]>([]);

  const [discount, setDiscount] = useState(0);
  const [advancePaid, setAdvancePaid] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('UPI');
  const [paymentRef, setPaymentRef] = useState('');
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

  if (!isOpen) return null;

  const sym = gstSettings.currencySymbol || '₹';

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

  const activeGuest =
    guestMode === 'existing'
      ? guests.find((g) => g.id === selectedGuestId)
      : undefined;

  const folio = computeFoodBillFolio({
    foodOrders: cart,
    extraCharges,
    discount,
    advancePaid,
    gstSettings,
  });

  const handleAddFoodItem = () => {
    const item = foodMenu.find((f) => f.id === selectedFoodId);
    if (!item) return;
    setError('');
    setCart((prev) => {
      const existingIdx = prev.findIndex((c) => c.foodItemId === item.id);
      if (existingIdx !== -1) {
        return prev.map((c, idx) =>
          idx === existingIdx ? { ...c, quantity: c.quantity + foodQty } : c
        );
      }
      return [
        ...prev,
        {
          id: `cart-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          foodItemId: item.id,
          name: item.name,
          rate: item.rate,
          gstRate: item.gstRate,
          quantity: foodQty,
          orderedAt: new Date().toISOString(),
        },
      ];
    });
    setFoodQty(1);
  };

  const updateCartQty = (id: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((c) => (c.id === id ? { ...c, quantity: c.quantity + delta } : c))
        .filter((c) => c.quantity > 0)
    );
  };

  const handleAddExtra = () => {
    const amt = Number(extraAmount);
    if (!extraDesc.trim() || Number.isNaN(amt) || amt <= 0) return;
    setExtraCharges((prev) => [
      ...prev,
      {
        id: `ex-${Date.now()}`,
        description: extraDesc.trim(),
        amount: amt,
        taxable: true,
      },
    ]);
    setExtraDesc('');
    setExtraAmount('');
  };

  const handleGenerateBill = async () => {
    setError('');
    if (cart.length === 0 && extraCharges.length === 0) {
      setError('Please add at least one food item to generate the bill.');
      return;
    }

    setBusy(true);
    try {
      let finalGuestId: string | undefined = undefined;
      let guestName = 'Walk-in Guest';
      let guestMobile = '';
      let guestEmail = '';
      let companyName = '';
      let companyGst = '';

      if (guestMode === 'existing') {
        if (!activeGuest) {
          setError('Please select a guest or switch to Walk-In / New Guest.');
          setBusy(false);
          return;
        }
        finalGuestId = activeGuest.id;
        guestName = activeGuest.name;
        guestMobile = activeGuest.mobile;
        guestEmail = activeGuest.email;
        companyName = activeGuest.companyName;
        companyGst = activeGuest.companyGst;
      } else {
        guestName = newName.trim() || 'Walk-in Guest';
        guestMobile = newMobile.trim();
        guestEmail = newEmail.trim();
        companyName = newCompanyName.trim();
        companyGst = newCompanyGst.trim().toUpperCase();

        if (saveGuestProfile && newName.trim() && newMobile.trim()) {
          const created = await onCreateGuest({
            name: guestName,
            mobile: guestMobile,
            email: guestEmail,
            companyName,
            companyGst,
            idProofType: 'Aadhaar',
            idProofNumber: '',
            address: '',
            notes: 'Created via Food Billing',
          });
          finalGuestId = created.id;
        }
      }

      const safeOrderTime = orderTime || getCurrentTime24h();
      const orderIso = orderDate
        ? new Date(`${orderDate}T${safeOrderTime}:00`).toISOString()
        : new Date().toISOString();

      await onCreateFoodBill({
        guestId: finalGuestId,
        guestName,
        guestMobile,
        guestEmail,
        companyName,
        companyGst,
        serviceType,
        tableOrRef: tableOrRef.trim() || serviceType,
        orderDate: orderIso,
        orderTime: safeOrderTime,
        items: cart.map((c) => ({
          foodItemId: c.foodItemId,
          quantity: c.quantity,
        })),
        extraCharges,
        discount,
        advancePaid,
        paymentMethod,
        paymentReference: paymentRef,
        sendEmailReceipt,
        sendMobileInvoice,
        templatePreset,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to generate food bill.');
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-[1px] p-4">
      <div className="bg-white border border-slate-200 rounded-xl shadow-xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              New Separate Food Bill & Tax Invoice
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Create a standalone restaurant, dine-in, or takeaway GST bill with A4 print, email & mobile invoice dispatch.
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
          {/* Left Column: Customer, Order Timings & Food Items */}
          <div className="lg:col-span-7 space-y-5">
            {error && (
              <div className="p-3 text-xs font-medium text-rose-800 bg-rose-50 border border-rose-200 rounded-md">
                {error}
              </div>
            )}

            {/* 1. Guest / Customer Details */}
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  1. Guest / Customer Details
                </span>
                <div className="flex items-center gap-1 p-0.5 bg-slate-100 rounded-md">
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
                    <span>Walk-In / New</span>
                  </button>
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
                </div>
              </div>

              {guestMode === 'existing' ? (
                <div className="space-y-2">
                  <input
                    type="text"
                    value={guestSearch}
                    onChange={(e) => setGuestSearch(e.target.value)}
                    placeholder="Search guest by name, mobile, company, or GSTIN..."
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md"
                  />
                  <select
                    value={selectedGuestId}
                    onChange={(e) => setSelectedGuestId(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md bg-white"
                  >
                    {filteredGuests.length === 0 && (
                      <option value="">No matching guest — switch to Walk-In / New</option>
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
                <div className="space-y-2.5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <input
                      type="text"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder="Guest / Customer Name (default Walk-in)"
                      className="px-3 py-2 text-xs border border-slate-300 rounded-md"
                    />
                    <input
                      type="tel"
                      value={newMobile}
                      onChange={(e) => setNewMobile(e.target.value)}
                      placeholder="Mobile Number (for SMS / WhatsApp bill)"
                      className="px-3 py-2 text-xs font-mono border border-slate-300 rounded-md tabular-nums"
                    />
                    <input
                      type="email"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      placeholder="Email Address (for receipt)"
                      className="px-3 py-2 text-xs border border-slate-300 rounded-md"
                    />
                    <input
                      type="text"
                      value={newCompanyName}
                      onChange={(e) => setNewCompanyName(e.target.value)}
                      placeholder="Company Name (Optional)"
                      className="px-3 py-2 text-xs border border-slate-300 rounded-md"
                    />
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <input
                      type="text"
                      maxLength={15}
                      value={newCompanyGst}
                      onChange={(e) => setNewCompanyGst(e.target.value.toUpperCase())}
                      placeholder="Company GSTIN (15-char, optional)"
                      className="flex-1 min-w-[200px] px-3 py-2 text-xs font-mono uppercase border border-slate-300 rounded-md"
                    />
                    <label className="inline-flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={saveGuestProfile}
                        onChange={(e) => setSaveGuestProfile(e.target.checked)}
                      />
                      <span>Save to Guest Directory</span>
                    </label>
                  </div>
                </div>
              )}
            </div>

            {/* 2. Dining Service, Order Date & Time, Adjustments */}
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                    Service Type
                  </label>
                  <select
                    value={serviceType}
                    onChange={(e) => {
                      const val = e.target.value as typeof serviceType;
                      setServiceType(val);
                      if (val === 'Takeaway') setTableOrRef('Takeaway Counter');
                      else if (val === 'Dine-In') setTableOrRef('Table 1');
                      else if (val === 'Delivery') setTableOrRef('Parcel Delivery');
                    }}
                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-md"
                  >
                    <option value="Dine-In">Dine-In</option>
                    <option value="Takeaway">Takeaway</option>
                    <option value="Room Direct">Room Direct</option>
                    <option value="Delivery">Delivery</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                    Table / Ref
                  </label>
                  <input
                    type="text"
                    value={tableOrRef}
                    onChange={(e) => setTableOrRef(e.target.value)}
                    placeholder="Table 1"
                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                    Order Date
                  </label>
                  <input
                    type="date"
                    value={orderDate}
                    onChange={(e) => setOrderDate(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs font-mono tabular-nums bg-white border border-slate-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                    Order Time
                  </label>
                  <input
                    type="time"
                    value={orderTime}
                    onChange={(e) => setOrderTime(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs font-mono tabular-nums bg-white border border-slate-300 rounded-md"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
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
                    Advance / Token Paid ({sym})
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

            {/* 3. Food Items Picker */}
            <div className="space-y-2.5">
              <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
                <UtensilsCrossed className="w-3.5 h-3.5" />
                <span>2. Add Food & Beverage Items</span>
              </div>
              <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
                <select
                  value={selectedFoodId}
                  onChange={(e) => setSelectedFoodId(e.target.value)}
                  className="flex-1 min-w-[200px] px-3 py-2 text-xs border border-slate-300 rounded-md bg-white"
                >
                  {foodMenu.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name} — {formatCurrency(f.rate, sym)} (+{f.gstRate}% GST)
                      {!f.available ? ' [Unavailable]' : ''}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={foodQty}
                  onChange={(e) => setFoodQty(Math.max(1, Number(e.target.value)))}
                  className="w-16 px-2.5 py-2 text-xs font-mono tabular-nums border border-slate-300 rounded-md"
                />
                <button
                  type="button"
                  onClick={handleAddFoodItem}
                  disabled={!selectedFoodId}
                  className="inline-flex items-center gap-1 px-3 py-2 text-xs font-medium text-white bg-slate-900 rounded-md hover:bg-slate-800 whitespace-nowrap shrink-0 disabled:opacity-50"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Item</span>
                </button>
              </div>

              {cart.length > 0 && (
                <div className="border border-slate-200 rounded-md divide-y divide-slate-100">
                  {cart.map((order) => (
                    <div
                      key={order.id}
                      className="flex items-center justify-between px-3 py-2 text-xs gap-2"
                    >
                      <div className="min-w-0">
                        <div className="font-medium text-slate-900 truncate">
                          {order.name}
                        </div>
                        <div className="text-[11px] text-slate-500 tabular-nums">
                          {formatCurrency(order.rate, sym)} × {order.quantity} (+{order.gstRate}% GST)
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <div className="inline-flex items-center border border-slate-200 rounded">
                          <button
                            type="button"
                            onClick={() => updateCartQty(order.id, -1)}
                            className="p-1 text-slate-600 hover:bg-slate-100"
                            aria-label="Decrease quantity"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="px-2 font-mono tabular-nums text-slate-900">
                            {order.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => updateCartQty(order.id, 1)}
                            className="p-1 text-slate-600 hover:bg-slate-100"
                            aria-label="Increase quantity"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                        <span className="font-mono font-semibold tabular-nums text-slate-900 min-w-[72px] text-right">
                          {formatCurrency(order.quantity * order.rate, sym)}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setCart((prev) => prev.filter((c) => c.id !== order.id))
                          }
                          className="text-slate-400 hover:text-rose-600"
                          aria-label="Remove item"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 4. Extra F&B Charges (Packing, Delivery, Corkage) */}
            <div className="space-y-2.5">
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Add Packaging / Delivery / Extra Charge (Optional)
              </div>
              <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
                <input
                  type="text"
                  value={extraDesc}
                  onChange={(e) => setExtraDesc(e.target.value)}
                  placeholder="e.g. Takeaway Packaging, Mineral Water"
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
                  disabled={!extraDesc.trim() || !extraAmount}
                  className="inline-flex items-center gap-1 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 whitespace-nowrap shrink-0 disabled:opacity-50"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Charge</span>
                </button>
              </div>
              {extraCharges.length > 0 && (
                <div className="border border-slate-200 rounded-md divide-y divide-slate-100">
                  {extraCharges.map((ex) => (
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
                          onClick={() =>
                            setExtraCharges((prev) => prev.filter((e) => e.id !== ex.id))
                          }
                          className="text-slate-400 hover:text-rose-600"
                          aria-label="Remove extra charge"
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

          {/* Right Column: Live Food GST Bill & Settlement */}
          <div className="lg:col-span-5 space-y-4">
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-3 text-xs">
              <div className="border-b border-slate-200 pb-2 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-900 uppercase tracking-wider text-[11px]">
                    Live GST Food Bill
                  </span>
                  <span className="text-[11px] font-medium text-slate-600">
                    {serviceType} · {tableOrRef || serviceType}
                  </span>
                </div>
                <div className="text-[11px] text-slate-600 tabular-nums">
                  Order: {formatDateDisplay(`${orderDate}T12:00:00`)} · {formatTime12h(orderTime)}
                </div>
              </div>

              <div className="space-y-1.5 tabular-nums">
                <div className="flex justify-between text-slate-700">
                  <span>Food & Beverages ({cart.reduce((s, c) => s + c.quantity, 0)} items)</span>
                  <span className="font-mono">
                    {formatCurrency(folio.foodSubtotal, sym)}
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
                    <span>IGST</span>
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
                {folio.advancePaid > 0 && (
                  <div className="flex justify-between text-slate-600">
                    <span>Less Advance Paid</span>
                    <span className="font-mono">
                      -{formatCurrency(folio.advancePaid, sym)}
                    </span>
                  </div>
                )}
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
                    Auto-send bill to guest mobile ({gstSettings.mobileDispatchChannel})
                  </span>
                  <span className="block text-[11px] text-slate-500 mt-0.5 tabular-nums">
                    {(guestMode === 'existing' ? activeGuest?.mobile : newMobile)
                      ? `Send invoice & A4 link to ${guestMode === 'existing' ? activeGuest?.mobile : newMobile}`
                      : 'Add mobile number to send SMS / WhatsApp bill'}
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
                    {(guestMode === 'existing' ? activeGuest?.email : newEmail)
                      ? `Dispatch GST invoice to ${guestMode === 'existing' ? activeGuest?.email : newEmail}`
                      : 'Optional — enter email to send receipt'}
                  </span>
                </span>
              </label>

              <button
                type="button"
                onClick={handleGenerateBill}
                disabled={busy}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-slate-900 rounded-md hover:bg-slate-800 disabled:opacity-50"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>
                  {busy ? 'Generating Food Bill...' : 'Settle & Generate Food Bill'}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
