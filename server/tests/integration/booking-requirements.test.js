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

const password = 'BookingRulesTest123!';
const uniqueSuffix = randomUUID();

const sharedDate = '2099-10-01';
const multiTableDate = '2099-10-03';
const soonDate = '2030-01-04';

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

async function clearBookings() {
  for (const slotId of slotIds) {
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

beforeAll(async () => {
  await initializeDatabase();
  await initializeAccounts();

  const passwordHash = await hashPassword(password);

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

  const shared = await createSlotWithTables(
    sharedDate,
    '12:00',
    '14:00',
    [4],
  );

  sharedSlotId = shared.slotId;
  [sharedTableId] = shared.slotTableIds;

  const multiTable = await createSlotWithTables(
    multiTableDate,
    '19:00',
    '21:00',
    [4, 4],
  );

  multiTableSlotId = multiTable.slotId;

  const soon = await createSlotWithTables(
    soonDate,
    '12:00',
    '14:00',
    [4],
  );

  soonSlotId = soon.slotId;
});

beforeEach(async () => {
  await clearBookings();
});

afterEach(() => {
  vi.useRealTimers();
});

afterAll(async () => {
  await clearBookings();

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

  for (const { id } of hikers) {
    await runAsync(
      'DELETE FROM users WHERE id = ?',
      [id],
    );
  }
});

describe('MH-01 table sharing', () => {
  it('counts the free seats of a partially occupied table as available', async () => {
    const first = await hikers[0].agent
      .post('/api/bookings')
      .send({
        bookingDate: sharedDate,
        slotId: sharedSlotId,
        partySize: 2,
      });

    expect(first.status).toBe(201);

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

    expect(second.body.booking.allocations).toEqual([
      {
        tableId: sharedTableId,
        seatsReserved: 2,
      },
    ]);
  });
});

describe('MH-01 booking constraints', () => {
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

    const second = await hiker.agent
      .post('/api/bookings')
      .send(booking);

    expect(second.status).toBe(409);
    expect(second.body.error.code).toBe('DUPLICATE_BOOKING');

    expect(
      await countConfirmedBookings(
        hiker.id,
        multiTableDate,
        multiTableSlotId,
      ),
    ).toBe(1);
  });

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

  it('rejects a booking less than two hours before the meal slot starts', async () => {
  // January 4, 11:00 in Rome: lunch starts in one hour.
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

  expect(
    await countConfirmedBookings(
      hiker.id,
      soonDate,
      soonSlotId,
    ),
  ).toBe(0);
});

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
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(instant));

    const [hiker] = hikers;

    const account = await getAsync(
      'SELECT email FROM users WHERE id = ?',
      [hiker.id],
    );

    // Authenticate after setting the simulated clock.
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

    expect(
      response.status,
      JSON.stringify(response.body),
    ).toBe(expectedStatus);

    if (expectedStatus === 409) {
      expect(response.body.error.code).toBe(
        'BOOKING_TOO_LATE',
      );
    }

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