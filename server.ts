import 'dotenv/config';
import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import {
  Booking,
  ExtraChargeItem,
  FoodItem,
  FoodOrderItem,
  GstSettings,
  Guest,
  Invoice,
  InvoiceTheme,
  InvoiceThemePreset,
  PaymentMethod,
  Room,
  RoomStatus,
  StaffMember,
} from './src/types/hotel';
import {
  computeBookingFolio,
  computeFoodBillFolio,
  computeNightsBetween,
  extractTime24h,
} from './src/utils/billing';
import {
  buildThemedEmailHtml,
  dispatchInvoiceEmailReceipt,
  isSmtpConfigured,
} from './server/email';
import {
  dispatchMobileInvoice,
  isSmsGatewayConfigured,
} from './server/mobileDispatch';
import {
  allocateBillAndInvoiceNumbers,
  loadDatabase,
  saveDatabase,
} from './server/store';

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: '2mb' }));

  // --- Bootstrap ---
  app.get('/api/bootstrap', (_req, res) => {
    const db = loadDatabase();
    res.json({
      rooms: db.rooms,
      guests: db.guests,
      bookings: db.bookings,
      foodMenu: db.foodMenu,
      staff: db.staff,
      invoices: db.invoices,
      emailLogs: db.emailLogs,
      mobileLogs: db.mobileLogs,
      gstSettings: db.gstSettings,
      invoiceTheme: db.invoiceTheme,
      smtpConfigured: isSmtpConfigured(),
      smsConfigured: isSmsGatewayConfigured(),
    });
  });

  // --- Guests CRUD ---
  app.post('/api/guests', (req, res) => {
    const db = loadDatabase();
    const body = req.body as Partial<Guest>;
    if (!body.name?.trim() || !body.mobile?.trim()) {
      res.status(400).json({ error: 'Guest name and mobile number are required.' });
      return;
    }
    const guest: Guest = {
      id: `gst-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      name: body.name.trim(),
      mobile: body.mobile.trim(),
      email: (body.email || '').trim(),
      companyName: (body.companyName || '').trim(),
      companyGst: (body.companyGst || '').trim().toUpperCase(),
      idProofType: body.idProofType || 'Aadhaar',
      idProofNumber: (body.idProofNumber || '').trim(),
      address: (body.address || '').trim(),
      notes: (body.notes || '').trim(),
      createdAt: new Date().toISOString(),
    };
    db.guests.unshift(guest);
    saveDatabase(db);
    res.status(201).json(guest);
  });

  app.put('/api/guests/:id', (req, res) => {
    const db = loadDatabase();
    const idx = db.guests.findIndex((g) => g.id === req.params.id);
    if (idx === -1) {
      res.status(404).json({ error: 'Guest not found.' });
      return;
    }
    const body = req.body as Partial<Guest>;
    if (!body.name?.trim() || !body.mobile?.trim()) {
      res.status(400).json({ error: 'Guest name and mobile number are required.' });
      return;
    }
    const updated: Guest = {
      ...db.guests[idx],
      name: body.name.trim(),
      mobile: body.mobile.trim(),
      email: (body.email ?? db.guests[idx].email).trim(),
      companyName: (body.companyName ?? db.guests[idx].companyName).trim(),
      companyGst: (body.companyGst ?? db.guests[idx].companyGst).trim().toUpperCase(),
      idProofType: body.idProofType ?? db.guests[idx].idProofType,
      idProofNumber: (body.idProofNumber ?? db.guests[idx].idProofNumber).trim(),
      address: (body.address ?? db.guests[idx].address).trim(),
      notes: (body.notes ?? db.guests[idx].notes).trim(),
    };
    db.guests[idx] = updated;
    saveDatabase(db);
    res.json(updated);
  });

  app.delete('/api/guests/:id', (req, res) => {
    const db = loadDatabase();
    const hasActiveStay = db.bookings.some(
      (b) => b.guestId === req.params.id && (b.status === 'CheckedIn' || b.status === 'Held')
    );
    if (hasActiveStay) {
      res.status(409).json({
        error: 'Cannot delete a guest with an active check-in or held reservation.',
      });
      return;
    }
    db.guests = db.guests.filter((g) => g.id !== req.params.id);
    saveDatabase(db);
    res.json({ deleted: true });
  });

  // --- Rooms CRUD ---
  app.post('/api/rooms', (req, res) => {
    const db = loadDatabase();
    const body = req.body as Partial<Room>;
    if (!body.number?.trim()) {
      res.status(400).json({ error: 'Room number is required.' });
      return;
    }
    if (db.rooms.some((r) => r.number.toLowerCase() === body.number!.trim().toLowerCase())) {
      res.status(409).json({ error: `Room ${body.number.trim()} already exists.` });
      return;
    }
    const room: Room = {
      id: `rm-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      number: body.number.trim(),
      floor: Number(body.floor) || 1,
      type: body.type || 'Deluxe Room',
      rate: Math.max(0, Number(body.rate) || 3000),
      maxOccupancy: Math.max(1, Number(body.maxOccupancy) || 2),
      amenities: Array.isArray(body.amenities) ? body.amenities : ['Wi-Fi', 'Smart TV'],
      status: body.status || 'Available',
      gstRateOverride:
        body.gstRateOverride !== undefined && body.gstRateOverride !== null
          ? Number(body.gstRateOverride)
          : null,
    };
    db.rooms.push(room);
    db.rooms.sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true }));
    saveDatabase(db);
    res.status(201).json(room);
  });

  app.put('/api/rooms/:id', (req, res) => {
    const db = loadDatabase();
    const idx = db.rooms.findIndex((r) => r.id === req.params.id);
    if (idx === -1) {
      res.status(404).json({ error: 'Room not found.' });
      return;
    }
    const body = req.body as Partial<Room>;
    const updated: Room = {
      ...db.rooms[idx],
      number: body.number?.trim() || db.rooms[idx].number,
      floor: body.floor !== undefined ? Number(body.floor) : db.rooms[idx].floor,
      type: body.type ?? db.rooms[idx].type,
      rate: body.rate !== undefined ? Math.max(0, Number(body.rate)) : db.rooms[idx].rate,
      maxOccupancy:
        body.maxOccupancy !== undefined
          ? Math.max(1, Number(body.maxOccupancy))
          : db.rooms[idx].maxOccupancy,
      amenities: Array.isArray(body.amenities) ? body.amenities : db.rooms[idx].amenities,
      status: body.status ?? db.rooms[idx].status,
      gstRateOverride:
        body.gstRateOverride !== undefined ? body.gstRateOverride : db.rooms[idx].gstRateOverride,
    };
    db.rooms[idx] = updated;
    db.rooms.sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true }));
    saveDatabase(db);
    res.json(updated);
  });

  app.delete('/api/rooms/:id', (req, res) => {
    const db = loadDatabase();
    const activeBooking = db.bookings.some(
      (b) => b.roomId === req.params.id && (b.status === 'CheckedIn' || b.status === 'Held')
    );
    if (activeBooking) {
      res.status(409).json({
        error: 'Cannot delete a room that is currently occupied or held.',
      });
      return;
    }
    db.rooms = db.rooms.filter((r) => r.id !== req.params.id);
    saveDatabase(db);
    res.json({ deleted: true });
  });

  // --- Food Menu CRUD ---
  app.post('/api/food', (req, res) => {
    const db = loadDatabase();
    const body = req.body as Partial<FoodItem>;
    if (!body.name?.trim()) {
      res.status(400).json({ error: 'Food item name is required.' });
      return;
    }
    const item: FoodItem = {
      id: `fd-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      name: body.name.trim(),
      category: body.category || 'Main Course',
      rate: Math.max(0, Number(body.rate) || 0),
      gstRate: Math.max(0, Number(body.gstRate ?? 5)),
      isVeg: body.isVeg ?? true,
      available: body.available ?? true,
      description: (body.description || '').trim(),
    };
    db.foodMenu.push(item);
    saveDatabase(db);
    res.status(201).json(item);
  });

  app.put('/api/food/:id', (req, res) => {
    const db = loadDatabase();
    const idx = db.foodMenu.findIndex((f) => f.id === req.params.id);
    if (idx === -1) {
      res.status(404).json({ error: 'Food item not found.' });
      return;
    }
    const body = req.body as Partial<FoodItem>;
    const updated: FoodItem = {
      ...db.foodMenu[idx],
      name: body.name?.trim() || db.foodMenu[idx].name,
      category: body.category ?? db.foodMenu[idx].category,
      rate: body.rate !== undefined ? Math.max(0, Number(body.rate)) : db.foodMenu[idx].rate,
      gstRate: body.gstRate !== undefined ? Math.max(0, Number(body.gstRate)) : db.foodMenu[idx].gstRate,
      isVeg: body.isVeg !== undefined ? body.isVeg : db.foodMenu[idx].isVeg,
      available: body.available !== undefined ? body.available : db.foodMenu[idx].available,
      description: body.description !== undefined ? body.description.trim() : db.foodMenu[idx].description,
    };
    db.foodMenu[idx] = updated;
    saveDatabase(db);
    res.json(updated);
  });

  app.delete('/api/food/:id', (req, res) => {
    const db = loadDatabase();
    db.foodMenu = db.foodMenu.filter((f) => f.id !== req.params.id);
    saveDatabase(db);
    res.json({ deleted: true });
  });

  // --- Staff CRUD ---
  app.post('/api/staff', (req, res) => {
    const db = loadDatabase();
    const body = req.body as Partial<StaffMember>;
    if (!body.name?.trim() || !body.role) {
      res.status(400).json({ error: 'Staff name and role are required.' });
      return;
    }
    const member: StaffMember = {
      id: `stf-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      name: body.name.trim(),
      role: body.role,
      mobile: (body.mobile || '').trim(),
      email: (body.email || '').trim(),
      status: body.status || 'On Shift',
      defaultShift: body.defaultShift || 'Morning (06:00–14:00)',
      schedule: body.schedule || {
        Mon: 'Morning',
        Tue: 'Morning',
        Wed: 'Morning',
        Thu: 'Morning',
        Fri: 'Morning',
        Sat: 'Morning',
        Sun: 'Off',
      },
      notes: (body.notes || '').trim(),
      joinedAt: body.joinedAt || new Date().toISOString().slice(0, 10),
    };
    db.staff.push(member);
    saveDatabase(db);
    res.status(201).json(member);
  });

  app.put('/api/staff/:id', (req, res) => {
    const db = loadDatabase();
    const idx = db.staff.findIndex((s) => s.id === req.params.id);
    if (idx === -1) {
      res.status(404).json({ error: 'Staff member not found.' });
      return;
    }
    const body = req.body as Partial<StaffMember>;
    const updated: StaffMember = {
      ...db.staff[idx],
      ...body,
      name: body.name?.trim() || db.staff[idx].name,
      mobile: body.mobile !== undefined ? body.mobile.trim() : db.staff[idx].mobile,
      email: body.email !== undefined ? body.email.trim() : db.staff[idx].email,
      notes: body.notes !== undefined ? body.notes.trim() : db.staff[idx].notes,
    };
    db.staff[idx] = updated;
    saveDatabase(db);
    res.json(updated);
  });

  app.delete('/api/staff/:id', (req, res) => {
    const db = loadDatabase();
    db.staff = db.staff.filter((s) => s.id !== req.params.id);
    saveDatabase(db);
    res.json({ deleted: true });
  });

  // --- Bookings: Check-In / Hold / Edit / Food Order / Checkout / Delete ---
  app.post('/api/bookings', (req, res) => {
    const db = loadDatabase();
    const body = req.body as {
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
    };

    const roomIdx = db.rooms.findIndex((r) => r.id === body.roomId);
    const guest = db.guests.find((g) => g.id === body.guestId);
    if (roomIdx === -1 || !guest) {
      res.status(400).json({ error: 'Valid room and guest selection required.' });
      return;
    }

    const room = db.rooms[roomIdx];
    if (room.status === 'Maintenance') {
      res.status(409).json({
        error: `Room ${room.number} is under maintenance and cannot accept check-ins.`,
      });
      return;
    }

    const existingCheckedIn = db.bookings.find(
      (b) => b.roomId === room.id && b.status === 'CheckedIn'
    );
    const hasPendingCheckout = Boolean(existingCheckedIn) || room.status === 'Occupied';

    const nights =
      body.nights && body.nights > 0
        ? body.nights
        : computeNightsBetween(body.checkInDate, body.checkOutDate);

    // If room currently has a pending check-out, automatically place new check-in on Hold
    const status: 'CheckedIn' | 'Held' =
      body.status === 'Held' || hasPendingCheckout ? 'Held' : 'CheckedIn';
    const seq = db.bookingSeq++;
    const nowIso = new Date().toISOString();

    const checkInIso = body.checkInDate || nowIso;
    const checkOutIso = body.checkOutDate || nowIso;

    const booking: Booking = {
      id: `bk-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      bookingCode: `BK-2026-${seq}`,
      guestId: guest.id,
      roomId: room.id,
      status,
      checkInDate: checkInIso,
      checkInTime: body.checkInTime || extractTime24h(checkInIso),
      checkOutDate: checkOutIso,
      checkOutTime: body.checkOutTime || extractTime24h(checkOutIso),
      nights,
      adults: Math.max(1, Number(body.adults) || 1),
      children: Math.max(0, Number(body.children) || 0),
      roomRatePerNight:
        body.roomRatePerNight !== undefined
          ? Math.max(0, Number(body.roomRatePerNight))
          : room.rate,
      advancePaid: Math.max(0, Number(body.advancePaid) || 0),
      discount: Math.max(0, Number(body.discount) || 0),
      foodOrders: [],
      extraCharges: [],
      specialRequests: (body.specialRequests || '').trim(),
      holdExpiresAt: status === 'Held' ? body.holdExpiresAt : undefined,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    db.bookings.unshift(booking);
    if (!hasPendingCheckout) {
      db.rooms[roomIdx] = {
        ...room,
        status: status === 'Held' ? 'Held' : 'Occupied',
      };
    }

    saveDatabase(db);
    res.status(201).json({ booking, room: db.rooms[roomIdx] });
  });

  app.patch('/api/bookings/:id', (req, res) => {
    const db = loadDatabase();
    const idx = db.bookings.findIndex((b) => b.id === req.params.id);
    if (idx === -1) {
      res.status(404).json({ error: 'Booking not found.' });
      return;
    }
    const existing = db.bookings[idx];
    const body = req.body as Partial<Booking>;

    const nextStatus = body.status ?? existing.status;
    const roomIdx = db.rooms.findIndex((r) => r.id === existing.roomId);

    if (nextStatus === 'CheckedIn' && existing.status !== 'CheckedIn') {
      const blockingCheckedIn = db.bookings.find(
        (b) =>
          b.id !== existing.id &&
          b.roomId === existing.roomId &&
          b.status === 'CheckedIn'
      );
      if (blockingCheckedIn) {
        const currentGuest = db.guests.find((g) => g.id === blockingCheckedIn.guestId);
        const roomLabel = roomIdx !== -1 ? db.rooms[roomIdx].number : '';
        res.status(409).json({
          error: `Room ${roomLabel} still has a pending check-out for ${currentGuest?.name || 'current guest'}. Check out that stay first.`,
        });
        return;
      }
    }

    const updated: Booking = {
      ...existing,
      ...body,
      nights:
        body.nights !== undefined
          ? Math.max(1, Number(body.nights))
          : body.checkInDate || body.checkOutDate
            ? computeNightsBetween(
                body.checkInDate ?? existing.checkInDate,
                body.checkOutDate ?? existing.checkOutDate
              )
            : existing.nights,
      advancePaid:
        body.advancePaid !== undefined
          ? Math.max(0, Number(body.advancePaid))
          : existing.advancePaid,
      discount:
        body.discount !== undefined
          ? Math.max(0, Number(body.discount))
          : existing.discount,
      roomRatePerNight:
        body.roomRatePerNight !== undefined
          ? Math.max(0, Number(body.roomRatePerNight))
          : existing.roomRatePerNight,
      updatedAt: new Date().toISOString(),
    };

    db.bookings[idx] = updated;
    if (roomIdx !== -1) {
      if (nextStatus === 'CheckedIn') {
        db.rooms[roomIdx].status = 'Occupied';
      } else if (nextStatus === 'Held') {
        const hasOtherCheckedIn = db.bookings.some(
          (b) => b.id !== updated.id && b.roomId === existing.roomId && b.status === 'CheckedIn'
        );
        db.rooms[roomIdx].status = hasOtherCheckedIn ? 'Occupied' : 'Held';
      }
    }

    saveDatabase(db);
    res.json({ booking: updated, room: roomIdx !== -1 ? db.rooms[roomIdx] : null });
  });

  app.post('/api/bookings/:id/food', (req, res) => {
    const db = loadDatabase();
    const idx = db.bookings.findIndex((b) => b.id === req.params.id);
    if (idx === -1) {
      res.status(404).json({ error: 'Booking not found.' });
      return;
    }
    const { foodItemId, quantity, notes } = req.body as {
      foodItemId: string;
      quantity: number;
      notes?: string;
    };
    const item = db.foodMenu.find((f) => f.id === foodItemId);
    if (!item) {
      res.status(404).json({ error: 'Food item not found in menu.' });
      return;
    }
    const order = {
      id: `fo-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      foodItemId: item.id,
      name: item.name,
      rate: item.rate,
      gstRate: item.gstRate,
      quantity: Math.max(1, Number(quantity) || 1),
      orderedAt: new Date().toISOString(),
      notes: notes?.trim() || undefined,
    };
    db.bookings[idx].foodOrders.push(order);
    db.bookings[idx].updatedAt = new Date().toISOString();
    saveDatabase(db);
    res.status(201).json(db.bookings[idx]);
  });

  app.delete('/api/bookings/:id/food/:orderId', (req, res) => {
    const db = loadDatabase();
    const idx = db.bookings.findIndex((b) => b.id === req.params.id);
    if (idx === -1) {
      res.status(404).json({ error: 'Booking not found.' });
      return;
    }
    db.bookings[idx].foodOrders = db.bookings[idx].foodOrders.filter(
      (o) => o.id !== req.params.orderId
    );
    db.bookings[idx].updatedAt = new Date().toISOString();
    saveDatabase(db);
    res.json(db.bookings[idx]);
  });

  app.post('/api/bookings/:id/checkout', async (req, res) => {
    const db = loadDatabase();
    const idx = db.bookings.findIndex((b) => b.id === req.params.id);
    if (idx === -1) {
      res.status(404).json({ error: 'Booking not found.' });
      return;
    }
    const booking = db.bookings[idx];
    if (booking.status === 'CheckedOut') {
      res.status(409).json({ error: 'Booking is already checked out.' });
      return;
    }

    const body = req.body as {
      paymentMethod?: PaymentMethod;
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
    };

    if (body.discount !== undefined) {
      booking.discount = Math.max(0, Number(body.discount));
    }
    if (body.advancePaid !== undefined) {
      booking.advancePaid = Math.max(0, Number(body.advancePaid));
    }
    if (body.nights !== undefined) {
      booking.nights = Math.max(1, Number(body.nights));
    }

    const roomIdx = db.rooms.findIndex((r) => r.id === booking.roomId);
    const room = roomIdx !== -1 ? db.rooms[roomIdx] : undefined;
    const guest = db.guests.find((g) => g.id === booking.guestId);

    const folio = computeBookingFolio(booking, room, db.gstSettings);
    const nowIso = new Date().toISOString();
    const effectiveCheckInIso =
      body.checkInDate && !Number.isNaN(new Date(body.checkInDate).getTime())
        ? new Date(body.checkInDate).toISOString()
        : booking.checkInDate;
    const effectiveCheckInTime =
      body.checkInTime || booking.checkInTime || extractTime24h(effectiveCheckInIso);
    const effectiveCheckOutIso =
      body.checkOutDate && !Number.isNaN(new Date(body.checkOutDate).getTime())
        ? new Date(body.checkOutDate).toISOString()
        : nowIso;
    const effectiveCheckOutTime =
      body.checkOutTime || extractTime24h(effectiveCheckOutIso);
    const { billNumber, invoiceNumber } = allocateBillAndInvoiceNumbers(db, 'room');
    const invoiceId = `inv-${Date.now()}`;

    const effectiveTheme: InvoiceTheme = {
      ...db.invoiceTheme,
      preset: body.templatePreset || db.invoiceTheme.preset,
    };

    const invoice: Invoice = {
      id: invoiceId,
      billNumber,
      invoiceNumber,
      bookingId: booking.id,
      guestId: guest?.id || booking.guestId,
      guestName: guest?.name || 'Walk-in Guest',
      guestMobile: guest?.mobile || '—',
      guestEmail: guest?.email || '',
      guestAddress: guest?.address || '',
      guestCount: Math.max(1, (booking.adults || 1) + (booking.children || 0)),
      companyName: guest?.companyName || '',
      companyGst: guest?.companyGst || '',
      roomNumber: room?.number || '—',
      roomType: room?.type || 'Deluxe Room',
      checkInDate: effectiveCheckInIso,
      checkInTime: effectiveCheckInTime,
      checkOutDate: effectiveCheckOutIso,
      checkOutTime: effectiveCheckOutTime,
      nights: folio.nights,
      roomSubtotal: folio.roomSubtotal,
      roomGstRate: folio.roomGstRate,
      roomGstAmount: folio.roomGstAmount,
      foodSubtotal: folio.foodSubtotal,
      foodGstAmount: folio.foodGstAmount,
      extraChargesSubtotal: folio.extraChargesSubtotal,
      serviceChargeAmount: folio.serviceChargeAmount,
      discountAmount: folio.discountAmount,
      taxableTotal: folio.taxableTotal,
      taxRegime: db.gstSettings.taxRegime,
      cgstAmount: folio.cgstAmount,
      sgstAmount: folio.sgstAmount,
      igstAmount: folio.igstAmount,
      totalGst: folio.totalGst,
      grandTotal: folio.grandTotal,
      advancePaid: folio.advancePaid,
      netPaid: Math.max(0, folio.balanceDue),
      paymentMethod: body.paymentMethod || 'UPI',
      paymentReference: (body.paymentReference || '').trim(),
      issuedAt: nowIso,
      templatePreset: effectiveTheme.preset,
      emailStatus: 'Skipped',
      mobileStatus: 'Skipped',
      lineItems: folio.lineItems,
    };

    const shouldEmail =
      body.sendEmailReceipt !== undefined
        ? body.sendEmailReceipt
        : db.gstSettings.autoEmailReceipts;

    let emailLog = null;
    if (shouldEmail) {
      emailLog = await dispatchInvoiceEmailReceipt(
        invoice,
        db.gstSettings,
        effectiveTheme
      );
      invoice.emailStatus =
        emailLog.status === 'Delivered (SMTP)'
          ? 'Sent'
          : emailLog.status === 'Archived Receipt (Local Dispatch)'
            ? 'Archived'
            : 'Failed';
      invoice.emailSentAt = emailLog.sentAt;
      db.emailLogs.unshift(emailLog);
    }

    const shouldMobile =
      body.sendMobileInvoice !== undefined
        ? body.sendMobileInvoice
        : db.gstSettings.autoSmsReceipts;

    const baseUrl =
      process.env.APP_URL || `${req.protocol}://${req.get('host')}`;

    let mobileLog = null;
    if (shouldMobile) {
      const channel =
        db.gstSettings.mobileDispatchChannel === 'WhatsApp'
          ? 'WhatsApp'
          : 'SMS';
      mobileLog = await dispatchMobileInvoice(
        invoice,
        db.gstSettings,
        channel,
        baseUrl
      );
      invoice.mobileStatus =
        mobileLog.status === 'Delivered (Gateway)'
          ? 'Sent'
          : mobileLog.status === 'Archived Dispatch (Ready)'
            ? 'Archived'
            : 'Failed';
      invoice.mobileSentAt = mobileLog.sentAt;
      db.mobileLogs.unshift(mobileLog);

      if (db.gstSettings.mobileDispatchChannel === 'Both') {
        const waLog = await dispatchMobileInvoice(
          invoice,
          db.gstSettings,
          'WhatsApp',
          baseUrl
        );
        db.mobileLogs.unshift(waLog);
      }
    }

    booking.status = 'CheckedOut';
    booking.checkInDate = effectiveCheckInIso;
    booking.checkInTime = effectiveCheckInTime;
    booking.actualCheckOutAt = effectiveCheckOutIso;
    booking.checkOutDate = effectiveCheckOutIso;
    booking.checkOutTime = effectiveCheckOutTime;
    booking.invoiceId = invoice.id;
    booking.updatedAt = nowIso;

    if (roomIdx !== -1) {
      const hasWaitingHold = db.bookings.some(
        (b) => b.id !== booking.id && b.roomId === booking.roomId && b.status === 'Held'
      );
      if (hasWaitingHold && body.nextRoomStatus !== 'Maintenance') {
        db.rooms[roomIdx].status = 'Held';
      } else {
        db.rooms[roomIdx].status = body.nextRoomStatus || 'Housekeeping';
      }
    }

    db.invoices.unshift(invoice);
    saveDatabase(db);

    res.json({
      booking,
      room: roomIdx !== -1 ? db.rooms[roomIdx] : null,
      invoice,
      emailLog,
      mobileLog,
    });
  });

  app.delete('/api/bookings/:id', (req, res) => {
    const db = loadDatabase();
    const idx = db.bookings.findIndex((b) => b.id === req.params.id);
    if (idx === -1) {
      res.status(404).json({ error: 'Check-in / booking not found.' });
      return;
    }
    const target = db.bookings[idx];
    const roomIdx = db.rooms.findIndex((r) => r.id === target.roomId);

    db.bookings.splice(idx, 1);

    // Recompute room status accurately from remaining active stays/holds
    if (
      roomIdx !== -1 &&
      (target.status === 'CheckedIn' || target.status === 'Held')
    ) {
      const hasCheckedIn = db.bookings.some(
        (b) => b.roomId === target.roomId && b.status === 'CheckedIn'
      );
      const hasHeld = db.bookings.some(
        (b) => b.roomId === target.roomId && b.status === 'Held'
      );
      db.rooms[roomIdx].status = hasCheckedIn
        ? 'Occupied'
        : hasHeld
          ? 'Held'
          : 'Available';
    }

    saveDatabase(db);
    res.json({
      deleted: true,
      room: roomIdx !== -1 ? db.rooms[roomIdx] : null,
    });
  });

  // --- GST Settings & Invoice Theme ---
  app.put('/api/settings/gst', (req, res) => {
    const db = loadDatabase();
    db.gstSettings = {
      ...db.gstSettings,
      ...(req.body as Partial<GstSettings>),
    };
    saveDatabase(db);
    res.json(db.gstSettings);
  });

  app.put('/api/settings/invoice-theme', (req, res) => {
    const db = loadDatabase();
    db.invoiceTheme = {
      ...db.invoiceTheme,
      ...(req.body as Partial<InvoiceTheme>),
    };
    saveDatabase(db);
    res.json(db.invoiceTheme);
  });

  // --- Manual / Resend Automated Email Receipt ---
  app.post('/api/invoices/:id/send-email', async (req, res) => {
    const db = loadDatabase();
    const invoiceIdx = db.invoices.findIndex((inv) => inv.id === req.params.id);
    if (invoiceIdx === -1) {
      res.status(404).json({ error: 'Invoice not found.' });
      return;
    }
    const invoice = db.invoices[invoiceIdx];
    const { recipientEmail } = req.body as { recipientEmail?: string };
    const log = await dispatchInvoiceEmailReceipt(
      invoice,
      db.gstSettings,
      db.invoiceTheme,
      recipientEmail
    );
    db.invoices[invoiceIdx].emailStatus =
      log.status === 'Delivered (SMTP)'
        ? 'Sent'
        : log.status === 'Archived Receipt (Local Dispatch)'
          ? 'Archived'
          : 'Failed';
    db.invoices[invoiceIdx].emailSentAt = log.sentAt;
    db.emailLogs.unshift(log);
    saveDatabase(db);
    res.json({ invoice: db.invoices[invoiceIdx], emailLog: log });
  });

  // --- Manual / Resend Automated Mobile Invoice (SMS / WhatsApp) ---
  app.post('/api/invoices/:id/send-mobile', async (req, res) => {
    const db = loadDatabase();
    const invoiceIdx = db.invoices.findIndex((inv) => inv.id === req.params.id);
    if (invoiceIdx === -1) {
      res.status(404).json({ error: 'Invoice not found.' });
      return;
    }
    const invoice = db.invoices[invoiceIdx];
    const { recipientMobile, channel } = req.body as {
      recipientMobile?: string;
      channel?: 'SMS' | 'WhatsApp';
    };
    const baseUrl =
      process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
    const chosenChannel =
      channel ||
      (db.gstSettings.mobileDispatchChannel === 'WhatsApp' ? 'WhatsApp' : 'SMS');

    const log = await dispatchMobileInvoice(
      invoice,
      db.gstSettings,
      chosenChannel,
      baseUrl,
      recipientMobile
    );

    db.invoices[invoiceIdx].mobileStatus =
      log.status === 'Delivered (Gateway)'
        ? 'Sent'
        : log.status === 'Archived Dispatch (Ready)'
          ? 'Archived'
          : 'Failed';
    db.invoices[invoiceIdx].mobileSentAt = log.sentAt;
    db.mobileLogs.unshift(log);
    saveDatabase(db);
    res.json({ invoice: db.invoices[invoiceIdx], mobileLog: log });
  });

  // --- Standalone Food Billing ---
  app.post('/api/food-bills', async (req, res) => {
    const db = loadDatabase();
    const body = req.body as {
      guestId?: string;
      guestName?: string;
      guestMobile?: string;
      guestEmail?: string;
      companyName?: string;
      companyGst?: string;
      serviceType?: 'Dine-In' | 'Takeaway' | 'Room Direct' | 'Delivery';
      tableOrRef?: string;
      orderDate?: string;
      orderTime?: string;
      items?: { foodItemId: string; quantity: number }[];
      extraCharges?: ExtraChargeItem[];
      discount?: number;
      advancePaid?: number;
      paymentMethod?: PaymentMethod;
      paymentReference?: string;
      sendEmailReceipt?: boolean;
      sendMobileInvoice?: boolean;
      templatePreset?: InvoiceThemePreset;
    };

    const rawItems = Array.isArray(body.items) ? body.items : [];
    const foodOrders: FoodOrderItem[] = [];
    const nowIso = new Date().toISOString();

    for (const entry of rawItems) {
      const menu = db.foodMenu.find((f) => f.id === entry.foodItemId);
      if (!menu) continue;
      const qty = Math.max(1, Number(entry.quantity) || 1);
      foodOrders.push({
        id: `fo-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        foodItemId: menu.id,
        name: menu.name,
        rate: menu.rate,
        gstRate: menu.gstRate,
        quantity: qty,
        orderedAt: nowIso,
      });
    }

    const extraCharges = Array.isArray(body.extraCharges) ? body.extraCharges : [];
    if (foodOrders.length === 0 && extraCharges.length === 0) {
      res.status(400).json({ error: 'Please add at least one food item to generate a bill.' });
      return;
    }

    const guest = body.guestId
      ? db.guests.find((g) => g.id === body.guestId)
      : undefined;

    const guestName = (body.guestName || guest?.name || '').trim() || 'Walk-in Guest';
    const guestMobile = (body.guestMobile || guest?.mobile || '').trim() || '—';
    const guestEmail = (body.guestEmail ?? guest?.email ?? '').trim();
    const companyName = (body.companyName ?? guest?.companyName ?? '').trim();
    const companyGst = (body.companyGst ?? guest?.companyGst ?? '').trim().toUpperCase();

    const folio = computeFoodBillFolio({
      foodOrders,
      extraCharges,
      discount: Math.max(0, Number(body.discount) || 0),
      advancePaid: Math.max(0, Number(body.advancePaid) || 0),
      gstSettings: db.gstSettings,
    });

    const serviceType = body.serviceType || 'Dine-In';
    const tableLabel = (body.tableOrRef || '').trim() || serviceType;
    const orderIso =
      body.orderDate && !Number.isNaN(new Date(body.orderDate).getTime())
        ? new Date(body.orderDate).toISOString()
        : nowIso;
    const orderTime = body.orderTime || extractTime24h(orderIso);

    const { billNumber, invoiceNumber } = allocateBillAndInvoiceNumbers(db, 'food');
    const invoiceId = `inv-${Date.now()}`;

    const effectiveTheme: InvoiceTheme = {
      ...db.invoiceTheme,
      preset: body.templatePreset || db.invoiceTheme.preset,
    };

    const invoice: Invoice = {
      id: invoiceId,
      billNumber,
      invoiceNumber,
      invoiceType: 'food',
      serviceLabel: serviceType,
      bookingId: `food-${Date.now()}`,
      guestId: guest?.id || 'walk-in',
      guestName,
      guestMobile,
      guestEmail,
      guestAddress: guest?.address || '',
      guestCount: 1,
      companyName,
      companyGst,
      roomNumber: tableLabel,
      roomType: `${serviceType} (F&B)`,
      checkInDate: orderIso,
      checkInTime: orderTime,
      checkOutDate: orderIso,
      checkOutTime: orderTime,
      nights: 0,
      roomSubtotal: 0,
      roomGstRate: 0,
      roomGstAmount: 0,
      foodSubtotal: folio.foodSubtotal,
      foodGstAmount: folio.foodGstAmount,
      extraChargesSubtotal: folio.extraChargesSubtotal,
      serviceChargeAmount: folio.serviceChargeAmount,
      discountAmount: folio.discountAmount,
      taxableTotal: folio.taxableTotal,
      taxRegime: db.gstSettings.taxRegime,
      cgstAmount: folio.cgstAmount,
      sgstAmount: folio.sgstAmount,
      igstAmount: folio.igstAmount,
      totalGst: folio.totalGst,
      grandTotal: folio.grandTotal,
      advancePaid: folio.advancePaid,
      netPaid: Math.max(0, folio.balanceDue),
      paymentMethod: body.paymentMethod || 'UPI',
      paymentReference: (body.paymentReference || '').trim(),
      issuedAt: nowIso,
      templatePreset: effectiveTheme.preset,
      emailStatus: 'Skipped',
      mobileStatus: 'Skipped',
      lineItems: folio.lineItems,
    };

    const shouldEmail =
      body.sendEmailReceipt !== undefined
        ? body.sendEmailReceipt
        : db.gstSettings.autoEmailReceipts;

    let emailLog = null;
    if (shouldEmail && guestEmail) {
      emailLog = await dispatchInvoiceEmailReceipt(
        invoice,
        db.gstSettings,
        effectiveTheme
      );
      invoice.emailStatus =
        emailLog.status === 'Delivered (SMTP)'
          ? 'Sent'
          : emailLog.status === 'Archived Receipt (Local Dispatch)'
            ? 'Archived'
            : 'Failed';
      invoice.emailSentAt = emailLog.sentAt;
      db.emailLogs.unshift(emailLog);
    }

    const shouldMobile =
      body.sendMobileInvoice !== undefined
        ? body.sendMobileInvoice
        : db.gstSettings.autoSmsReceipts;

    const baseUrl =
      process.env.APP_URL || `${req.protocol}://${req.get('host')}`;

    let mobileLog = null;
    if (shouldMobile && guestMobile !== '—') {
      const channel =
        db.gstSettings.mobileDispatchChannel === 'WhatsApp'
          ? 'WhatsApp'
          : 'SMS';
      mobileLog = await dispatchMobileInvoice(
        invoice,
        db.gstSettings,
        channel,
        baseUrl
      );
      invoice.mobileStatus =
        mobileLog.status === 'Delivered (Gateway)'
          ? 'Sent'
          : mobileLog.status === 'Archived Dispatch (Ready)'
            ? 'Archived'
            : 'Failed';
      invoice.mobileSentAt = mobileLog.sentAt;
      db.mobileLogs.unshift(mobileLog);

      if (db.gstSettings.mobileDispatchChannel === 'Both') {
        const waLog = await dispatchMobileInvoice(
          invoice,
          db.gstSettings,
          'WhatsApp',
          baseUrl
        );
        db.mobileLogs.unshift(waLog);
      }
    }

    db.invoices.unshift(invoice);
    saveDatabase(db);

    res.status(201).json({
      invoice,
      emailLog,
      mobileLog,
    });
  });

  // --- Shareable Standalone A4 HTML Invoice View (linked in SMS/WhatsApp & New-Tab Print) ---
  app.get('/api/invoices/:id/view', (req, res) => {
    const db = loadDatabase();
    const invoice = db.invoices.find((inv) => inv.id === req.params.id);
    if (!invoice) {
      res.status(404).send('Invoice not found.');
      return;
    }
    const guest = db.guests.find((g) => g.id === invoice.guestId);
    const booking = db.bookings.find((b) => b.id === invoice.bookingId);
    const enrichedInvoice: Invoice = {
      ...invoice,
      guestAddress: invoice.guestAddress || guest?.address || '',
      guestCount:
        invoice.guestCount ??
        (booking ? Math.max(1, (booking.adults || 1) + (booking.children || 0)) : 1),
    };
    const effectiveTheme: InvoiceTheme = {
      ...db.invoiceTheme,
      preset: invoice.templatePreset || db.invoiceTheme.preset,
    };
    const html = buildThemedEmailHtml(enrichedInvoice, db.gstSettings, effectiveTheme, {
      standalonePrint: true,
      autoPrint: req.query.autoprint === '1',
    });
    res.type('text/html').send(html);
  });

  // --- Vite / Static Frontend ---
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Hotel Shiv Residency PMS running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
