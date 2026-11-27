import {
  Booking,
  EmailReceiptLog,
  ExtraChargeItem,
  FoodItem,
  GstSettings,
  Guest,
  HotelBootstrapData,
  Invoice,
  InvoiceTheme,
  InvoiceThemePreset,
  MobileInvoiceLog,
  PaymentMethod,
  Room,
  RoomStatus,
  StaffMember,
} from '../types/hotel';

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || `Request failed (${res.status})`);
  }
  return data as T;
}

export const api = {
  bootstrap: () => request<HotelBootstrapData>('/api/bootstrap'),

  // Guests
  createGuest: (payload: Omit<Guest, 'id' | 'createdAt'>) =>
    request<Guest>('/api/guests', { method: 'POST', body: JSON.stringify(payload) }),
  updateGuest: (id: string, payload: Partial<Guest>) =>
    request<Guest>(`/api/guests/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deleteGuest: (id: string) =>
    request<{ deleted: boolean }>(`/api/guests/${id}`, { method: 'DELETE' }),

  // Rooms
  createRoom: (payload: Omit<Room, 'id'>) =>
    request<Room>('/api/rooms', { method: 'POST', body: JSON.stringify(payload) }),
  updateRoom: (id: string, payload: Partial<Room>) =>
    request<Room>(`/api/rooms/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deleteRoom: (id: string) =>
    request<{ deleted: boolean }>(`/api/rooms/${id}`, { method: 'DELETE' }),

  // Food Menu
  createFoodItem: (payload: Omit<FoodItem, 'id'>) =>
    request<FoodItem>('/api/food', { method: 'POST', body: JSON.stringify(payload) }),
  updateFoodItem: (id: string, payload: Partial<FoodItem>) =>
    request<FoodItem>(`/api/food/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deleteFoodItem: (id: string) =>
    request<{ deleted: boolean }>(`/api/food/${id}`, { method: 'DELETE' }),

  // Staff
  createStaff: (payload: Omit<StaffMember, 'id'>) =>
    request<StaffMember>('/api/staff', { method: 'POST', body: JSON.stringify(payload) }),
  updateStaff: (id: string, payload: Partial<StaffMember>) =>
    request<StaffMember>(`/api/staff/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deleteStaff: (id: string) =>
    request<{ deleted: boolean }>(`/api/staff/${id}`, { method: 'DELETE' }),

  // Bookings
  createBooking: (payload: {
    guestId: string;
    roomId: string;
    status: 'CheckedIn' | 'Held';
    checkInDate: string;
    checkInTime?: string;
    checkOutDate: string;
    checkOutTime?: string;
    nights?: number;
    adults?: number;
    children?: number;
    roomRatePerNight?: number;
    advancePaid?: number;
    discount?: number;
    specialRequests?: string;
    holdExpiresAt?: string;
  }) =>
    request<{ booking: Booking; room: Room }>('/api/bookings', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateBooking: (id: string, payload: Partial<Booking>) =>
    request<{ booking: Booking; room: Room | null }>(`/api/bookings/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  addFoodOrder: (bookingId: string, payload: { foodItemId: string; quantity: number; notes?: string }) =>
    request<Booking>(`/api/bookings/${bookingId}/food`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  removeFoodOrder: (bookingId: string, orderId: string) =>
    request<Booking>(`/api/bookings/${bookingId}/food/${orderId}`, {
      method: 'DELETE',
    }),

  checkoutBooking: (
    bookingId: string,
    payload: {
      paymentMethod: PaymentMethod;
      paymentReference?: string;
      discount?: number;
      advancePaid?: number;
      nights?: number;
      checkInDate?: string;
      checkInTime?: string;
      checkOutDate?: string;
      checkOutTime?: string;
      nextRoomStatus?: RoomStatus;
      sendEmailReceipt?: boolean;
      sendMobileInvoice?: boolean;
      templatePreset?: InvoiceThemePreset;
    }
  ) =>
    request<{
      booking: Booking;
      room: Room | null;
      invoice: Invoice;
      emailLog: EmailReceiptLog | null;
      mobileLog: MobileInvoiceLog | null;
    }>(`/api/bookings/${bookingId}/checkout`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  deleteBooking: (id: string) =>
    request<{ deleted: boolean; room: Room | null }>(`/api/bookings/${id}`, {
      method: 'DELETE',
    }),

  // Settings, Email Receipts & Mobile Invoice Dispatch
  updateGstSettings: (payload: Partial<GstSettings>) =>
    request<GstSettings>('/api/settings/gst', {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),

  updateInvoiceTheme: (payload: Partial<InvoiceTheme>) =>
    request<InvoiceTheme>('/api/settings/invoice-theme', {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),

  sendInvoiceEmail: (invoiceId: string, recipientEmail?: string) =>
    request<{ invoice: Invoice; emailLog: EmailReceiptLog }>(
      `/api/invoices/${invoiceId}/send-email`,
      {
        method: 'POST',
        body: JSON.stringify({ recipientEmail }),
      }
    ),

  sendInvoiceMobile: (
    invoiceId: string,
    recipientMobile?: string,
    channel?: 'SMS' | 'WhatsApp'
  ) =>
    request<{ invoice: Invoice; mobileLog: MobileInvoiceLog }>(
      `/api/invoices/${invoiceId}/send-mobile`,
      {
        method: 'POST',
        body: JSON.stringify({ recipientMobile, channel }),
      }
    ),

  // Standalone Food Billing
  createFoodBill: (payload: {
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
    sendEmailReceipt?: boolean;
    sendMobileInvoice?: boolean;
    templatePreset?: InvoiceThemePreset;
  }) =>
    request<{
      invoice: Invoice;
      emailLog: EmailReceiptLog | null;
      mobileLog: MobileInvoiceLog | null;
    }>('/api/food-bills', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
};
