import { randomUUID } from 'node:crypto';

import request from 'supertest';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

// Create the email mock before importing modules that use the sending service.
const emailMocks = vi.hoisted(() => ({
  send: vi.fn(),
}));

// Exercise the real booking route and template without sending real emails.
vi.mock('../../services/booking-confirmation-service.js', () => ({
  sendBookingConfirmationEmail: emailMocks.send,
}));

import app from '../../app.js';
import {
  getAsync,
  initializeDatabase,
  runAsync,
} from '../../db.js';
import { initializeAccounts } from '../../init/init-accounts.js';
import { hashPassword } from '../../services/password.js';

// Use unique fixture names and a future date for booking requests.
const suffix = randomUUID();
const email = `confirmation-route-${suffix}@example.com`;
const password = 'ConfirmationTest123!';
const bookingDate = '2099-10-01';

// Keep fixture IDs and the authenticated agent for requests and cleanup.
let userId;
let slotId;
let tableId;
let agent;

// Create an authenticated hiker and a slot with one four-seat table.
beforeAll(async () => {
  await initializeDatabase();
  await initializeAccounts();

  const passwordHash = await hashPassword(password);

  // Create the account that receives booking confirmation emails.
  userId = (
    await runAsync(
      `INSERT INTO users (
         full_name, email, password_hash, role
       )
       VALUES (?, ?, ?, 'hiker')`,
      ['Confirmation Route Hiker', email, passwordHash]
    )
  ).lastID;

  // Create the meal slot used by every test in this suite.
  slotId = (
    await runAsync(
      `INSERT INTO meal_slots (
         slot_date, name, start_time, end_time
       )
       VALUES (?, ?, '18:00', '20:00')`,
      [bookingDate, `Confirmation slot ${suffix}`]
    )
  ).lastID;

  // Create and assign a table with enough seats for valid test requests.
  tableId = (
    await runAsync(
      'INSERT INTO dining_tables (name, seat_count) VALUES (?, 4)',
      [`Confirmation table ${suffix}`]
    )
  ).lastID;

  await runAsync(
    'INSERT INTO slot_tables (slot_id, table_id) VALUES (?, ?)',
    [slotId, tableId]
  );

  // Preserve the login cookie across subsequent booking requests.
  agent = request.agent(app);

  const login = await agent
    .post('/api/sessions')
    .send({ email, password });

  expect(login.status).toBe(201);
});

// Reset bookings and email behavior so each test starts independently.
beforeEach(async () => {
  // Delete allocations before bookings to respect foreign-key dependencies.
  await runAsync(
    `DELETE FROM booking_table_allocations
     WHERE booking_id IN (
       SELECT id FROM bookings WHERE slot_id = ?
     )`,
    [slotId]
  );

  await runAsync(
    'DELETE FROM bookings WHERE slot_id = ?',
    [slotId]
  );

  // Clear previous calls and default to a successful email submission.
  emailMocks.send.mockReset();
  emailMocks.send.mockResolvedValue({
    id: 'test-email-id',
  });
});

// Remove all fixtures in dependency order after the suite finishes.
afterAll(async () => {
  if (slotId) {
    // Remove booking allocations, bookings, and table assignments first.
    await runAsync(
      `DELETE FROM booking_table_allocations
       WHERE booking_id IN (
         SELECT id FROM bookings WHERE slot_id = ?
       )`,
      [slotId]
    );

    await runAsync(
      'DELETE FROM bookings WHERE slot_id = ?',
      [slotId]
    );

    await runAsync(
      'DELETE FROM slot_tables WHERE slot_id = ?',
      [slotId]
    );
  }

  // Remove the reusable table after its assignments have been deleted.
  if (tableId) {
    await runAsync(
      'DELETE FROM dining_tables WHERE id = ?',
      [tableId]
    );
  }

  // Remove the meal slot and recipient account.
  if (slotId) {
    await runAsync(
      'DELETE FROM meal_slots WHERE id = ?',
      [slotId]
    );
  }

  if (userId) {
    await runAsync(
      'DELETE FROM users WHERE id = ?',
      [userId]
    );
  }
});

describe('POST /api/bookings confirmation email integration', () => {
  // Verify successful booking creation and preparation of the confirmation email.
  it('sends the existing email template after the booking is persisted', async () => {
    const response = await agent
      .post('/api/bookings')
      .send({
        bookingDate,
        slotId,
        partySize: 2,
      });

    expect(response.status).toBe(201);

    expect(response.body.booking).toMatchObject({
      bookingDate,
      slotId,
      partySize: 2,
      status: 'confirmed',
    });

    // Check that the route sends one email with the expected recipient and content.
    expect(emailMocks.send).toHaveBeenCalledTimes(1);

    expect(emailMocks.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: email,
        subject: expect.stringContaining('Booking confirmed #'),
        text: expect.stringContaining(
          'Meal service: Confirmation slot'
        ),
        html: expect.stringContaining('Table allocation'),
      }),
    );

    // Confirm that the booking returned by the API exists in the database.
    const stored = await getAsync(
      'SELECT id FROM bookings WHERE id = ?',
      [response.body.booking.id]
    );

    expect(stored.id).toBe(response.body.booking.id);
  });

  // Email failure must not undo a successfully saved booking.
  it('keeps the booking and responds 201 if email delivery fails', async () => {
    emailMocks.send.mockRejectedValueOnce(
      new Error('Resend unavailable')
    );

    // Suppress the expected error log while checking that it is produced.
    const consoleSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    try {
      const response = await agent
        .post('/api/bookings')
        .send({
          bookingDate,
          slotId,
          partySize: 1,
        });

      expect(response.status).toBe(201);
      expect(emailMocks.send).toHaveBeenCalledTimes(1);

      // The booking must remain persisted despite the email service failure.
      const stored = await getAsync(
        'SELECT id FROM bookings WHERE id = ?',
        [response.body.booking.id]
      );

      expect(stored.id).toBe(response.body.booking.id);
      expect(consoleSpy).toHaveBeenCalled();
    } finally {
      // Restore logging even if an assertion fails.
      consoleSpy.mockRestore();
    }
  });

  // Invalid booking input must never trigger an email.
  it('never sends an email when booking validation fails', async () => {
    const response = await agent
      .post('/api/bookings')
      .send({
        bookingDate: 'not-a-date',
        slotId,
        partySize: 1,
      });

    expect(response.status).toBe(400);
    expect(emailMocks.send).not.toHaveBeenCalled();
  });

  // A slot cannot be booked on a date different from its configured date.
  it('does not save a booking or send an email for another slot date', async () => {
    const response = await agent
      .post('/api/bookings')
      .send({
        bookingDate: '2099-10-02',
        slotId,
        partySize: 1,
      });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('INVALID_BOOKING');
    expect(emailMocks.send).not.toHaveBeenCalled();

    // Verify that the rejected request left no booking for this slot.
    const stored = await getAsync(
      'SELECT COUNT(*) AS count FROM bookings WHERE slot_id = ?',
      [slotId]
    );

    expect(stored.count).toBe(0);
  });

  // Verify that optional requests survive persistence and reach both email formats.
  it('saves special requests and includes them in the email', async () => {
    const specialRequests =
      'One guest has a peanut allergy; two vegetarian meals.';

    const response = await agent
      .post('/api/bookings')
      .send({
        bookingDate,
        slotId,
        partySize: 2,
        specialRequests,
      });

    expect(response.status).toBe(201);

    // The API response must include the submitted requests.
    expect(response.body.booking.specialRequests).toBe(
      specialRequests
    );

    // Verify the stored value independently of the API response.
    const stored = await getAsync(
      `SELECT special_requests AS specialRequests
       FROM bookings
       WHERE id = ?`,
      [response.body.booking.id]
    );

    expect(stored.specialRequests).toBe(specialRequests);

    // Both plain-text and HTML email bodies must contain the requests.
    expect(emailMocks.send).toHaveBeenCalledWith(
      expect.objectContaining({
        text: expect.stringContaining(specialRequests),
        html: expect.stringContaining(specialRequests),
      })
    );
  });

  // Requests exceeding the character limit must not be saved or emailed.
  it('rejects special requests longer than 1000 characters', async () => {
    const response = await agent
      .post('/api/bookings')
      .send({
        bookingDate,
        slotId,
        partySize: 2,
        specialRequests: 'x'.repeat(1001),
      });

    expect(response.status).toBe(400);
    expect(emailMocks.send).not.toHaveBeenCalled();

    // Confirm that validation failed before any booking was persisted.
    const stored = await getAsync(
      'SELECT COUNT(*) AS count FROM bookings WHERE slot_id = ?',
      [slotId]
    );

    expect(stored.count).toBe(0);
  });
});