import {
  Booking,
  ExtraChargeItem,
  FoodOrderItem,
  GstSettings,
  InvoiceLineItem,
  Room,
} from '../types/hotel';

export interface FolioCalculation {
  nights: number;
  roomSubtotal: number;
  roomGstRate: number;
  roomGstAmount: number;
  foodSubtotal: number;
  foodGstAmount: number;
  extraChargesSubtotal: number;
  extraChargesGstAmount: number;
  serviceChargeAmount: number;
  serviceChargeGstAmount: number;
  discountAmount: number;
  taxableTotal: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  totalGst: number;
  grandTotal: number;
  advancePaid: number;
  balanceDue: number;
  lineItems: InvoiceLineItem[];
}

export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function resolveRoomGstRate(
  nightlyRate: number,
  gstSettings: GstSettings,
  roomOverride?: number | null
): number {
  if (!gstSettings.gstEnabled) return 0;
  if (roomOverride !== undefined && roomOverride !== null && !Number.isNaN(roomOverride)) {
    return Math.max(0, roomOverride);
  }
  if (gstSettings.roomGstMode === 'custom') {
    return Math.max(0, gstSettings.customRoomGstRate);
  }
  // Indian Hotel Accommodation GST Slabs (per room per night declared/transaction value)
  if (nightlyRate <= 1000) return 0;
  if (nightlyRate <= 7500) return 12;
  return 18;
}

export function toLocalDateInput(iso?: string): string {
  if (!iso) {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function getCurrentTime24h(): string {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

export function parsePolicyTimeTo24h(policyTime?: string, fallback = '12:00'): string {
  if (!policyTime) return fallback;
  const trimmed = policyTime.trim();
  const match12 = trimmed.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (match12) {
    let hour = Number(match12[1]);
    const min = match12[2];
    const period = match12[3].toUpperCase();
    if (period === 'PM' && hour < 12) hour += 12;
    if (period === 'AM' && hour === 12) hour = 0;
    return `${String(hour).padStart(2, '0')}:${min}`;
  }
  const match24 = trimmed.match(/^(\d{1,2}):(\d{2})$/);
  if (match24) {
    return `${String(Math.min(23, Number(match24[1]))).padStart(2, '0')}:${match24[2]}`;
  }
  return fallback;
}

export function extractTime24h(iso?: string, explicitTime?: string): string {
  if (explicitTime && /^\d{2}:\d{2}$/.test(explicitTime.trim())) {
    return explicitTime.trim();
  }
  if (!iso) return '12:00';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '12:00';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function formatTime12h(time24?: string): string {
  if (!time24 || !/^\d{1,2}:\d{2}$/.test(time24.trim())) return '';
  const [hStr, mStr] = time24.trim().split(':');
  const hour24 = Number(hStr);
  const period = hour24 >= 12 ? 'PM' : 'AM';
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return `${String(hour12).padStart(2, '0')}:${mStr} ${period}`;
}

export function computeNightsBetween(checkIn: string, checkOut: string): number {
  const startDay = toLocalDateInput(checkIn);
  const endDay = toLocalDateInput(checkOut);
  const start = new Date(`${startDay}T12:00:00`);
  const end = new Date(`${endDay}T12:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 1;
  const diffDays = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  return Math.max(1, diffDays);
}

export function computeBookingFolio(
  booking: Booking,
  room: Room | undefined,
  gstSettings: GstSettings
): FolioCalculation {
  const nights = Math.max(1, booking.nights || 1);
  const ratePerNight = Math.max(0, booking.roomRatePerNight ?? room?.rate ?? 0);
  const rawRoomSubtotal = round2(nights * ratePerNight);
  const discountAmount = Math.min(rawRoomSubtotal, Math.max(0, booking.discount || 0));
  const taxableRoomSubtotal = round2(Math.max(0, rawRoomSubtotal - discountAmount));

  const effectiveNightlyAfterDiscount = taxableRoomSubtotal / nights;
  const roomGstRate = resolveRoomGstRate(
    effectiveNightlyAfterDiscount,
    gstSettings,
    room?.gstRateOverride ?? null
  );
  const roomGstAmount = round2((taxableRoomSubtotal * roomGstRate) / 100);

  const lineItems: InvoiceLineItem[] = [
    {
      description: `Room ${room?.number ?? ''} (${room?.type ?? 'Deluxe Room'}) — ${nights} Night${nights > 1 ? 's' : ''}${discountAmount > 0 ? ` (after ${gstSettings.currencySymbol}${discountAmount} discount)` : ''}`,
      sac: gstSettings.roomSacCode || '996311',
      qty: nights,
      rate: ratePerNight,
      taxable: taxableRoomSubtotal,
      gstRate: roomGstRate,
      gstAmount: roomGstAmount,
      total: round2(taxableRoomSubtotal + roomGstAmount),
    },
  ];

  let foodSubtotal = 0;
  let foodGstAmount = 0;

  for (const order of booking.foodOrders || []) {
    const itemTaxable = round2(order.rate * order.quantity);
    const effectiveFoodGstRate = !gstSettings.gstEnabled
      ? 0
      : gstSettings.foodGstMode === 'uniform'
        ? gstSettings.customFoodGstRate
        : order.gstRate;
    const itemGst = round2((itemTaxable * effectiveFoodGstRate) / 100);
    foodSubtotal = round2(foodSubtotal + itemTaxable);
    foodGstAmount = round2(foodGstAmount + itemGst);

    lineItems.push({
      description: `F&B: ${order.name}`,
      sac: gstSettings.foodSacCode || '996331',
      qty: order.quantity,
      rate: order.rate,
      taxable: itemTaxable,
      gstRate: effectiveFoodGstRate,
      gstAmount: itemGst,
      total: round2(itemTaxable + itemGst),
    });
  }

  let extraChargesSubtotal = 0;
  let extraChargesGstAmount = 0;

  for (const extra of booking.extraCharges || []) {
    const amount = round2(Math.max(0, extra.amount));
    const gstRate = gstSettings.gstEnabled && extra.taxable ? roomGstRate : 0;
    const gstAmt = round2((amount * gstRate) / 100);
    extraChargesSubtotal = round2(extraChargesSubtotal + amount);
    extraChargesGstAmount = round2(extraChargesGstAmount + gstAmt);

    lineItems.push({
      description: extra.description,
      sac: gstSettings.roomSacCode || '996311',
      qty: 1,
      rate: amount,
      taxable: amount,
      gstRate,
      gstAmount: gstAmt,
      total: round2(amount + gstAmt),
    });
  }

  const baseForService = round2(taxableRoomSubtotal + foodSubtotal + extraChargesSubtotal);
  const serviceChargeAmount =
    gstSettings.serviceChargeRate > 0
      ? round2((baseForService * gstSettings.serviceChargeRate) / 100)
      : 0;

  const serviceChargeGstAmount =
    gstSettings.gstEnabled &&
    gstSettings.applyGstOnServiceCharge &&
    serviceChargeAmount > 0
      ? round2((serviceChargeAmount * roomGstRate) / 100)
      : 0;

  if (serviceChargeAmount > 0) {
    lineItems.push({
      description: `Hospitality Service Charge (${gstSettings.serviceChargeRate}%)`,
      sac: gstSettings.roomSacCode || '996311',
      qty: 1,
      rate: serviceChargeAmount,
      taxable: serviceChargeAmount,
      gstRate: gstSettings.applyGstOnServiceCharge && gstSettings.gstEnabled ? roomGstRate : 0,
      gstAmount: serviceChargeGstAmount,
      total: round2(serviceChargeAmount + serviceChargeGstAmount),
    });
  }

  const taxableTotal = round2(
    taxableRoomSubtotal + foodSubtotal + extraChargesSubtotal + serviceChargeAmount
  );
  const totalGst = round2(
    roomGstAmount + foodGstAmount + extraChargesGstAmount + serviceChargeGstAmount
  );

  let cgstAmount = 0;
  let sgstAmount = 0;
  let igstAmount = 0;

  if (gstSettings.taxRegime === 'IGST') {
    igstAmount = totalGst;
  } else {
    cgstAmount = round2(totalGst / 2);
    sgstAmount = round2(totalGst - cgstAmount);
  }

  const grandTotal = round2(taxableTotal + totalGst);
  const advancePaid = round2(Math.max(0, booking.advancePaid || 0));
  const balanceDue = round2(grandTotal - advancePaid);

  return {
    nights,
    roomSubtotal: rawRoomSubtotal,
    roomGstRate,
    roomGstAmount,
    foodSubtotal,
    foodGstAmount,
    extraChargesSubtotal,
    extraChargesGstAmount,
    serviceChargeAmount,
    serviceChargeGstAmount,
    discountAmount,
    taxableTotal,
    cgstAmount,
    sgstAmount,
    igstAmount,
    totalGst,
    grandTotal,
    advancePaid,
    balanceDue,
    lineItems,
  };
}

export function computeFoodBillFolio(params: {
  foodOrders: FoodOrderItem[];
  extraCharges: ExtraChargeItem[];
  discount: number;
  advancePaid: number;
  gstSettings: GstSettings;
}): FolioCalculation {
  const { foodOrders, extraCharges, discount, advancePaid, gstSettings } = params;
  const rawFoodSubtotal = round2(
    foodOrders.reduce((sum, item) => sum + item.rate * item.quantity, 0)
  );
  const discountAmount = Math.min(rawFoodSubtotal, Math.max(0, discount || 0));
  const discountRatio =
    rawFoodSubtotal > 0 ? (rawFoodSubtotal - discountAmount) / rawFoodSubtotal : 1;

  let taxableFoodSubtotal = 0;
  let foodGstAmount = 0;
  const lineItems: InvoiceLineItem[] = [];

  for (const order of foodOrders) {
    const gross = round2(order.rate * order.quantity);
    const itemTaxable = round2(gross * discountRatio);
    const effectiveFoodGstRate = !gstSettings.gstEnabled
      ? 0
      : gstSettings.foodGstMode === 'uniform'
        ? gstSettings.customFoodGstRate
        : order.gstRate;
    const itemGst = round2((itemTaxable * effectiveFoodGstRate) / 100);
    taxableFoodSubtotal = round2(taxableFoodSubtotal + itemTaxable);
    foodGstAmount = round2(foodGstAmount + itemGst);

    lineItems.push({
      description: `${order.name}${discountAmount > 0 ? ' (net of discount)' : ''}`,
      sac: gstSettings.foodSacCode || '996331',
      qty: order.quantity,
      rate: order.rate,
      taxable: itemTaxable,
      gstRate: effectiveFoodGstRate,
      gstAmount: itemGst,
      total: round2(itemTaxable + itemGst),
    });
  }

  const defaultFoodGst = !gstSettings.gstEnabled
    ? 0
    : gstSettings.foodGstMode === 'uniform'
      ? gstSettings.customFoodGstRate
      : 5;

  let extraChargesSubtotal = 0;
  let extraChargesGstAmount = 0;
  for (const extra of extraCharges || []) {
    const amount = round2(Math.max(0, extra.amount));
    const gstRate = gstSettings.gstEnabled && extra.taxable ? defaultFoodGst : 0;
    const gstAmt = round2((amount * gstRate) / 100);
    extraChargesSubtotal = round2(extraChargesSubtotal + amount);
    extraChargesGstAmount = round2(extraChargesGstAmount + gstAmt);

    lineItems.push({
      description: extra.description,
      sac: gstSettings.foodSacCode || '996331',
      qty: 1,
      rate: amount,
      taxable: amount,
      gstRate,
      gstAmount: gstAmt,
      total: round2(amount + gstAmt),
    });
  }

  const baseForService = round2(taxableFoodSubtotal + extraChargesSubtotal);
  const serviceChargeAmount =
    gstSettings.serviceChargeRate > 0
      ? round2((baseForService * gstSettings.serviceChargeRate) / 100)
      : 0;
  const serviceChargeGstAmount =
    gstSettings.gstEnabled &&
    gstSettings.applyGstOnServiceCharge &&
    serviceChargeAmount > 0
      ? round2((serviceChargeAmount * defaultFoodGst) / 100)
      : 0;

  if (serviceChargeAmount > 0) {
    lineItems.push({
      description: `Restaurant Service Charge (${gstSettings.serviceChargeRate}%)`,
      sac: gstSettings.foodSacCode || '996331',
      qty: 1,
      rate: serviceChargeAmount,
      taxable: serviceChargeAmount,
      gstRate: gstSettings.applyGstOnServiceCharge && gstSettings.gstEnabled ? defaultFoodGst : 0,
      gstAmount: serviceChargeGstAmount,
      total: round2(serviceChargeAmount + serviceChargeGstAmount),
    });
  }

  const taxableTotal = round2(
    taxableFoodSubtotal + extraChargesSubtotal + serviceChargeAmount
  );
  const totalGst = round2(
    foodGstAmount + extraChargesGstAmount + serviceChargeGstAmount
  );

  let cgstAmount = 0;
  let sgstAmount = 0;
  let igstAmount = 0;
  if (gstSettings.taxRegime === 'IGST') {
    igstAmount = totalGst;
  } else {
    cgstAmount = round2(totalGst / 2);
    sgstAmount = round2(totalGst - cgstAmount);
  }

  const grandTotal = round2(taxableTotal + totalGst);
  const cleanAdvance = round2(Math.max(0, advancePaid || 0));
  const balanceDue = round2(grandTotal - cleanAdvance);

  return {
    nights: 0,
    roomSubtotal: 0,
    roomGstRate: 0,
    roomGstAmount: 0,
    foodSubtotal: rawFoodSubtotal,
    foodGstAmount,
    extraChargesSubtotal,
    extraChargesGstAmount,
    serviceChargeAmount,
    serviceChargeGstAmount,
    discountAmount,
    taxableTotal,
    cgstAmount,
    sgstAmount,
    igstAmount,
    totalGst,
    grandTotal,
    advancePaid: cleanAdvance,
    balanceDue,
    lineItems,
  };
}

export function formatCurrency(amount: number, symbol = '₹'): string {
  const safe = Number.isFinite(amount) ? amount : 0;
  const locale = symbol === '₹' ? 'en-IN' : 'en-US';
  const formatted = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(safe));
  return `${safe < 0 ? '-' : ''}${symbol}${formatted}`;
}

export function formatDateDisplay(iso: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function formatDateTimeDisplay(iso: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatStayDateTime(iso: string, explicitTime?: string): string {
  if (!iso) return '—';
  const datePart = formatDateDisplay(iso);
  const time24 = extractTime24h(iso, explicitTime);
  const time12 = formatTime12h(time24);
  return time12 ? `${datePart} · ${time12}` : datePart;
}

export function formatTemplateDateTime(iso: string, explicitTime?: string): string {
  if (!iso) return '—';
  const day = toLocalDateInput(iso);
  const [y, m, d] = day.split('-');
  const datePart = y && m && d ? `${d}-${m}-${y}` : formatDateDisplay(iso);
  const time24 = extractTime24h(iso, explicitTime);
  const time12 = formatTime12h(time24);
  return time12 ? `${datePart} ${time12}` : datePart;
}

const ONES = [
  '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
  'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
  'Seventeen', 'Eighteen', 'Nineteen',
];
const TENS = [
  '', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seven' + 'ty', 'Eighty', 'Ninety',
];

function twoDigitWords(n: number): string {
  if (n < 20) return ONES[n] || '';
  const t = Math.floor(n / 10);
  const o = n % 10;
  return o ? `${TENS[t]} ${ONES[o]}` : TENS[t];
}

function integerToIndianWords(num: number): string {
  if (num === 0) return 'Zero';
  const parts: string[] = [];
  const crore = Math.floor(num / 10000000);
  num %= 10000000;
  const lakh = Math.floor(num / 100000);
  num %= 100000;
  const thousand = Math.floor(num / 1000);
  num %= 1000;
  const hundred = Math.floor(num / 100);
  const rest = num % 100;

  if (crore > 0) parts.push(`${integerToIndianWords(crore)} Crore`);
  if (lakh > 0) parts.push(`${twoDigitWords(lakh)} Lakh`);
  if (thousand > 0) parts.push(`${twoDigitWords(thousand)} Thousand`);
  if (hundred > 0) parts.push(`${ONES[hundred]} Hundred`);
  if (rest > 0) {
    if (parts.length > 0) parts.push('And');
    parts.push(twoDigitWords(rest));
  }
  return parts.join(' ');
}

export function amountInIndianWords(amount: number): string {
  const safe = Math.max(0, Number.isFinite(amount) ? amount : 0);
  const rupees = Math.floor(safe);
  const paise = Math.round((safe - rupees) * 100);
  const rupeeWords = integerToIndianWords(rupees);
  if (paise > 0) {
    return `${rupeeWords} And ${twoDigitWords(paise)} Paise Inr`;
  }
  return `${rupeeWords} Inr`;
}

