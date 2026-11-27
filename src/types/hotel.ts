export type RoomType =
  | 'Deluxe Room'
  | 'Super Deluxe Room'
  | 'Family Room';

export type RoomStatus =
  | 'Available'
  | 'Occupied'
  | 'Held'
  | 'Housekeeping'
  | 'Maintenance';

export interface Room {
  id: string;
  number: string;
  floor: number;
  type: RoomType;
  rate: number;
  maxOccupancy: number;
  amenities: string[];
  status: RoomStatus;
  gstRateOverride: number | null;
}

export interface Guest {
  id: string;
  name: string;
  mobile: string;
  email: string;
  companyName: string;
  companyGst: string;
  idProofType: 'Aadhaar' | 'Passport' | 'Driving License' | 'Voter ID' | 'Corporate ID';
  idProofNumber: string;
  address: string;
  notes: string;
  createdAt: string;
}

export type FoodCategory =
  | 'Breakfast'
  | 'Main Course'
  | 'Beverages'
  | 'Snacks'
  | 'Desserts';

export interface FoodItem {
  id: string;
  name: string;
  category: FoodCategory;
  rate: number;
  gstRate: number;
  isVeg: boolean;
  available: boolean;
  description: string;
}

export interface FoodOrderItem {
  id: string;
  foodItemId: string;
  name: string;
  rate: number;
  gstRate: number;
  quantity: number;
  orderedAt: string;
  notes?: string;
}

export interface ExtraChargeItem {
  id: string;
  description: string;
  amount: number;
  taxable: boolean;
}

export type BookingStatus = 'Held' | 'CheckedIn' | 'CheckedOut' | 'Cancelled';

export interface Booking {
  id: string;
  bookingCode: string;
  guestId: string;
  roomId: string;
  status: BookingStatus;
  checkInDate: string;
  checkInTime?: string;
  checkOutDate: string;
  checkOutTime?: string;
  actualCheckOutAt?: string;
  nights: number;
  adults: number;
  children: number;
  roomRatePerNight: number;
  advancePaid: number;
  discount: number;
  foodOrders: FoodOrderItem[];
  extraCharges: ExtraChargeItem[];
  specialRequests: string;
  holdExpiresAt?: string;
  invoiceId?: string;
  createdAt: string;
  updatedAt: string;
}

export type StaffRole =
  | 'Front Desk Manager'
  | 'Receptionist'
  | 'Housekeeping Lead'
  | 'Room Attendant'
  | 'Chef / F&B'
  | 'Night Auditor'
  | 'Accountant';

export type ShiftCode = 'Morning' | 'Afternoon' | 'Night' | 'Off';

export type WeekDay = 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun';

export interface StaffMember {
  id: string;
  name: string;
  role: StaffRole;
  mobile: string;
  email: string;
  status: 'On Shift' | 'Off Duty' | 'On Leave';
  defaultShift: 'Morning (06:00–14:00)' | 'Afternoon (14:00–22:00)' | 'Night (22:00–06:00)';
  schedule: Record<WeekDay, ShiftCode>;
  notes: string;
  joinedAt: string;
}

export interface GstSettings {
  gstEnabled: boolean;
  roomGstMode: 'auto_slab' | 'custom';
  customRoomGstRate: number;
  customFoodGstRate: number;
  foodGstMode: 'item_rate' | 'uniform';
  taxRegime: 'CGST_SGST' | 'IGST';
  serviceChargeRate: number;
  applyGstOnServiceCharge: boolean;
  hotelLegalName: string;
  hotelTradeName: string;
  hotelGstNumber: string;
  hotelPan: string;
  hotelAddress: string;
  hotelStateCode: string;
  hotelPhone: string;
  hotelEmail: string;
  roomSacCode: string;
  foodSacCode: string;
  currencySymbol: string;
  autoEmailReceipts: boolean;
  autoSmsReceipts: boolean;
  mobileDispatchChannel: 'SMS' | 'WhatsApp' | 'Both';
  hotelPolicy: string;
  checkInPolicyTime: string;
  checkOutPolicyTime: string;
}

export type InvoiceThemePreset =
  | 'shiv_residency_classic'
  | 'executive_classic'
  | 'modern_minimal'
  | 'boutique_gold'
  | 'corporate_slate'
  | 'royal_heritage';

export interface InvoiceTheme {
  preset: InvoiceThemePreset;
  accentColor: string;
  monogram: string;
  headerTagline: string;
  footerNote: string;
  termsAndConditions: string;
  signatoryTitle: string;
  showGstBreakdown: boolean;
  showSacCodes: boolean;
  showCompanyGstBlock: boolean;
  showPaymentSummary: boolean;
}

export interface InvoiceLineItem {
  description: string;
  sac: string;
  qty: number;
  rate: number;
  taxable: number;
  gstRate: number;
  gstAmount: number;
  total: number;
}

export type PaymentMethod =
  | 'UPI'
  | 'Card'
  | 'Cash'
  | 'Corporate Credit'
  | 'Bank Transfer';

export interface Invoice {
  id: string;
  billNumber?: string;
  invoiceNumber: string;
  invoiceType?: 'room' | 'food';
  serviceLabel?: string;
  bookingId: string;
  guestId: string;
  guestName: string;
  guestMobile: string;
  guestEmail: string;
  guestAddress?: string;
  guestCount?: number;
  companyName: string;
  companyGst: string;
  roomNumber: string;
  roomType: string;
  checkInDate: string;
  checkInTime?: string;
  checkOutDate: string;
  checkOutTime?: string;
  nights: number;
  roomSubtotal: number;
  roomGstRate: number;
  roomGstAmount: number;
  foodSubtotal: number;
  foodGstAmount: number;
  extraChargesSubtotal: number;
  serviceChargeAmount: number;
  discountAmount: number;
  taxableTotal: number;
  taxRegime: 'CGST_SGST' | 'IGST';
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  totalGst: number;
  grandTotal: number;
  advancePaid: number;
  netPaid: number;
  paymentMethod: PaymentMethod;
  paymentReference: string;
  issuedAt: string;
  templatePreset?: InvoiceThemePreset;
  emailStatus: 'Sent' | 'Archived' | 'Failed' | 'Skipped';
  emailSentAt?: string;
  mobileStatus?: 'Sent' | 'Archived' | 'Failed' | 'Skipped';
  mobileSentAt?: string;
  lineItems: InvoiceLineItem[];
}

export interface EmailReceiptLog {
  id: string;
  invoiceId: string;
  billNumber?: string;
  invoiceNumber: string;
  recipientEmail: string;
  recipientName: string;
  subject: string;
  amount: number;
  status: 'Delivered (SMTP)' | 'Archived Receipt (Local Dispatch)' | 'Failed';
  sentAt: string;
  htmlBody: string;
  errorMessage?: string;
}

export interface MobileInvoiceLog {
  id: string;
  invoiceId: string;
  billNumber?: string;
  invoiceNumber: string;
  recipientMobile: string;
  recipientName: string;
  channel: 'SMS' | 'WhatsApp';
  messageText: string;
  invoiceUrl: string;
  amount: number;
  status: 'Delivered (Gateway)' | 'Archived Dispatch (Ready)' | 'Failed';
  sentAt: string;
  errorMessage?: string;
}

export interface HotelBootstrapData {
  rooms: Room[];
  guests: Guest[];
  bookings: Booking[];
  foodMenu: FoodItem[];
  staff: StaffMember[];
  invoices: Invoice[];
  emailLogs: EmailReceiptLog[];
  mobileLogs: MobileInvoiceLog[];
  gstSettings: GstSettings;
  invoiceTheme: InvoiceTheme;
  smtpConfigured: boolean;
  smsConfigured: boolean;
}
