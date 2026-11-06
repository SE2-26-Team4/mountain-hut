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

// Simulate email sending so booking-rule tests never contact the provider.
vi.mock('../../services/booking-confirmation-service.js', () => ({
  sendBookingConfirmationEmail: vi.fn().mockResolvedValue({
    id: 'test-email-id',
  }),
}));

import app from '../../app.js';
import {
  getAsync,
  initializeDatabase,
  runAsync,
} from '../../db.js';
import { initializeAccounts } from '../../init/init-accounts.js';
import { hashPassword } from '../../services/password.js';

// Use unique fixture names and a shared password for the test accounts.
const password = 'BookingRulesTest123!';
const uniqueSuffix = randomUUID();

// Separate dates isolate sharing, duplicate-booking, and deadline scenarios.
const sharedDate = '2099-10-01';
const multiTableDate = '2099-10-03';
const soonDate = '2030-01-04';

// Keep authenticated hikers and created fixture IDs for requests and cleanup.
/** @type {{ id: number, agent: import('supertest').Agent }[]} */
const hikers = [];

/** @type {number[]} */
const slotIds = [];

/** @type {number[]} */
const tableIds = [];

let sharedSlotId;
let sharedTableId;
let multiTableSlotId;
let soonSlotId;

/**
 * Creates a slot and assigns newly created tables with the requested capacities.
 *
 * @param {string} slotDate
 * @param {string} startTime
 * @param {string} endTime
 * @param {number[]} seatCounts
 * @returns {Promise<{
 *   slotId: number,
 *   slotTableIds: number[]
 * }>}
 */
async function createSlotWithTables(
  slotDate,
  startTime,
  endTime,
  seatCounts,
) {
  // Create the slot and track it for later cleanup.
  const slot = await runAsync(
    `INSERT INTO meal_slots (
       slot_date, name, start_time, end_time
     )
     VALUES (?, ?, ?, ?)`,
    [
      slotDate,
      `Booking rules slot ${slotIds.length} ${uniqueSuffix}`,
      startTime,
      endTime,
    ],
  );

  slotIds.push(slot.lastID);

  const slotTableIds = [];

  // Create a separate reusable table for each requested seat count.
  for (const seatCount of seatCounts) {
    const table = await runAsync(
      `INSERT INTO dining_tables (name, seat_count)
       VALUES (?, ?)`,
      [
        `Booking rules table ${tableIds.length} ${uniqueSuffix}`,
        seatCount,
      ],
    );

    tableIds.push(table.lastID);
    slotTableIds.push(table.lastID);

    // Assign the new table to this slot.
    await runAsync(
      'INSERT INTO slot_tables (slot_id, table_id) VALUES (?, ?)',
      [slot.lastID, table.lastID],
    );
  }

  return {
    slotId: slot.lastID,
    slotTableIds,
  };
}

/**
 * Counts confirmed bookings for one hiker, date, and slot.
 *
 * @param {number} hikerId
 * @param {string} bookingDate
 * @param {number} slotId
 * @returns {Promise<number>}
 */
async function countConfirmedBookings(
  hikerId,
  bookingDate,
  slotId,
) {
  const row = await getAsync(
    `SELECT COUNT(*) AS count
     FROM bookings
     WHERE hiker_id = ?
       AND booking_date = ?
       AND slot_id = ?
       AND status = 'confirmed'`,
    [hikerId, bookingDate, slotId],
  );

  return row.count;
}

// Remove bookings and their allocations while preserving slot configuration.
async function clearBookings() {
  for (const slotId of slotIds) {
    // Delete child records before their parent bookings.
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
}

// Create authenticated hikers and the configurations used by the suite.
beforeAll(async () => {
  await initializeDatabase();
  await initializeAccounts();

  const passwordHash = await hashPassword(password);

  // Create two hikers so separate parties can share a table.
  for (const index of [1, 2]) {
    const email =
      `booking-rules-${index}-${uniqueSuffix}@example.com`;

    const user = await runAsync(
      `INSERT INTO users (
         full_name, email, password_hash, role
       )
       VALUES (?, ?, ?, 'hiker')`,
      [`Booking Rules Hiker ${index}`, email, passwordHash],
    );

    const agent = request.agent(app);

    const login = await agent
      .post('/api/sessions')
      .send({ email, password });

    expect(login.status).toBe(201);

    hikers.push({
      id: user.lastID,
      agent,
    });
  }

  // Use one four-seat table for sharing tests.
  const shared = await createSlotWithTables(
    sharedDate,
    '12:00',
    '14:00',
    [4],
  );

  sharedSlotId = shared.slotId;
  [sharedTableId] = shared.slotTableIds;

  // Provide sufficient capacity so duplicate rejection is not caused by fullness.
  const multiTable = await createSlotWithTables(
    multiTableDate,
    '19:00',
    '21:00',
    [4, 4],
  );

  multiTableSlotId = multiTable.slotId;

  // Use a fixed lunch slot for tests with a simulated clock.
  const soon = await createSlotWithTables(
    soonDate,
    '12:00',
    '14:00',
    [4],
  );

  soonSlotId = soon.slotId;
});

// Start each test without previously saved bookings.
beforeEach(async () => {
  await clearBookings();
});

// Restore the real clock after tests that simulate a specific time.
afterEach(() => {
  vi.useRealTimers();
});

// Remove all fixtures in dependency order after the suite finishes.
afterAll(async () => {
  await clearBookings();

  // Remove assignments before deleting their slots and tables.
  for (const slotId of slotIds) {
    await runAsync(
      'DELETE FROM slot_tables WHERE slot_id = ?',
      [slotId],
    );

    await runAsync(
      'DELETE FROM meal_slots WHERE id = ?',
      [slotId],
    );
  }

  for (const tableId of tableIds) {
    await runAsync(
      'DELETE FROM dining_tables WHERE id = ?',
      [tableId],
    );
  }

  // Remove the additional hiker accounts created by this suite.
  for (const { id } of hikers) {
    await runAsync(
      'DELETE FROM users WHERE id = ?',
      [id],
    );
  }
});

describe('MH-01 table sharing', () => {
  // A partially occupied table must expose its remaining seats.
  it('counts the free seats of a partially occupied table as available', async () => {
    const first = await hikers[0].agent
      .post('/api/bookings')
      .send({
        bookingDate: sharedDate,
        slotId: sharedSlotId,
        partySize: 2,
      });

    expect(first.status).toBe(201);

    // Two seats out of four must remain available.
    const response = await request(app)
      .get('/api/bookings/availability')
      .query({
        bookingDate: sharedDate,
        slotId: sharedSlotId,
      });

    expect(response.status).toBe(200);

    expect(
      response.body.availability.totalAvailableSeats,
    ).toBe(2);
  });

  // Another hiker can reserve the remaining seats at the same table.
  it('seats another party at a partially occupied table', async () => {
    const first = await hikers[0].agent
      .post('/api/bookings')
      .send({
        bookingDate: sharedDate,
        slotId: sharedSlotId,
        partySize: 2,
      });

    expect(first.status).toBe(201);

    const second = await hikers[1].agent
      .post('/api/bookings')
      .send({
        bookingDate: sharedDate,
        slotId: sharedSlotId,
        partySize: 2,
      });

    expect(second.status).toBe(201);

    // Both parties must use the same shared table.
    expect(second.body.booking.allocations).toEqual([
      {
        tableId: sharedTableId,
        seatsReserved: 2,
      },
    ]);
  });
});

describe('MH-01 booking constraints', () => {
  // A hiker cannot hold two confirmed bookings for the same date and slot.
  it('rejects a second booking by the same hiker for the same date and slot', async () => {
    const [hiker] = hikers;

    const booking = {
      bookingDate: multiTableDate,
      slotId: multiTableSlotId,
      partySize: 1,
    };

    const first = await hiker.agent
      .post('/api/bookings')
      .send(booking);

    expect(first.status).toBe(201);

    // Submit the same booking again while seats are still available.
    const second = await hiker.agent
      .post('/api/bookings')
      .send(booking);

    expect(second.status).toBe(409);
    expect(second.body.error.code).toBe('DUPLICATE_BOOKING');

    // Verify that only the first booking was persisted.
    expect(
      await countConfirmedBookings(
        hiker.id,
        multiTableDate,
        multiTableSlotId,
      ),
    ).toBe(1);
  });

  // A past date must be rejected without creating a confirmed booking.
  it('rejects a booking for a past date', async () => {
    const [hiker] = hikers;
    const pastDate = '2000-01-01';

    const response = await hiker.agent
      .post('/api/bookings')
      .send({
        bookingDate: pastDate,
        slotId: multiTableSlotId,
        partySize: 1,
      });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('INVALID_BOOKING');

    expect(
      await countConfirmedBookings(
        hiker.id,
        pastDate,
        multiTableSlotId,
      ),
    ).toBe(0);
  });

  // Booking must close two hours before the meal service starts.
  it('rejects a booking less than two hours before the meal slot starts', async () => {
    // January 4 at 11:00 in Rome: lunch starts in one hour.
    // Simulate Date only so network-related timers continue working normally.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2030-01-04T10:00:00Z'));

    const [hiker] = hikers;

    const account = await getAsync(
      'SELECT email FROM users WHERE id = ?',
      [hiker.id],
    );

    // Create the session after setting the simulated clock.
    const agent = request.agent(app);

    const login = await agent
      .post('/api/sessions')
      .send({
        email: account.email,
        password,
      });

    expect(login.status).toBe(201);

    const response = await agent
      .post('/api/bookings')
      .send({
        bookingDate: soonDate,
        slotId: soonSlotId,
        partySize: 1,
      });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('BOOKING_TOO_LATE');

    // Rejected late bookings must not occupy seats.
    expect(
      await countConfirmedBookings(
        hiker.id,
        soonDate,
        soonSlotId,
      ),
    ).toBe(0);
  });

  // Check the exact deadline boundary down to a single millisecond.
  it.each([
    [
      'just before the deadline',
      '2030-01-04T08:59:59.999Z',
      201,
    ],
    [
      'exactly at the deadline',
      '2030-01-04T09:00:00.000Z',
      201,
    ],
    [
      'just after the deadline',
      '2030-01-04T09:00:00.001Z',
      409,
    ],
  ])(
    'handles booking %s',
    async (_label, instant, expectedStatus) => {
      // Set the clock immediately before, at, or after the booking deadline.
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date(instant));

      const [hiker] = hikers;

      const account = await getAsync(
        'SELECT email FROM users WHERE id = ?',
        [hiker.id],
      );

      // Authenticate after setting the clock to keep the session valid.
      const agent = request.agent(app);

      const login = await agent
        .post('/api/sessions')
        .send({
          email: account.email,
          password,
        });

      expect(login.status).toBe(201);

      const response = await agent
        .post('/api/bookings')
        .send({
          bookingDate: soonDate,
          slotId: soonSlotId,
          partySize: 1,
        });

      // Include the response body in assertion failures for easier diagnosis.
      expect(
        response.status,
        JSON.stringify(response.body),
      ).toBe(expectedStatus);

      if (expectedStatus === 409) {
        expect(response.body.error.code).toBe(
          'BOOKING_TOO_LATE',
        );
      }

      // Only requests accepted before or exactly at the deadline are persisted.
      expect(
        await countConfirmedBookings(
          hiker.id,
          soonDate,
          soonSlotId,
        ),
      ).toBe(expectedStatus === 201 ? 1 : 0);
    },
  );
});