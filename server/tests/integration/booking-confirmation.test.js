import { randomUUID } from 'node:crypto';

import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// No live Resend calls: exercise the real Express route, DB transaction,
// booking content builder and authenticated hiker session.
const emailMocks = vi.hoisted(() => ({ send: vi.fn() }));
const capacityMocks = vi.hoisted(() => ({
  getDiningTables: vi.fn(),
  getMealSlots: vi.fn(),
}));
vi.mock('../../services/booking-confirmation-service.js', () => ({
  sendBookingConfirmationEmail: emailMocks.send,
}));
vi.mock('../../dao/capacity-dao.js', async (importOriginal) => {
  const actual = await importOriginal();
  capacityMocks.getDiningTables.mockImplementation(actual.getDiningTables);
  capacityMocks.getMealSlots.mockImplementation(actual.getMealSlots);
  return {
    ...actual,
    getDiningTables: capacityMocks.getDiningTables,
    getMealSlots: capacityMocks.getMealSlots,
  };
});

import app from '../../app.js';
import { getAsync, initializeDatabase, runAsync } from '../../db.js';
import { initializeAccounts } from '../../init/init-accounts.js';
import { hashPassword } from '../../services/password.js';

const suffix = randomUUID();
const hikerName = 'Confirmation Integration Hiker';
const hikerEmail = `confirmation-integration-${suffix}@example.com`;
const password = 'IntegrationBooking123!';
const bookingDate = '2099-11-01';
let hikerId;
let slotId;
let tableId;
let agent;

beforeAll(async () => {
  await initializeDatabase();
  await initializeAccounts();

  hikerId = (await runAsync(
    `INSERT INTO users (full_name, email, password_hash, role)
     VALUES (?, ?, ?, 'hiker')`,
    [hikerName, hikerEmail, await hashPassword(password)]
  )).lastID;
  agent = request.agent(app);
  const login = await agent.post('/api/sessions').send({ email: hikerEmail, password });
  expect(login.status).toBe(201);
});

beforeEach(async () => {
  slotId = (await runAsync(
    `INSERT INTO meal_slots (
      slot_date, name, start_time, end_time
    )
    VALUES (?, ?, '18:00', '20:00')`,
    [bookingDate, `Integration dinner ${suffix}`]
  )).lastID;
  tableId = (await runAsync(
    'INSERT INTO dining_tables (name, seat_count) VALUES (?, 4)',
    [`Integration table ${suffix}`]
  )).lastID;
  await runAsync('INSERT INTO slot_tables (slot_id, table_id) VALUES (?, ?)', [slotId, tableId]);

  emailMocks.send.mockReset();
  emailMocks.send.mockResolvedValue({ id: 'mock-email-id' });
});

afterEach(async () => {
  if (slotId) {
    await runAsync(
      'DELETE FROM booking_table_allocations WHERE booking_id IN (SELECT id FROM bookings WHERE slot_id = ?)',
      [slotId]
    );
    await runAsync('DELETE FROM bookings WHERE slot_id = ?', [slotId]);
    await runAsync('DELETE FROM slot_tables WHERE slot_id = ?', [slotId]);
  }
  if (tableId) await runAsync('DELETE FROM dining_tables WHERE id = ?', [tableId]);
  if (slotId) await runAsync('DELETE FROM meal_slots WHERE id = ?', [slotId]);
  slotId = undefined;
  tableId = undefined;
});

afterAll(async () => {
  if (hikerId) await runAsync('DELETE FROM users WHERE id = ?', [hikerId]);
});

describe('Booking confirmation flow (real persistence, mocked email)', () => {
  it('sends exactly one email to the authenticated booking owner containing persisted details', async () => {
    const response = await agent.post('/api/bookings').send({
      bookingDate, slotId, partySize: 2,
    });

    expect(response.status).toBe(201);
    const booking = response.body.booking;
    expect(booking).toMatchObject({ bookingDate, slotId, partySize: 2, status: 'confirmed' });
    const bookingCount = await getAsync(
      'SELECT COUNT(*) AS count FROM bookings WHERE id = ?',
      [booking.id]
    );
    expect(bookingCount.count).toBe(1);
    expect(emailMocks.send).toHaveBeenCalledTimes(1);

    const [message] = emailMocks.send.mock.calls[0];
    expect(message.to).toBe(hikerEmail);
    expect(message.subject).toContain(`Booking confirmed #${booking.id}`);
    expect(message.text).toContain(`Booking reference: #${booking.id}`);
    expect(message.text).toContain(`Name: ${hikerName}`);
    expect(message.text).toContain('Sunday 1 November 2099');
    expect(message.text).toContain('Meal service: Integration dinner');
    expect(message.text).toContain('18:00-20:00');
    expect(message.text).toContain('Party size: 2');
    expect(message.text).toContain('Table allocation:');
    expect(message.text).toContain(`Integration table ${suffix}: 2 seats`);
    expect(message.html).toContain('Your table booking at the Mountain Hut is confirmed.');
    expect(message.html).toContain(`Integration table ${suffix}`);

    const stored = await getAsync('SELECT * FROM bookings WHERE id = ?', [booking.id]);
    expect(stored).toBeDefined();
    expect(stored.hiker_id).toBe(hikerId);
  });

  it('only calls the email service after the booking and allocations are committed', async () => {
    let persistedAtSend = false;
    emailMocks.send.mockImplementationOnce(async (message) => {
      const match = message.text.match(/Booking reference: #(\d+)/);
      expect(match).not.toBeNull();
      const bookingId = Number(match[1]);
      const stored = await getAsync('SELECT id FROM bookings WHERE id = ?', [bookingId]);
      const allocation = await getAsync(
        'SELECT booking_id FROM booking_table_allocations WHERE booking_id = ?', [bookingId]
      );
      persistedAtSend = stored?.id === bookingId && allocation?.booking_id === bookingId;
      return { id: 'mock-email-id' };
    });

    const response = await agent.post('/api/bookings').send({
      bookingDate, slotId, partySize: 1,
    });
    expect(response.status).toBe(201);
    const bookingCount = await getAsync(
      'SELECT COUNT(*) AS count FROM bookings WHERE slot_id = ? AND booking_date = ?',
      [slotId, bookingDate]
    );
    expect(bookingCount.count).toBe(1);
    expect(emailMocks.send).toHaveBeenCalledTimes(1);
    expect(persistedAtSend).toBe(true);
  });

  it('keeps the booking and responds 201 when the email service rejects', async () => {
    emailMocks.send.mockRejectedValueOnce(new Error('Resend offline'));
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const response = await agent.post('/api/bookings').send({
        bookingDate, slotId, partySize: 1,
      });
      expect(response.status).toBe(201);
      expect(emailMocks.send).toHaveBeenCalledTimes(1);
      const booking = response.body.booking;
      const bookingCount = await getAsync(
        'SELECT COUNT(*) AS count FROM bookings WHERE id = ?',
        [booking.id]
      );
      expect(bookingCount.count).toBe(1);
      const stored = await getAsync(
        'SELECT id, hiker_id, slot_id, party_size, status FROM bookings WHERE id = ?',
        [booking.id]
      );
      expect(stored).toMatchObject({
        id: booking.id,
        hiker_id: hikerId,
        slot_id: slotId,
        party_size: 1,
        status: 'confirmed',
      });
      const allocation = await getAsync(
        `SELECT booking_id, table_id, seats_reserved
         FROM booking_table_allocations
         WHERE booking_id = ?`,
        [booking.id]
      );
      expect(allocation).toMatchObject({
        booking_id: booking.id,
        table_id: tableId,
        seats_reserved: 1,
      });
      expect(errorSpy).toHaveBeenCalledWith(
        'Booking saved, but confirmation email could not be sent:',
        expect.any(Error)
      );
    } finally {
      errorSpy.mockRestore();
    }
  });

  it('keeps the booking when email preparation fails', async () => {
    capacityMocks.getDiningTables.mockRejectedValueOnce(new Error('Capacity lookup offline'));
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const response = await agent.post('/api/bookings').send({
        bookingDate, slotId, partySize: 1,
      });
      expect(response.status).toBe(201);
      expect(emailMocks.send).not.toHaveBeenCalled();

      const booking = response.body.booking;
      const bookingCount = await getAsync(
        'SELECT COUNT(*) AS count FROM bookings WHERE id = ?',
        [booking.id]
      );
      expect(bookingCount.count).toBe(1);
      const allocation = await getAsync(
        `SELECT booking_id, table_id, seats_reserved
         FROM booking_table_allocations
         WHERE booking_id = ?`,
        [booking.id]
      );
      expect(allocation).toMatchObject({
        booking_id: booking.id,
        table_id: tableId,
        seats_reserved: 1,
      });
      expect(errorSpy).toHaveBeenCalledWith(
        'Booking saved, but confirmation email could not be sent:',
        expect.any(Error)
      );
    } finally {
      errorSpy.mockRestore();
    }
  });

  it('does not send an email if the booking is rejected before persistence', async () => {
    const response = await agent.post('/api/bookings').send({
      bookingDate: 'bad-date', slotId, partySize: 1,
    });
    expect(response.status).toBe(400);
    expect(emailMocks.send).not.toHaveBeenCalled();
    const bookingCount = await getAsync(
      'SELECT COUNT(*) AS count FROM bookings WHERE slot_id = ? AND booking_date = ?',
      [slotId, 'bad-date']
    );
    expect(bookingCount.count).toBe(0);
  });


  it('keeps the booking when meal slot cannot be found during email preparation', async () => {
    capacityMocks.getMealSlots.mockResolvedValueOnce([]);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const response = await agent.post('/api/bookings').send({
        bookingDate, slotId, partySize: 1,
      });
      expect(response.status).toBe(201);
      expect(emailMocks.send).not.toHaveBeenCalled();
      expect(errorSpy).toHaveBeenCalledWith(
        'Booking saved, but confirmation email could not be sent:',
        expect.any(Error)
      );
    } finally {
      errorSpy.mockRestore();
    }
  });


});
