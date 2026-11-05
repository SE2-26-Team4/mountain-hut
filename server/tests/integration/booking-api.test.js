import { randomUUID } from 'node:crypto';

import request from 'supertest';
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

// These tests verify booking APIs, not real email delivery.
vi.mock('../../services/booking-confirmation-service.js', () => ({
  sendBookingConfirmationEmail: vi.fn().mockResolvedValue({
    id: 'test-email-id',
  }),
}));

import app from '../../app.js';
import { BookingError } from '../../dao/booking-dao.js';
import {
  getAsync,
  initializeDatabase,
  runAsync,
} from '../../db.js';
import { initializeAccounts } from '../../init/init-accounts.js';
import * as BookingService from '../../services/booking-service.js';
import { hashPassword } from '../../services/password.js';

const password = 'BookingApiTest123!';
const email = `booking-api-${randomUUID()}@example.com`;
const bookingDate = '2099-12-31';
const uniqueSuffix = randomUUID();

let hikerId;
let slotId;
let inactiveSlotId;
let tableId;
let hikerAgent;

/** @type {Record<string, {
 *   id: number,
 *   agent: import('supertest').Agent
 * }>} */
const staffAccounts = {};

async function clearTestBookings() {
  await runAsync(
    `DELETE FROM booking_table_allocations
     WHERE booking_id IN (
       SELECT id FROM bookings WHERE slot_id = ?
     )`,
    [slotId],
  );

  await runAsync(
    'DELETE FROM bookings WHERE slot_id = ?',
    [slotId],
  );
}

beforeAll(async () => {
  await initializeDatabase();
  await initializeAccounts();

  const passwordHash = await hashPassword(password);

  const user = await runAsync(
    `INSERT INTO users (
       full_name, email, password_hash, role
     )
     VALUES (?, ?, ?, 'hiker')`,
    ['Booking API Hiker', email, passwordHash],
  );

  hikerId = user.lastID;

  const slot = await runAsync(
    `INSERT INTO meal_slots (
       slot_date, name, start_time, end_time
     )
     VALUES (?, ?, '18:00', '20:00')`,
    [bookingDate, `Booking API slot ${uniqueSuffix}`],
  );

  slotId = slot.lastID;

  const inactiveSlot = await runAsync(
    `INSERT INTO meal_slots (
       slot_date, name, start_time, end_time, is_active
     )
     VALUES (?, ?, '12:00', '14:00', 0)`,
    [bookingDate, `Booking API inactive slot ${uniqueSuffix}`],
  );

  inactiveSlotId = inactiveSlot.lastID;

  const table = await runAsync(
    `INSERT INTO dining_tables (name, seat_count)
     VALUES (?, 4)`,
    [`Booking API table ${uniqueSuffix}`],
  );

  tableId = table.lastID;

  await runAsync(
    'INSERT INTO slot_tables (slot_id, table_id) VALUES (?, ?)',
    [slotId, tableId],
  );

  hikerAgent = request.agent(app);

  const loginResponse = await hikerAgent
    .post('/api/sessions')
    .send({ email, password });

  expect(loginResponse.status).toBe(201);

  for (const role of ['employee', 'warden']) {
    const staffEmail =
      `booking-api-${role}-${uniqueSuffix}@example.com`;

    const staffUser = await runAsync(
      `INSERT INTO users (
         full_name, email, password_hash, role
       )
       VALUES (?, ?, ?, ?)`,
      [
        `Booking API ${role}`,
        staffEmail,
        passwordHash,
        role,
      ],
    );

    const agent = request.agent(app);

    const staffLoginResponse = await agent
      .post('/api/staff/sessions')
      .send({ email: staffEmail, password });

    expect(staffLoginResponse.status).toBe(201);

    staffAccounts[role] = {
      id: staffUser.lastID,
      agent,
    };
  }
});

beforeEach(async () => {
  await clearTestBookings();
});

afterEach(() => {
  vi.restoreAllMocks();
});

afterAll(async () => {
  if (slotId) {
    await clearTestBookings();

    await runAsync(
      'DELETE FROM slot_tables WHERE slot_id = ?',
      [slotId],
    );
  }

  if (tableId) {
    await runAsync(
      'DELETE FROM dining_tables WHERE id = ?',
      [tableId],
    );
  }

  for (const id of [slotId, inactiveSlotId]) {
    if (id) {
      await runAsync(
        'DELETE FROM meal_slots WHERE id = ?',
        [id],
      );
    }
  }

  if (hikerId) {
    await runAsync(
      'DELETE FROM users WHERE id = ?',
      [hikerId],
    );
  }

  for (const { id } of Object.values(staffAccounts)) {
    await runAsync(
      'DELETE FROM users WHERE id = ?',
      [id],
    );
  }
});

describe('booking availability API', () => {
  it('returns availability for an active meal slot', async () => {
    const response = await request(app)
      .get('/api/bookings/availability')
      .query({ bookingDate, slotId });

    expect(response.status).toBe(200);

    expect(response.body.availability).toMatchObject({
      bookingDate,
      slotId,
      totalAvailableSeats: 4,
    });

    expect(response.body.availability.tables).toEqual([
      expect.objectContaining({
        id: tableId,
        seatCount: 4,
        reservedSeats: 0,
        availableSeats: 4,
      }),
    ]);
  });

  it.each([
    'invalid date',
    'invalid slot ID',
    'missing slot ID',
  ])('rejects availability parameters: %s', async (scenario) => {
    const query =
      scenario === 'invalid date'
        ? { bookingDate: 'not-a-date', slotId }
        : scenario === 'invalid slot ID'
          ? { bookingDate, slotId: 'invalid' }
          : { bookingDate };

    const response = await request(app)
      .get('/api/bookings/availability')
      .query(query);

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('INVALID_BOOKING');
  });

  it('returns 404 for an unknown meal slot', async () => {
    const response = await request(app)
      .get('/api/bookings/availability')
      .query({ bookingDate, slotId: 999999 });

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe(
      'MEAL_SLOT_NOT_FOUND',
    );
  });

  it('returns no availability when the slot belongs to another date', async () => {
    const response = await request(app)
      .get('/api/bookings/availability')
      .query({
        bookingDate: '2100-01-01',
        slotId,
      });

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe(
      'MEAL_SLOT_NOT_FOUND',
    );
  });
});

describe('booking management API', () => {
  it('requires authentication to create a booking', async () => {
    const response = await request(app)
      .post('/api/bookings')
      .send({ bookingDate, slotId, partySize: 1 });

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHENTICATED');
  });

  it.each(['employee', 'warden'])(
    'rejects booking creation by %s accounts',
    async (role) => {
      const { id, agent } = staffAccounts[role];

      const response = await agent
        .post('/api/bookings')
        .send({
          bookingDate,
          slotId,
          partySize: 1,
        });

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe('FORBIDDEN');

      const saved = await getAsync(
        'SELECT COUNT(*) AS count FROM bookings WHERE hiker_id = ?',
        [id],
      );

      expect(saved.count).toBe(0);
    },
  );

  it('returns 404 when booking an unknown meal slot', async () => {
    const response = await hikerAgent
      .post('/api/bookings')
      .send({
        bookingDate,
        slotId: 999999,
        partySize: 1,
      });

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('SLOT_NOT_FOUND');
  });

  it('rejects a booking for an inactive meal slot', async () => {
    const response = await hikerAgent
      .post('/api/bookings')
      .send({
        bookingDate,
        slotId: inactiveSlotId,
        partySize: 1,
      });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('SLOT_INACTIVE');
  });

  it.each([
    'invalid date',
    'zero party size',
    'fractional party size',
  ])('rejects booking data: %s', async (scenario) => {
    const body = {
      bookingDate,
      slotId,
      partySize: 1,
    };

    if (scenario === 'invalid date') {
      body.bookingDate = 'invalid';
    } else if (scenario === 'zero party size') {
      body.partySize = 0;
    } else {
      body.partySize = 1.5;
    }

    const response = await hikerAgent
      .post('/api/bookings')
      .send(body);

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe(
      scenario === 'invalid date'
        ? 'INVALID_BOOKING'
        : 'INVALID_PARTY_SIZE',
    );
  });

  it('rejects a past booking date without saving a booking', async () => {
    const pastDate = '2000-01-01';

    const response = await hikerAgent
      .post('/api/bookings')
      .send({
        bookingDate: pastDate,
        slotId,
        partySize: 2,
      });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('INVALID_BOOKING');

    const saved = await getAsync(
      `SELECT COUNT(*) AS count
       FROM bookings
       WHERE hiker_id = ?
         AND slot_id = ?
         AND booking_date = ?`,
      [hikerId, slotId, pastDate],
    );

    expect(saved.count).toBe(0);
  });

  it('creates a booking', async () => {
    const response = await hikerAgent
      .post('/api/bookings')
      .send({
        bookingDate,
        slotId,
        partySize: 2,
      });

    expect(response.status).toBe(201);

    expect(response.body.booking).toMatchObject({
      hikerId,
      bookingDate,
      slotId,
      partySize: 2,
      status: 'confirmed',
      allocations: [{ tableId, seatsReserved: 2 }],
    });

    const availability = await request(app)
      .get('/api/bookings/availability')
      .query({ bookingDate, slotId });

    expect(availability.status).toBe(200);

    expect(
      availability.body.availability.totalAvailableSeats,
    ).toBe(2);
  });

  it('rejects a booking when there is not enough availability', async () => {
    const response = await hikerAgent
      .post('/api/bookings')
      .send({
        bookingDate,
        slotId,
        partySize: 5,
      });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('NO_AVAILABILITY');
  });

  it('rejects booking a slot on another date without saving it', async () => {
    const wrongDate = '2100-01-01';

    const response = await hikerAgent
      .post('/api/bookings')
      .send({
        bookingDate: wrongDate,
        slotId,
        partySize: 1,
      });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('INVALID_BOOKING');

    const stored = await getAsync(
      `SELECT COUNT(*) AS count
       FROM bookings
       WHERE slot_id = ? AND booking_date = ?`,
      [slotId, wrongDate],
    );

    expect(stored.count).toBe(0);
  });
});

describe('booking API error handling', () => {
  it('returns 503 when the database is busy', async () => {
    vi.spyOn(
      BookingService,
      'createBookingForHiker',
    ).mockRejectedValueOnce(
      Object.assign(new Error('SQLITE_BUSY: database is locked'), {
        code: 'SQLITE_BUSY',
      }),
    );

    const response = await hikerAgent
      .post('/api/bookings')
      .send({ bookingDate, slotId, partySize: 1 });

    expect(response.status).toBe(503);
    expect(response.body.error.code).toBe('DATABASE_BUSY');
  });

  it.each([
    [
      'an unknown booking error code',
      new BookingError('UNKNOWN_CODE', 'Private booking detail'),
    ],
    [
      'an unexpected error',
      new Error('Private database detail'),
    ],
  ])('returns a generic 500 response for %s', async (_label, error) => {
    vi.spyOn(console, 'error').mockImplementation(() => {});

    vi.spyOn(
      BookingService,
      'createBookingForHiker',
    ).mockRejectedValueOnce(error);

    const response = await hikerAgent
      .post('/api/bookings')
      .send({ bookingDate, slotId, partySize: 1 });

    expect(response.status).toBe(500);

    expect(response.body.error).toEqual({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred.',
    });

    expect(response.text).not.toContain('Private');
  });
});

describe('booking retrieval and cancellation API', () => {
  let createdBookingId;

  beforeEach(async () => {
    const created = await hikerAgent
      .post('/api/bookings')
      .send({
        bookingDate,
        slotId,
        partySize: 1,
      });

    expect(created.status).toBe(201);
    createdBookingId = created.body.booking.id;
  });

  it('allows an authenticated hiker to retrieve their bookings', async () => {
    const response = await hikerAgent.get('/api/bookings');

    expect(response.status).toBe(200);

    expect(response.body.bookings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: createdBookingId,
          hikerId,
          bookingDate,
          slotId,
          status: 'confirmed',
        }),
      ]),
    );
  });

  it('allows an authenticated hiker to cancel their booking', async () => {
    const response = await hikerAgent.delete(
      `/api/bookings/${createdBookingId}`,
    );

    expect(response.status).toBe(200);
    expect(response.body.booking.status).toBe('cancelled');

    const availability = await request(app)
      .get('/api/bookings/availability')
      .query({ bookingDate, slotId });

    expect(availability.status).toBe(200);

    expect(
      availability.body.availability.totalAvailableSeats,
    ).toBe(4);
  });
});