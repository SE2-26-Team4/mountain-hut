import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { getAsync, initializeDatabase, runAsync } from '../../db.js';
import {
  createBooking,
  getBookingById,
  getBookingsByHiker,
  cancelBooking,
} from '../../dao/booking-dao.js';

describe('Booking DAO & Transaction Support (MH-43)', () => {
  let testHikerId;
  let testSlotId;
  let testTableId;

  beforeAll(async () => {
    await initializeDatabase();
  });

  beforeEach(async () => {
    await runAsync('DELETE FROM booking_table_allocations');
    await runAsync('DELETE FROM bookings');
    await runAsync('DELETE FROM users');
    await runAsync('DELETE FROM meal_slots');
    await runAsync('DELETE FROM dining_tables');

    const hikerRes = await runAsync(
      `INSERT INTO users (full_name, email, password_hash, role)
       VALUES ('Mario Rossi', 'mario.test@example.com', 'hash123', 'hiker')`
    );
    testHikerId = hikerRes.lastID;

    const slotRes = await runAsync(
      `INSERT INTO meal_slots (name, start_time, end_time)
       VALUES ('Lunch Slot 1', '12:00', '13:30')`
    );
    testSlotId = slotRes.lastID;

    const tableRes = await runAsync(
      `INSERT INTO dining_tables (name, seat_count)
       VALUES ('Table A', 6)`
    );
    testTableId = tableRes.lastID;
  });

  it('creates a booking with table allocations atomically', async () => {
    const bookingData = {
      hikerId: testHikerId,
      bookingDate: '2026-11-15',
      slotId: testSlotId,
      partySize: 4,
    };
    const allocations = [{ tableId: testTableId, seatsReserved: 4 }];

    const created = await createBooking(bookingData, allocations);

    expect(created.id).toBeDefined();
    expect(created.hikerId).toBe(testHikerId);

    const fetched = await getBookingById(created.id);
    expect(fetched).not.toBeNull();
    expect(fetched.partySize).toBe(4);
    expect(fetched.allocations).toHaveLength(1);
    expect(fetched.allocations[0].tableId).toBe(testTableId);
    expect(fetched.allocations[0].seatsReserved).toBe(4);
  });

  it('rolls back the booking when inserting an allocation fails', async () => {
    const bookingData = {
      hikerId: testHikerId,
      bookingDate: '2026-11-15',
      slotId: testSlotId,
      partySize: 2,
    };

    const invalidAllocations = [{ tableId: 999999, seatsReserved: 2 }];

    await expect(
      createBooking(bookingData, invalidAllocations)
    ).rejects.toThrow();

    const countRes = await getAsync(
      `SELECT COUNT(*) as count FROM bookings WHERE hiker_id = ?`,
      [testHikerId]
    );
    expect(countRes.count).toBe(0);
  });

  it('retrieves bookings for a hiker', async () => {
    await createBooking(
      {
        hikerId: testHikerId,
        bookingDate: '2026-11-20',
        slotId: testSlotId,
        partySize: 2,
      },
      [{ tableId: testTableId, seatsReserved: 2 }]
    );

    const list = await getBookingsByHiker(testHikerId);
    expect(list).toHaveLength(1);
    expect(list[0].bookingDate).toBe('2026-11-20');
  });

  it('cancels a confirmed booking', async () => {
    const created = await createBooking(
      {
        hikerId: testHikerId,
        bookingDate: '2026-11-25',
        slotId: testSlotId,
        partySize: 3,
      },
      [{ tableId: testTableId, seatsReserved: 3 }]
    );

    const cancelled = await cancelBooking(created.id);
    expect(cancelled).toBe(true);

    const fetched = await getBookingById(created.id);
    expect(fetched.status).toBe('cancelled');
  });

  it('returns null for a non-existent booking', async () => {
    const booking = await getBookingById(999999);

    expect(booking).toBeNull();
  });
});
