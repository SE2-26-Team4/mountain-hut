import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest';

import {
  cancelBooking,
  createBooking,
  getBookingById,
  getBookingsByDateAndSlot,
  getBookingsByHiker,
} from '../../dao/booking-dao.js';

import {
  allAsync,
  getAsync,
  initializeDatabase,
  runAsync,
} from '../../db.js';

import { initializeAccounts } from '../../init/init-accounts.js';

// Locate the seeded hiker and use unique names for additional fixtures.
const testEmail = (
  process.env.TEST_HIKER_EMAIL ?? 'hiker@example.com'
).trim().toLowerCase();

const uniqueSuffix = `${Date.now()}-${Math.random()}`;
const bookingDate = '2099-12-30';

// Keep fixture IDs available for booking requests and cleanup.
let hikerId;
let secondHikerId;
let slotId;
let secondSlotId;

const tableIds = [];

// Create two hikers, two consecutive slots, and tables with 4, 6, and 6 seats.
beforeAll(async () => {
  await initializeDatabase();
  await initializeAccounts();

  // Reuse the seeded hiker account.
  const hiker = await getAsync(
    'SELECT id FROM users WHERE email = ?',
    [testEmail]
  );

  if (!hiker) {
    throw new Error(`Test hiker account not found: ${testEmail}`);
  }

  hikerId = hiker.id;

  // Create another hiker for sharing, ownership, and concurrency tests.
  const secondHiker = await runAsync(
    `INSERT INTO users (full_name, email, password_hash, role)
    SELECT ?, ?, password_hash, 'hiker'
    FROM users
    WHERE id = ?`,
    [
      'Second Booking DAO Hiker',
      `booking-dao-second-${uniqueSuffix}@example.com`,
      hikerId,
    ]
  );

  secondHikerId = secondHiker.lastID;

  // Create the primary slot used by most tests.
  const slot = await runAsync(
    `INSERT INTO meal_slots (
      slot_date, name, start_time, end_time
    )
    VALUES (?, ?, '18:00', '20:00')`,
    [bookingDate, `Booking DAO slot ${uniqueSuffix}`]
  );

  slotId = slot.lastID;

  // Create a consecutive slot to verify independent seat availability.
  const secondSlot = await runAsync(
    `INSERT INTO meal_slots (
      slot_date, name, start_time, end_time
    )
    VALUES (?, ?, '20:00', '22:00')`,
    [bookingDate, `Booking DAO second slot ${uniqueSuffix}`]
  );

  secondSlotId = secondSlot.lastID;

  // Insert tables in a known order for allocation and tie-breaking assertions.
  for (const [index, seatCount] of [4, 6, 6].entries()) {
    const table = await runAsync(
      `INSERT INTO dining_tables (name, seat_count)
       VALUES (?, ?)`,
      [`Booking DAO table ${index} ${uniqueSuffix}`, seatCount]
    );

    tableIds.push(table.lastID);
  }
});

// Delete allocations before bookings to respect foreign-key dependencies.
async function clearBookings() {
  await runAsync(
    `DELETE FROM booking_table_allocations
     WHERE booking_id IN (
       SELECT id FROM bookings WHERE slot_id IN (?, ?)
     )`,
    [slotId, secondSlotId]
  );

  await runAsync(
    'DELETE FROM bookings WHERE slot_id IN (?, ?)',
    [slotId, secondSlotId]
  );
}

// Restore a predictable configuration before each test.
beforeEach(async () => {
  await clearBookings();

  // Remove assignments left by previous tests.
  await runAsync(
    'DELETE FROM slot_tables WHERE slot_id IN (?, ?)',
    [slotId, secondSlotId]
  );

  // Reactivate slots and tables that individual tests may have disabled.
  await runAsync(
    'UPDATE meal_slots SET is_active = 1 WHERE id IN (?, ?)',
    [slotId, secondSlotId]
  );

  for (const id of tableIds) {
    await runAsync(
      'UPDATE dining_tables SET is_active = 1 WHERE id = ?',
      [id]
    );
  }

  // By default, only the four-seat table belongs to the first slot.
  await runAsync(
    'INSERT INTO slot_tables (slot_id, table_id) VALUES (?, ?)',
    [slotId, tableIds[0]]
  );
});

// Remove test fixtures while preserving the original seeded hiker.
afterAll(async () => {
  // Ensure the failure trigger is removed even if its test stopped early.
  await runAsync('DROP TRIGGER IF EXISTS fail_booking_allocation_test');

  if (slotId && secondSlotId) {
    await clearBookings();

    await runAsync(
      'DELETE FROM slot_tables WHERE slot_id IN (?, ?)',
      [slotId, secondSlotId]
    );
  }

  // Delete tables after their allocations and assignments have been removed.
  for (const id of tableIds) {
    await runAsync('DELETE FROM dining_tables WHERE id = ?', [id]);
  }

  // Remove the slots and the additional hiker account.
  if (slotId) {
    await runAsync('DELETE FROM meal_slots WHERE id = ?', [slotId]);
  }

  if (secondSlotId) {
    await runAsync('DELETE FROM meal_slots WHERE id = ?', [secondSlotId]);
  }

  if (secondHikerId) {
    await runAsync('DELETE FROM users WHERE id = ?', [secondHikerId]);
  }
});

// Build a standard booking request, allowing each test to choose party size.
function input(partySize = 3) {
  return {
    hikerId,
    bookingDate,
    slotId,
    partySize,
  };
}

// Add the two six-seat tables to the primary slot's default assignment.
async function assignAllTables() {
  for (const id of tableIds.slice(1)) {
    await runAsync(
      'INSERT INTO slot_tables (slot_id, table_id) VALUES (?, ?)',
      [slotId, id]
    );
  }
}

describe('booking data access', () => {
  // Verify persistence and all supported booking retrieval methods.
  it('saves and retrieves a booking with its allocation', async () => {
    const saved = await createBooking(input());

    expect(saved).toMatchObject({
      ...input(),
      status: 'confirmed',
      allocations: [
        { tableId: tableIds[0], seatsReserved: 3 },
      ],
    });

    // Reading by ID must return the complete saved booking.
    expect(await getBookingById(saved.id)).toEqual(saved);

    // Reading by date and slot must include its allocations.
    const bookings = await getBookingsByDateAndSlot(
      bookingDate,
      slotId
    );

    expect(bookings).toHaveLength(1);
    expect(bookings[0]).toEqual(saved);

    // The booking must also appear in the owner's booking list.
    const hikerBookings = await getBookingsByHiker(hikerId);

    expect(hikerBookings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: saved.id }),
      ])
    );
  });

  // A lookup for a nonexistent booking returns null.
  it('returns null for a missing booking', async () => {
    expect(
      await getBookingById(Number.MAX_SAFE_INTEGER)
    ).toBeNull();
  });

  // Prefer the smallest sufficient table when the whole party fits together.
  it('chooses the smallest single table that fits the party', async () => {
    await assignAllTables();

    const saved = await createBooking(input(3));

    expect(saved.allocations).toEqual([
      { tableId: tableIds[0], seatsReserved: 3 },
    ]);
  });

  // Equal suitable capacities are resolved using the lowest table ID.
  it('uses the lowest table ID when suitable capacities are equal', async () => {
    await assignAllTables();

    const saved = await createBooking(input(5));

    expect(saved.allocations).toEqual([
      {
        tableId: Math.min(tableIds[1], tableIds[2]),
        seatsReserved: 5,
      },
    ]);
  });

  // Split a party using two tables with the smallest sufficient total capacity.
  it('splits a large party across free tables', async () => {
    await assignAllTables();

    const saved = await createBooking(input(8));

    // Choose capacities 6 + 4 rather than 6 + 6, reserving only eight seats.
    expect(saved.allocations).toEqual([
      { tableId: tableIds[1], seatsReserved: 6 },
      { tableId: tableIds[0], seatsReserved: 2 },
    ]);

    expect(
      saved.allocations.reduce(
        (total, allocation) => total + allocation.seatsReserved,
        0
      )
    ).toBe(8);
  });

  // Different hikers can reserve remaining seats at the same table.
  it('shares a table between different parties', async () => {
    const first = await createBooking(input(1));

    const second = await createBooking({
      ...input(1),
      hikerId: secondHikerId,
    });

    expect(first.allocations).toEqual([
      { tableId: tableIds[0], seatsReserved: 1 },
    ]);

    expect(second.allocations).toEqual([
      { tableId: tableIds[0], seatsReserved: 1 },
    ]);

    const bookings = await getBookingsByDateAndSlot(
      bookingDate,
      slotId
    );

    expect(bookings).toHaveLength(2);
  });

  // Insufficient capacity must leave no saved booking.
  it('rejects insufficient capacity without saving a booking', async () => {
    await expect(
      createBooking(input(5))
    ).rejects.toMatchObject({ code: 'NO_AVAILABILITY' });

    const bookings = await getBookingsByDateAndSlot(
      bookingDate,
      slotId
    );

    expect(bookings).toHaveLength(0);
  });

  // Only active tables assigned to the selected slot provide bookable seats.
  it('ignores inactive tables and tables not assigned to the slot', async () => {
    await runAsync(
      'UPDATE dining_tables SET is_active = 0 WHERE id = ?',
      [tableIds[0]]
    );

    // The other active tables exist but are not assigned to this slot.
    await expect(
      createBooking(input(1))
    ).rejects.toMatchObject({ code: 'NO_AVAILABILITY' });
  });

  // Reject a slot ID that does not exist.
  it('rejects a missing slot', async () => {
    await expect(
      createBooking({
        ...input(),
        slotId: Number.MAX_SAFE_INTEGER,
      })
    ).rejects.toMatchObject({ code: 'SLOT_NOT_FOUND' });
  });

  // Reject a slot that has been deactivated.
  it('rejects an inactive slot', async () => {
    await runAsync(
      'UPDATE meal_slots SET is_active = 0 WHERE id = ?',
      [slotId]
    );

    await expect(
      createBooking(input())
    ).rejects.toMatchObject({ code: 'SLOT_INACTIVE' });
  });

  // Reject zero, negative, fractional, and string party sizes.
  it.each([0, -1, 2.5, '3'])(
    'rejects invalid party size %s',
    async (partySize) => {
      await expect(
        createBooking(input(partySize))
      ).rejects.toMatchObject({ code: 'INVALID_PARTY_SIZE' });
    }
  );

  // Cancellation releases seats and permits a new booking for the same slot.
  it('makes tables available again after cancellation', async () => {
    const first = await createBooking(input(1));

    // Only the first cancellation changes the booking status.
    expect(await cancelBooking(first.id)).toBe(true);
    expect(await cancelBooking(first.id)).toBe(false);

    expect(await getBookingById(first.id)).toMatchObject({
      status: 'cancelled',
    });

    expect(
      await getBookingsByDateAndSlot(bookingDate, slotId)
    ).toHaveLength(0);

    // All four seats must be available again after cancellation.
    const second = await createBooking(input(4));

    expect(second.status).toBe('confirmed');
    expect(second.allocations).toEqual([
      { tableId: tableIds[0], seatsReserved: 4 },
    ]);
  });

  // An ownership restriction must prevent another user from cancelling.
  it('cancels a booking only for its owner', async () => {
    const saved = await createBooking(input(1));

    expect(
      await cancelBooking(saved.id, Number.MAX_SAFE_INTEGER)
    ).toBe(false);

    expect(await getBookingById(saved.id)).toMatchObject({
      status: 'confirmed',
    });

    // The actual owner can cancel the same booking.
    expect(await cancelBooking(saved.id, hikerId)).toBe(true);

    expect(await getBookingById(saved.id)).toMatchObject({
      status: 'cancelled',
    });
  });

  // Seat occupancy is independent across different dates and slots.
  it('allows the same table on another date or another slot', async () => {
    let nextDaySlotId;

    try {
      // Fully occupy the table in the primary slot.
      await createBooking(input(4));

      // Create a slot on the following day using the same table.
      const nextDaySlot = await runAsync(
        `INSERT INTO meal_slots (
          slot_date, name, start_time, end_time
        )
        VALUES (?, ?, '18:00', '20:00')`,
        [
          '2099-12-31',
          `Booking DAO next-day slot ${uniqueSuffix}`,
        ]
      );

      nextDaySlotId = nextDaySlot.lastID;

      await runAsync(
        'INSERT INTO slot_tables (slot_id, table_id) VALUES (?, ?)',
        [nextDaySlotId, tableIds[0]]
      );

      const anotherDate = await createBooking({
        ...input(4),
        bookingDate: '2099-12-31',
        slotId: nextDaySlotId,
      });

      // Also assign the table to the consecutive slot on the original date.
      await runAsync(
        'INSERT INTO slot_tables (slot_id, table_id) VALUES (?, ?)',
        [secondSlotId, tableIds[0]]
      );

      const anotherSlot = await createBooking({
        ...input(4),
        slotId: secondSlotId,
      });

      // Both independent services must still offer all four table seats.
      expect(anotherDate.allocations).toEqual([
        { tableId: tableIds[0], seatsReserved: 4 },
      ]);

      expect(anotherSlot.allocations).toEqual([
        { tableId: tableIds[0], seatsReserved: 4 },
      ]);
    } finally {
      // Remove the extra next-day fixture even if an assertion fails.
      if (nextDaySlotId) {
        await runAsync(
          `DELETE FROM booking_table_allocations
          WHERE booking_id IN (
            SELECT id FROM bookings WHERE slot_id = ?
          )`,
          [nextDaySlotId]
        );

        await runAsync(
          'DELETE FROM bookings WHERE slot_id = ?',
          [nextDaySlotId]
        );

        await runAsync(
          'DELETE FROM slot_tables WHERE slot_id = ?',
          [nextDaySlotId]
        );

        await runAsync(
          'DELETE FROM meal_slots WHERE id = ?',
          [nextDaySlotId]
        );
      }
    }
  });

  // Concurrent requests must not reserve more seats than the table provides.
  it('prevents concurrent parties from exceeding table capacity', async () => {
    // Both parties request three seats from a table with only four seats.
    const results = await Promise.allSettled([
      createBooking(input(3)),
      createBooking({
        ...input(3),
        hikerId: secondHikerId,
      }),
    ]);

    expect(
      results.filter((result) => result.status === 'fulfilled')
    ).toHaveLength(1);

    const rejected = results.filter(
      (result) => result.status === 'rejected'
    );

    expect(rejected).toHaveLength(1);

    // The unsuccessful request must report insufficient availability.
    for (const result of rejected) {
      if (result.status === 'rejected') {
        expect(result.reason).toMatchObject({
          code: 'NO_AVAILABILITY',
        });
      }
    }

    expect(
      await getBookingsByDateAndSlot(bookingDate, slotId)
    ).toHaveLength(1);
  });

  // Allocation insertion failure must roll back the booking itself.
  it('rolls back the booking when allocation insertion fails', async () => {
    // Force SQLite to abort every allocation insertion during this test.
    await runAsync(`
      CREATE TEMP TRIGGER fail_booking_allocation_test
      BEFORE INSERT ON booking_table_allocations
      BEGIN
        SELECT RAISE(ABORT, 'Forced allocation failure');
      END
    `);

    try {
      await expect(
        createBooking(input())
      ).rejects.toThrow('Forced allocation failure');

      // The booking inserted before the failed allocation must be rolled back.
      const bookings = await allAsync(
        'SELECT id FROM bookings WHERE slot_id = ?',
        [slotId]
      );

      expect(bookings).toHaveLength(0);
    } finally {
      // Remove the trigger before attempting another transaction.
      await runAsync(
        'DROP TRIGGER IF EXISTS fail_booking_allocation_test'
      );
    }

    // A failed transaction must not block the transaction queue.
    const saved = await createBooking(input());

    expect(saved.status).toBe('confirmed');
  });

  // A date/slot mismatch must not create booking or allocation records.
  it('rejects a booking date different from the slot date without saving it', async () => {
    await expect(
      createBooking({
        ...input(2),
        bookingDate: '2099-12-31',
      }),
    ).rejects.toMatchObject({
      code: 'INVALID_BOOKING',
      message:
        'The selected meal slot does not belong to the booking date.',
    });

    const savedBookings = await allAsync(
      'SELECT id FROM bookings WHERE slot_id = ?',
      [slotId]
    );

    expect(savedBookings).toHaveLength(0);

    // Check that no allocations exist through bookings for this slot.
    const allocations = await allAsync(
      `SELECT a.booking_id
      FROM booking_table_allocations AS a
      JOIN bookings AS b ON b.id = a.booking_id
      WHERE b.slot_id = ?`,
      [slotId]
    );

    expect(allocations).toHaveLength(0);
  });
});