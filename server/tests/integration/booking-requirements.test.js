// These tests describe the expected behavior and fail until the rules
// are implemented.
// (follow clarifications on MH-01 story)

import { randomUUID } from 'node:crypto';

import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import app from '../../app.js';
import { getAsync, initializeDatabase, runAsync } from '../../db.js';
import { initializeAccounts } from '../../init/init-accounts.js';
import { hashPassword } from '../../services/password.js';

const password = 'BookingRulesTest123!';
const uniqueSuffix = randomUUID();

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
let soonBookingDate;

/**
 * @param {number} value
 * @returns {string}
 */
function pad(value) {
  return String(value).padStart(2, '0');
}

/**
 * @param {Date} date
 * @returns {string} Local date in YYYY-MM-DD format.
 */
function toLocalDate(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * @param {Date} date
 * @returns {string} Local time in HH:MM format.
 */
function toLocalTime(date) {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/**
 * Creates an active meal slot with new tables of the given sizes.
 *
 * @param {string} startTime
 * @param {string} endTime
 * @param {number[]} seatCounts
 * @returns {Promise<{ slotId: number, slotTableIds: number[] }>}
 */
async function createSlotWithTables(startTime, endTime, seatCounts) {
  const slot = await runAsync(
    `INSERT INTO meal_slots (name, start_time, end_time)
     VALUES (?, ?, ?)`,
    [`Booking rules slot ${slotIds.length} ${uniqueSuffix}`, startTime, endTime],
  );
  slotIds.push(slot.lastID);

  const slotTableIds = [];

  for (const seatCount of seatCounts) {
    const table = await runAsync(
      `INSERT INTO dining_tables (name, seat_count)
       VALUES (?, ?)`,
      [`Booking rules table ${tableIds.length} ${uniqueSuffix}`, seatCount],
    );
    tableIds.push(table.lastID);
    slotTableIds.push(table.lastID);

    await runAsync(
      'INSERT INTO slot_tables (slot_id, table_id) VALUES (?, ?)',
      [slot.lastID, table.lastID],
    );
  }

  return { slotId: slot.lastID, slotTableIds };
}

/**
 * @param {number} hikerId
 * @param {string} bookingDate
 * @param {number} slotId
 * @returns {Promise<number>}
 */
async function countConfirmedBookings(hikerId, bookingDate, slotId) {
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

beforeAll(async () => {
  await initializeDatabase();
  await initializeAccounts();

  const passwordHash = await hashPassword(password);

  for (const index of [1, 2]) {
    const email = `booking-rules-${index}-${uniqueSuffix}@example.com`;
    const user = await runAsync(
      `INSERT INTO users (full_name, email, password_hash, role)
       VALUES (?, ?, ?, 'hiker')`,
      [`Booking Rules Hiker ${index}`, email, passwordHash],
    );

    const agent = request.agent(app);
    const loginResponse = await agent
      .post('/api/sessions')
      .send({ email, password });

    expect(loginResponse.status).toBe(201);
    hikers.push({ id: user.lastID, agent });
  }

  const shared = await createSlotWithTables('12:00', '14:00', [4]);
  sharedSlotId = shared.slotId;
  [sharedTableId] = shared.slotTableIds;

  const multiTable = await createSlotWithTables('19:00', '21:00', [4, 4]);
  multiTableSlotId = multiTable.slotId;

  // A slot starting one hour from now, in local time.
  const soonStart = new Date(Date.now() + 60 * 60 * 1000);
  const soonEnd = new Date(soonStart.getTime() + 60 * 60 * 1000);
  soonBookingDate = toLocalDate(soonStart);

  const soon = await createSlotWithTables(
    toLocalTime(soonStart),
    toLocalTime(soonEnd),
    [4],
  );
  soonSlotId = soon.slotId;
});

afterAll(async () => {
  for (const slotId of slotIds) {
    await runAsync(
      `DELETE FROM booking_table_allocations
       WHERE booking_id IN (SELECT id FROM bookings WHERE slot_id = ?)`,
      [slotId],
    );
    await runAsync('DELETE FROM bookings WHERE slot_id = ?', [slotId]);
    await runAsync('DELETE FROM slot_tables WHERE slot_id = ?', [slotId]);
    await runAsync('DELETE FROM meal_slots WHERE id = ?', [slotId]);
  }

  for (const tableId of tableIds) {
    await runAsync('DELETE FROM dining_tables WHERE id = ?', [tableId]);
  }

  for (const { id } of hikers) {
    await runAsync('DELETE FROM users WHERE id = ?', [id]);
  }
});

describe('MH-01 table sharing', () => {
  it('counts the free seats of a partially occupied table as available', async () => {
    const bookingDate = '2099-10-01';

    const first = await hikers[0].agent.post('/api/bookings').send({
      bookingDate,
      slotId: sharedSlotId,
      partySize: 2,
    });

    expect(first.status).toBe(201);

    const response = await request(app)
      .get('/api/bookings/availability')
      .query({ bookingDate, slotId: sharedSlotId });

    expect(response.status).toBe(200);
    expect(
      response.body.availability.totalAvailableSeats,
      'MH-01: sharing is the standard rule, so 2 of 4 seats stay available',
    ).toBe(2);
  });

  it('seats another party at a partially occupied table', async () => {
    const bookingDate = '2099-10-02';

    const first = await hikers[0].agent.post('/api/bookings').send({
      bookingDate,
      slotId: sharedSlotId,
      partySize: 2,
    });

    expect(first.status).toBe(201);

    const response = await hikers[1].agent.post('/api/bookings').send({
      bookingDate,
      slotId: sharedSlotId,
      partySize: 2,
    });

    expect(
      response.status,
      'MH-01: a party may share a table with other parties',
    ).toBe(201);
    expect(response.body.booking.allocations).toEqual([
      { tableId: sharedTableId, seatsReserved: 2 },
    ]);
  });
});

describe('MH-01 booking constraints', () => {
  it('rejects a second booking by the same hiker for the same date and slot', async () => {
    const [hiker] = hikers;
    const bookingDate = '2099-10-03';
    const booking = { bookingDate, slotId: multiTableSlotId, partySize: 1 };

    const first = await hiker.agent.post('/api/bookings').send(booking);

    expect(first.status).toBe(201);

    // A second free table exists, so capacity alone does not reject it.
    const second = await hiker.agent.post('/api/bookings').send(booking);

    expect(
      second.status,
      'MH-01: only one booking per time slot on a date',
    ).toBe(409);
    expect(
      await countConfirmedBookings(hiker.id, bookingDate, multiTableSlotId),
    ).toBe(1);
  });

  it('rejects a booking for a past date', async () => {
    const [hiker] = hikers;
    const bookingDate = '2000-01-01';

    const response = await hiker.agent.post('/api/bookings').send({
      bookingDate,
      slotId: multiTableSlotId,
      partySize: 1,
    });

    expect(
      [400, 409],
      'MH-01: a past date/time combination is not available',
    ).toContain(response.status);
    expect(
      await countConfirmedBookings(hiker.id, bookingDate, multiTableSlotId),
    ).toBe(0);
  });

  it('rejects a booking less than two hours before the meal slot starts', async () => {
    const [hiker] = hikers;

    const response = await hiker.agent.post('/api/bookings').send({
      bookingDate: soonBookingDate,
      slotId: soonSlotId,
      partySize: 1,
    });

    expect(
      [400, 409],
      'MH-01: a hiker can book only up to 2 hours before the due time',
    ).toContain(response.status);
    expect(
      await countConfirmedBookings(hiker.id, soonBookingDate, soonSlotId),
    ).toBe(0);
  });
});
