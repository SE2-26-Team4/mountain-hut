import { randomUUID } from 'node:crypto';

import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import app from '../../app.js';
import { initializeDatabase, runAsync } from '../../db.js';
import { initializeAccounts } from '../../init/init-accounts.js';
import { hashPassword } from '../../services/password.js';

const password = 'BookingApiTest123!';
const email = `booking-api-${randomUUID()}@example.com`;
const bookingDate = '2099-12-31';
const uniqueSuffix = randomUUID();

let hikerId;
let slotId;
let tableId;
let hikerAgent;

beforeAll(async () => {
  await initializeDatabase();
  await initializeAccounts();

  const passwordHash = await hashPassword(password);
  const user = await runAsync(
    `INSERT INTO users (full_name, email, password_hash, role)
     VALUES (?, ?, ?, 'hiker')`,
    ['Booking API Hiker', email, passwordHash],
  );
  hikerId = user.lastID;

  const slot = await runAsync(
    `INSERT INTO meal_slots (name, start_time, end_time)
     VALUES (?, '18:00', '20:00')`,
    [`Booking API slot ${uniqueSuffix}`],
  );
  slotId = slot.lastID;

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
});

afterAll(async () => {
  await runAsync(
    `DELETE FROM booking_table_allocations
     WHERE booking_id IN (SELECT id FROM bookings WHERE slot_id = ?)`,
    [slotId],
  );
  await runAsync('DELETE FROM bookings WHERE slot_id = ?', [slotId]);
  await runAsync('DELETE FROM slot_tables WHERE slot_id = ?', [slotId]);
  await runAsync('DELETE FROM dining_tables WHERE id = ?', [tableId]);
  await runAsync('DELETE FROM meal_slots WHERE id = ?', [slotId]);
  await runAsync('DELETE FROM users WHERE id = ?', [hikerId]);
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
    [{ bookingDate: 'not-a-date', slotId }, 'INVALID_BOOKING'],
    [{ bookingDate, slotId: 'invalid' }, 'INVALID_BOOKING'],
    [{ bookingDate }, 'INVALID_BOOKING'],
  ])('rejects invalid availability parameters', async (query, code) => {
    const response = await request(app)
      .get('/api/bookings/availability')
      .query(query);

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe(code);
  });

  it('returns 404 for an unknown meal slot', async () => {
    const response = await request(app)
      .get('/api/bookings/availability')
      .query({ bookingDate, slotId: 999999 });

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('MEAL_SLOT_NOT_FOUND');
  });
});

describe('booking management API', () => {
  it('requires authentication to create a booking', async () => {
    const createResponse = await request(app)
      .post('/api/bookings')
      .send({ bookingDate, slotId, partySize: 1 });

    expect(createResponse.status).toBe(401);
    expect(createResponse.body.error.code).toBe('UNAUTHENTICATED');
  });

  it.each([
    [{ bookingDate: 'invalid', slotId: 1, partySize: 1 }, 'INVALID_BOOKING'],
    [{ bookingDate, slotId: 1, partySize: 0 }, 'INVALID_PARTY_SIZE'],
    [{ bookingDate, slotId: 1, partySize: 1.5 }, 'INVALID_PARTY_SIZE'],
  ])('rejects invalid booking data', async (body, code) => {
    const response = await hikerAgent.post('/api/bookings').send(body);

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe(code);
  });

  it('creates a booking', async () => {
    const createResponse = await hikerAgent.post('/api/bookings').send({
      bookingDate,
      slotId,
      partySize: 2,
    });

    expect(createResponse.status).toBe(201);
    expect(createResponse.body.booking).toMatchObject({
      hikerId,
      bookingDate,
      slotId,
      partySize: 2,
      status: 'confirmed',
      allocations: [{ tableId, seatsReserved: 2 }],
    });

    const unavailableResponse = await request(app)
      .get('/api/bookings/availability')
      .query({ bookingDate, slotId });

    expect(unavailableResponse.body.availability.totalAvailableSeats).toBe(
      0,
    );
  });

  it('rejects a booking when there is not enough availability', async () => {
    const response = await hikerAgent.post('/api/bookings').send({
      bookingDate: '2100-01-01',
      slotId,
      partySize: 5,
    });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('NO_AVAILABILITY');
  });
});
