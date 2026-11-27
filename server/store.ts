import fs from 'fs';
import path from 'path';
import {
  Booking,
  EmailReceiptLog,
  FoodItem,
  GstSettings,
  Guest,
  Invoice,
  InvoiceTheme,
  MobileInvoiceLog,
  Room,
  StaffMember,
} from '../src/types/hotel';

export interface DatabaseState {
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
  invoiceSeq: number;
  billSeq: number;
  bookingSeq: number;
  templateDesignApplied?: boolean;
  roomCategoriesV2Applied?: boolean;
  billNumberV1Applied?: boolean;
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'pms-db.json');

function createSeedDatabase(): DatabaseState {
  const rooms: Room[] = [
    { id: 'rm-101', number: '101', floor: 1, type: 'Deluxe Room', rate: 3200, maxOccupancy: 2, amenities: ['Wi-Fi', 'Work Desk', 'Smart TV', 'Tea/Coffee'], status: 'Available', gstRateOverride: null },
    { id: 'rm-102', number: '102', floor: 1, type: 'Deluxe Room', rate: 3200, maxOccupancy: 2, amenities: ['Wi-Fi', 'Work Desk', 'Smart TV'], status: 'Available', gstRateOverride: null },
    { id: 'rm-103', number: '103', floor: 1, type: 'Deluxe Room', rate: 3500, maxOccupancy: 2, amenities: ['Wi-Fi', 'Garden View', 'Smart TV'], status: 'Available', gstRateOverride: null },
    { id: 'rm-104', number: '104', floor: 1, type: 'Super Deluxe Room', rate: 4800, maxOccupancy: 3, amenities: ['King Bed', 'Balcony', 'Mini Bar', 'Rain Shower'], status: 'Available', gstRateOverride: null },
    { id: 'rm-201', number: '201', floor: 2, type: 'Super Deluxe Room', rate: 5200, maxOccupancy: 3, amenities: ['King Bed', 'City View', 'Espresso Bar', 'Lounge'], status: 'Available', gstRateOverride: null },
    { id: 'rm-202', number: '202', floor: 2, type: 'Super Deluxe Room', rate: 5200, maxOccupancy: 3, amenities: ['Twin Beds', 'City View', 'Smart TV'], status: 'Available', gstRateOverride: null },
    { id: 'rm-203', number: '203', floor: 2, type: 'Super Deluxe Room', rate: 6400, maxOccupancy: 4, amenities: ['Living Area', 'Bathtub', 'Airport Transfer', 'Breakfast'], status: 'Available', gstRateOverride: null },
    { id: 'rm-204', number: '204', floor: 2, type: 'Family Room', rate: 7200, maxOccupancy: 4, amenities: ['Two Queen Beds', 'Seating Area', 'Balcony'], status: 'Available', gstRateOverride: null },
    { id: 'rm-301', number: '301', floor: 3, type: 'Super Deluxe Room', rate: 5800, maxOccupancy: 3, amenities: ['Corner Terrace', 'Smart TV', 'Mini Bar'], status: 'Available', gstRateOverride: null },
    { id: 'rm-302', number: '302', floor: 3, type: 'Family Room', rate: 8400, maxOccupancy: 6, amenities: ['Private Dining', 'King + Twin Beds', 'Panoramic View'], status: 'Available', gstRateOverride: null },
    { id: 'rm-303', number: '303', floor: 3, type: 'Deluxe Room', rate: 2800, maxOccupancy: 2, amenities: ['Queen Bed', 'Wi-Fi', 'Work Desk'], status: 'Available', gstRateOverride: null },
    { id: 'rm-304', number: '304', floor: 3, type: 'Family Room', rate: 6800, maxOccupancy: 4, amenities: ['King Bed', 'Balcony', 'Bathtub'], status: 'Available', gstRateOverride: null },
  ];

  const guests: Guest[] = [];

  const foodMenu: FoodItem[] = [
    { id: 'fd-1', name: 'Artisanal Masala Dosa & Filter Coffee', category: 'Breakfast', rate: 320, gstRate: 5, isVeg: true, available: true, description: 'Crisp fermented crepe with coconut chutney, sambar, and estate coffee.' },
    { id: 'fd-2', name: 'Continental Breakfast Platter', category: 'Breakfast', rate: 450, gstRate: 5, isVeg: false, available: true, description: 'Two eggs to order, sourdough toast, butter, preserves, and fresh juice.' },
    { id: 'fd-3', name: 'Paneer Tikka Makhani & Garlic Naan', category: 'Main Course', rate: 620, gstRate: 5, isVeg: true, available: true, description: 'Char-grilled cottage cheese simmered in velvet tomato cashew gravy.' },
    { id: 'fd-4', name: 'Malabar Pepper Chicken & Appam', category: 'Main Course', rate: 740, gstRate: 5, isVeg: false, available: true, description: 'Slow-roasted Tellicherry peppercorn chicken with lacy rice hoppers.' },
    { id: 'fd-5', name: 'Subz Dum Biryani with Burhani Raita', category: 'Main Course', rate: 560, gstRate: 5, isVeg: true, available: true, description: 'Aged basmati layered with saffron, mint, and seasonal vegetables.' },
    { id: 'fd-6', name: 'Truffle Fries & Herb Aioli', category: 'Snacks', rate: 380, gstRate: 5, isVeg: true, available: true, description: 'Hand-cut crisp potatoes tossed in parmesan and white truffle oil.' },
    { id: 'fd-7', name: 'Club Sandwich (Grilled Chicken)', category: 'Snacks', rate: 440, gstRate: 5, isVeg: false, available: true, description: 'Triple-decker toasted brioche with smoked chicken, egg, and cheddar.' },
    { id: 'fd-8', name: 'Cold Brew Tonic / Fresh Lime Soda', category: 'Beverages', rate: 210, gstRate: 5, isVeg: true, available: true, description: 'Single-origin 18-hour cold brew or sparkling citrus refresher.' },
    { id: 'fd-9', name: 'Masala Chai Pot (Serves 2)', category: 'Beverages', rate: 180, gstRate: 5, isVeg: true, available: true, description: 'Assam CTC brewed with crushed cardamom, ginger, and lemongrass.' },
    { id: 'fd-10', name: 'Warm Gulab Jamun with Vanilla Bean', category: 'Desserts', rate: 290, gstRate: 5, isVeg: true, available: true, description: 'Saffron syrup-soaked khoya dumplings paired with Madagascar vanilla.' },
  ];

  const bookings: Booking[] = [];
  const invoices: Invoice[] = [];
  const emailLogs: EmailReceiptLog[] = [];
  const mobileLogs: MobileInvoiceLog[] = [];

  const staff: StaffMember[] = [
    {
      id: 'stf-1',
      name: 'Priya Sharma',
      role: 'Front Desk Manager',
      mobile: '9822011401',
      email: 'priya.sharma@hotelshivresidency.com',
      status: 'On Shift',
      defaultShift: 'Morning (06:00–14:00)',
      schedule: { Mon: 'Morning', Tue: 'Morning', Wed: 'Morning', Thu: 'Morning', Fri: 'Morning', Sat: 'Morning', Sun: 'Off' },
      notes: 'Handles VIP check-ins and corporate GST reconciliation.',
      joinedAt: '2024-03-15',
    },
    {
      id: 'stf-2',
      name: 'Arjun Verma',
      role: 'Receptionist',
      mobile: '9822011402',
      email: 'arjun.verma@hotelshivresidency.com',
      status: 'On Shift',
      defaultShift: 'Afternoon (14:00–22:00)',
      schedule: { Mon: 'Afternoon', Tue: 'Afternoon', Wed: 'Off', Thu: 'Afternoon', Fri: 'Afternoon', Sat: 'Afternoon', Sun: 'Afternoon' },
      notes: 'Evening arrivals & held check-in conversions.',
      joinedAt: '2024-07-01',
    },
    {
      id: 'stf-3',
      name: 'Kavita Rao',
      role: 'Housekeeping Lead',
      mobile: '9822011403',
      email: 'kavita.rao@hotelshivresidency.com',
      status: 'On Shift',
      defaultShift: 'Morning (06:00–14:00)',
      schedule: { Mon: 'Morning', Tue: 'Morning', Wed: 'Morning', Thu: 'Off', Fri: 'Morning', Sat: 'Morning', Sun: 'Morning' },
      notes: 'Room turnaround inspection for floors 1–3.',
      joinedAt: '2023-11-10',
    },
    {
      id: 'stf-4',
      name: 'Chef Devendra Joshi',
      role: 'Chef / F&B',
      mobile: '9822011404',
      email: 'devendra.joshi@hotelshivresidency.com',
      status: 'On Shift',
      defaultShift: 'Morning (06:00–14:00)',
      schedule: { Mon: 'Morning', Tue: 'Off', Wed: 'Morning', Thu: 'Morning', Fri: 'Afternoon', Sat: 'Afternoon', Sun: 'Morning' },
      notes: 'Executive kitchen & room-service menu lead.',
      joinedAt: '2023-06-20',
    },
    {
      id: 'stf-5',
      name: 'Imran Qureshi',
      role: 'Night Auditor',
      mobile: '9822011405',
      email: 'imran.qureshi@hotelshivresidency.com',
      status: 'Off Duty',
      defaultShift: 'Night (22:00–06:00)',
      schedule: { Mon: 'Night', Tue: 'Night', Wed: 'Night', Thu: 'Night', Fri: 'Off', Sat: 'Night', Sun: 'Night' },
      notes: 'Overnight check-ins and daily GST ledger audit.',
      joinedAt: '2024-01-12',
    },
    {
      id: 'stf-6',
      name: 'Neha Bhatia',
      role: 'Accountant',
      mobile: '9822011406',
      email: 'neha.bhatia@hotelshivresidency.com',
      status: 'On Shift',
      defaultShift: 'Morning (06:00–14:00)',
      schedule: { Mon: 'Morning', Tue: 'Morning', Wed: 'Morning', Thu: 'Morning', Fri: 'Morning', Sat: 'Off', Sun: 'Off' },
      notes: 'GSTR-1 filings and corporate credit settlements.',
      joinedAt: '2024-05-08',
    },
  ];

  const gstSettings: GstSettings = {
    gstEnabled: true,
    roomGstMode: 'auto_slab',
    customRoomGstRate: 12,
    customFoodGstRate: 5,
    foodGstMode: 'item_rate',
    taxRegime: 'CGST_SGST',
    serviceChargeRate: 0,
    applyGstOnServiceCharge: false,
    hotelLegalName: 'Hotel Shiv Residency',
    hotelTradeName: 'Hotel Shiv Residency',
    hotelGstNumber: '27AABCM7492R1Z3',
    hotelPan: '',
    hotelAddress: 'New Station Road, Bhuj - Kutch, Gujarat, 370001',
    hotelStateCode: '24 (Gujarat)',
    hotelPhone: '+91 99780 04999',
    hotelEmail: 'billing@hotelshivresidency.com',
    roomSacCode: '996311',
    foodSacCode: '996331',
    currencySymbol: '₹',
    autoEmailReceipts: true,
    autoSmsReceipts: true,
    mobileDispatchChannel: 'SMS',
    hotelPolicy:
      '1) Check in time is 12:00 PM and check out time is 10:00 AM.\n2) Guest agrees to pay all charges incurred, abide by hotel policies, and be responsible for any damages or losses during their stay.',
    checkInPolicyTime: '12:00 PM',
    checkOutPolicyTime: '10:00 AM',
  };

  const invoiceTheme: InvoiceTheme = {
    preset: 'shiv_residency_classic',
    accentColor: '#F58220',
    monogram: 'HSR',
    headerTagline: 'Warm Hospitality & Executive Comfort',
    footerNote:
      'Thank you for staying with us.\nWe offer customized package for corporate clients.',
    termsAndConditions:
      '1) Check in time is 12:00 PM and check out time is 10:00 AM.\n2) Guest agrees to pay all charges incurred, abide by hotel policies, and be responsible for any damages or losses during their stay.',
    signatoryTitle: "Cashier's Sign",
    showGstBreakdown: true,
    showSacCodes: true,
    showCompanyGstBlock: true,
    showPaymentSummary: true,
  };

  return {
    rooms,
    guests,
    bookings,
    foodMenu,
    staff,
    invoices,
    emailLogs,
    mobileLogs,
    gstSettings,
    invoiceTheme,
    invoiceSeq: 1001,
    billSeq: 5001,
    bookingSeq: 1001,
    templateDesignApplied: true,
    roomCategoriesV2Applied: true,
    billNumberV1Applied: true,
  };
}

function extractTrailingNumber(code?: string): number {
  if (!code) return 0;
  const match = String(code).match(/(\d+)$/);
  return match ? Number(match[1]) : 0;
}

export function allocateBillAndInvoiceNumbers(
  db: DatabaseState,
  kind: 'room' | 'food'
): { billNumber: string; invoiceNumber: string } {
  const year = new Date().getFullYear();
  const usedBillNumbers = new Set<string>();
  const usedInvoiceNumbers = new Set<string>();

  for (const inv of db.invoices || []) {
    if (inv.billNumber) usedBillNumbers.add(inv.billNumber);
    if (inv.invoiceNumber) usedInvoiceNumbers.add(inv.invoiceNumber);
  }

  let nextBillSeq = Math.max(5001, Number(db.billSeq) || 5001);
  let billNumber = `BILL-${year}-${nextBillSeq}`;
  while (usedBillNumbers.has(billNumber) || usedInvoiceNumbers.has(billNumber)) {
    nextBillSeq += 1;
    billNumber = `BILL-${year}-${nextBillSeq}`;
  }
  db.billSeq = nextBillSeq + 1;

  const invPrefix = kind === 'food' ? 'FNB' : 'INV';
  let nextInvSeq = Math.max(1000, Number(db.invoiceSeq) || 1000);
  let invoiceNumber = `${invPrefix}-${year}-${nextInvSeq}`;
  while (
    usedInvoiceNumbers.has(invoiceNumber) ||
    usedBillNumbers.has(invoiceNumber) ||
    invoiceNumber === billNumber
  ) {
    nextInvSeq += 1;
    invoiceNumber = `${invPrefix}-${year}-${nextInvSeq}`;
  }
  db.invoiceSeq = nextInvSeq + 1;

  return { billNumber, invoiceNumber };
}

let cachedDb: DatabaseState | null = null;

export function loadDatabase(): DatabaseState {
  if (cachedDb) return cachedDb;
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DB_FILE)) {
    const seeded = createSeedDatabase();
    saveDatabase(seeded);
    cachedDb = seeded;
    return seeded;
  }
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    const parsed = JSON.parse(raw) as DatabaseState;
    let dirty = false;
    if (parsed.gstSettings?.hotelTradeName === 'Meridian Stay Grand Hotel') {
      parsed.gstSettings.hotelTradeName = 'Hotel Shiv Residency';
      parsed.gstSettings.hotelLegalName = 'Hotel Shiv Residency Hospitality Pvt Ltd';
      parsed.gstSettings.hotelEmail = 'billing@hotelshivresidency.com';
      if (parsed.invoiceTheme?.monogram === 'MS') {
        parsed.invoiceTheme.monogram = 'HSR';
      }
      if (parsed.invoiceTheme?.footerNote?.includes('Meridian Stay Grand Hotel')) {
        parsed.invoiceTheme.footerNote =
          'Thank you for choosing Hotel Shiv Residency. We look forward to welcoming you again.';
      }
      parsed.emailLogs = (parsed.emailLogs || []).map((log) => ({
        ...log,
        subject: log.subject.replace('Meridian Stay Grand Hotel', 'Hotel Shiv Residency'),
      }));
      dirty = true;
    }
    if (!Array.isArray(parsed.mobileLogs)) {
      parsed.mobileLogs = [];
      dirty = true;
    }
    if (parsed.gstSettings.autoSmsReceipts === undefined) {
      parsed.gstSettings.autoSmsReceipts = true;
      parsed.gstSettings.mobileDispatchChannel = 'SMS';
      dirty = true;
    }
    if (!parsed.gstSettings.hotelPolicy) {
      parsed.gstSettings.hotelPolicy =
        '1) Check in time is 12:00 PM and check out time is 10:00 AM.\n2) Guest agrees to pay all charges incurred, abide by hotel policies, and be responsible for any damages or losses during their stay.';
      parsed.gstSettings.checkInPolicyTime = '12:00 PM';
      parsed.gstSettings.checkOutPolicyTime = '10:00 AM';
      dirty = true;
    }
    if (!parsed.templateDesignApplied) {
      parsed.invoiceTheme = {
        ...parsed.invoiceTheme,
        preset: 'shiv_residency_classic',
        accentColor: '#F58220',
        footerNote:
          'Thank you for staying with us.\nWe offer customized package for corporate clients.',
        termsAndConditions:
          '1) Check in time is 12:00 PM and check out time is 10:00 AM.\n2) Guest agrees to pay all charges incurred, abide by hotel policies, and be responsible for any damages or losses during their stay.',
        signatoryTitle: "Cashier's Sign",
      };
      parsed.gstSettings.checkInPolicyTime = '12:00 PM';
      parsed.gstSettings.checkOutPolicyTime = '10:00 AM';
      parsed.gstSettings.hotelPolicy =
        '1) Check in time is 12:00 PM and check out time is 10:00 AM.\n2) Guest agrees to pay all charges incurred, abide by hotel policies, and be responsible for any damages or losses during their stay.';
      // Ensure existing seed/past invoices default to the updated template look
      parsed.invoices = (parsed.invoices || []).map((inv) => ({
        ...inv,
        templatePreset: 'shiv_residency_classic',
      }));
      parsed.templateDesignApplied = true;
      dirty = true;
    }
    if (!parsed.roomCategoriesV2Applied) {
      const mapLegacyRoomType = (t: string): Room['type'] => {
        if (t === 'Family Room' || t === 'Presidential Suite') return 'Family Room';
        if (t === 'Super Deluxe Room' || t === 'Executive Suite') return 'Super Deluxe Room';
        if (t === 'Deluxe Room' || t === 'Standard' || t === 'Deluxe') return 'Deluxe Room';
        return 'Deluxe Room';
      };
      parsed.rooms = (parsed.rooms || []).map((rm) => ({
        ...rm,
        type: mapLegacyRoomType(String(rm.type || '')),
      }));
      parsed.invoices = (parsed.invoices || []).map((inv) => {
        if (inv.invoiceType === 'food' || inv.invoiceNumber.startsWith('FNB-')) {
          return inv;
        }
        return {
          ...inv,
          roomType: mapLegacyRoomType(String(inv.roomType || '')),
        };
      });
      parsed.roomCategoriesV2Applied = true;
      dirty = true;
    }
    if (!parsed.billNumberV1Applied) {
      const year = new Date().getFullYear();
      const sortedOldestFirst = [...(parsed.invoices || [])].sort(
        (a, b) => new Date(a.issuedAt).getTime() - new Date(b.issuedAt).getTime()
      );
      const seenInvoiceNums = new Set<string>();
      const seenBillNums = new Set<string>();

      let maxInvNum = Math.max(999, Number(parsed.invoiceSeq || 1000) - 1);
      let maxBillNum = Math.max(5000, Number(parsed.billSeq || 5001) - 1);
      for (const inv of sortedOldestFirst) {
        maxInvNum = Math.max(maxInvNum, extractTrailingNumber(inv.invoiceNumber));
        maxBillNum = Math.max(maxBillNum, extractTrailingNumber(inv.billNumber));
      }

      let nextInvCursor = 1000;
      let nextBillCursor = 5001;
      const billByInvoiceId = new Map<string, { billNumber: string; invoiceNumber: string }>();

      for (const inv of sortedOldestFirst) {
        let invoiceNum = (inv.invoiceNumber || '').trim();
        if (!invoiceNum || seenInvoiceNums.has(invoiceNum)) {
          const prefix = inv.invoiceType === 'food' ? 'FNB' : 'INV';
          while (
            seenInvoiceNums.has(`${prefix}-${year}-${Math.max(nextInvCursor, maxInvNum + 1)}`)
          ) {
            nextInvCursor += 1;
          }
          const seqVal = Math.max(nextInvCursor, maxInvNum + 1);
          maxInvNum = seqVal;
          nextInvCursor = seqVal + 1;
          invoiceNum = `${prefix}-${year}-${seqVal}`;
        }
        seenInvoiceNums.add(invoiceNum);

        let billNum = (inv.billNumber || '').trim();
        if (!billNum || billNum === invoiceNum || seenBillNums.has(billNum) || seenInvoiceNums.has(billNum)) {
          while (
            seenBillNums.has(`BILL-${year}-${nextBillCursor}`) ||
            seenInvoiceNums.has(`BILL-${year}-${nextBillCursor}`)
          ) {
            nextBillCursor += 1;
          }
          billNum = `BILL-${year}-${nextBillCursor}`;
          maxBillNum = Math.max(maxBillNum, nextBillCursor);
          nextBillCursor += 1;
        }
        seenBillNums.add(billNum);
        billByInvoiceId.set(inv.id, { billNumber: billNum, invoiceNumber: invoiceNum });
      }

      parsed.invoices = (parsed.invoices || []).map((inv) => {
        const assigned = billByInvoiceId.get(inv.id);
        return assigned
          ? {
              ...inv,
              billNumber: assigned.billNumber,
              invoiceNumber: assigned.invoiceNumber,
            }
          : inv;
      });
      parsed.emailLogs = (parsed.emailLogs || []).map((log) => {
        const assigned = billByInvoiceId.get(log.invoiceId);
        return assigned ? { ...log, billNumber: log.billNumber || assigned.billNumber } : log;
      });
      parsed.mobileLogs = (parsed.mobileLogs || []).map((log) => {
        const assigned = billByInvoiceId.get(log.invoiceId);
        return assigned ? { ...log, billNumber: log.billNumber || assigned.billNumber } : log;
      });

      parsed.invoiceSeq = Math.max(Number(parsed.invoiceSeq) || 1002, maxInvNum + 1);
      parsed.billSeq = Math.max(Number(parsed.billSeq) || 5001, maxBillNum + 1);
      parsed.billNumberV1Applied = true;
      dirty = true;
    }
    if (dirty) {
      saveDatabase(parsed);
    }
    cachedDb = parsed;
    return cachedDb;
  } catch {
    const seeded = createSeedDatabase();
    saveDatabase(seeded);
    cachedDb = seeded;
    return seeded;
  }
}

export function saveDatabase(state: DatabaseState): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  const tmpFile = `${DB_FILE}.tmp`;
  fs.writeFileSync(tmpFile, JSON.stringify(state, null, 2), 'utf-8');
  fs.renameSync(tmpFile, DB_FILE);
  cachedDb = state;
}
