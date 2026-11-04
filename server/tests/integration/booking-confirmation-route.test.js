import { randomUUID } from 'node:crypto';

import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const emailMocks = vi.hoisted(() => ({ send: vi.fn() }));

vi.mock('../../services/booking-confirmation-service.js', () => ({
  sendBookingConfirmationEmail: emailMocks.send,
}));

import app from '../../app.js';
import { getAsync, initializeDatabase, runAsync } from '../../db.js';
import { initializeAccounts } from '../../init/init-accounts.js';
import { hashPassword } from '../../services/password.js';

const suffix = randomUUID();
const email = `confirmation-route-${suffix}@example.com`;
const password = 'ConfirmationTest123!';
let userId;
let slotId;
let tableId;
let agent;

beforeAll(async () => {
  await initializeDatabase();
  await initializeAccounts();

  const passwordHash = await hashPassword(password);
  userId = (await runAsync(
    `INSERT INTO users (full_name, email, password_hash, role)
     VALUES (?, ?, ?, 'hiker')`,
    ['Confirmation Route Hiker', email, passwordHash]
  )).lastID;
  slotId = (await runAsync(
    `INSERT INTO meal_slots (name, start_time, end_time)
     VALUES (?, '18:00', '20:00')`,
    [`Confirmation slot ${suffix}`]
  )).lastID;
  tableId = (await runAsync(
    'INSERT INTO dining_tables (name, seat_count) VALUES (?, 4)',
    [`Confirmation table ${suffix}`]
  )).lastID;
  await runAsync('INSERT INTO slot_tables (slot_id, table_id) VALUES (?, ?)', [slotId, tableId]);

  agent = request.agent(app);
  const login = await agent.post('/api/sessions').send({ email, password });
  expect(login.status).toBe(201);
});

beforeEach(() => {
  emailMocks.send.mockReset();
  emailMocks.send.mockResolvedValue({ id: 'test-email-id' });
});

afterAll(async () => {
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
  if (userId) await runAsync('DELETE FROM users WHERE id = ?', [userId]);
});

describe('POST /api/bookings confirmation email integration', () => {
  it('sends the existing email template after the booking is persisted', async () => {
    const response = await agent.post('/api/bookings').send({
      bookingDate: '2099-10-01', slotId, partySize: 2,
    });

    expect(response.status).toBe(201);
    expect(response.body.booking).toMatchObject({ slotId, partySize: 2, status: 'confirmed' });
    expect(emailMocks.send).toHaveBeenCalledTimes(1);
    expect(emailMocks.send).toHaveBeenCalledWith(expect.objectContaining({
      to: email,
      subject: expect.stringContaining('Booking confirmed #'),
      text: expect.stringContaining('Meal service: Confirmation slot'),
      html: expect.stringContaining('Table allocation:'),
    }));

    const stored = await getAsync('SELECT id FROM bookings WHERE id = ?', [response.body.booking.id]);
    expect(stored.id).toBe(response.body.booking.id);
  });

  it('keeps the booking and responds 201 if email delivery fails', async () => {
    emailMocks.send.mockRejectedValueOnce(new Error('Resend unavailable'));
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const response = await agent.post('/api/bookings').send({
        bookingDate: '2099-10-02', slotId, partySize: 1,
      });
      expect(response.status).toBe(201);
      expect(emailMocks.send).toHaveBeenCalledTimes(1);
      const stored = await getAsync('SELECT id FROM bookings WHERE id = ?', [response.body.booking.id]);
      expect(stored.id).toBe(response.body.booking.id);
      expect(consoleSpy).toHaveBeenCalled();
    } finally {
      consoleSpy.mockRestore();
    }
  });

  it('never sends an email when booking validation fails', async () => {
    const response = await agent.post('/api/bookings').send({
      bookingDate: 'not-a-date', slotId, partySize: 1,
    });
    expect(response.status).toBe(400);
    expect(emailMocks.send).not.toHaveBeenCalled();
  });
});
