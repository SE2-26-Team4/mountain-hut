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

const testEmail = (
  process.env.TEST_HIKER_EMAIL ?? 'hiker@example.com'
).trim().toLowerCase();

const uniqueSuffix = `${Date.now()}-${Math.random()}`;
const bookingDate = '2099-12-30';

let hikerId;
let slotId;
let secondSlotId;

const tableIds = [];

beforeAll(async () => {
  await initializeDatabase();
  await initializeAccounts();

  const hiker = await getAsync(
    'SELECT id FROM users WHERE email = ?',
    [testEmail]
  );

  if (!hiker) {
    throw new Error(`Test hiker account not found: ${testEmail}`);
  }

  hikerId = hiker.id;

  const slot = await runAsync(
    `INSERT INTO meal_slots (name, start_time, end_time)
     VALUES (?, '18:00', '20:00')`,
    [`Booking DAO slot ${uniqueSuffix}`]
  );

  slotId = slot.lastID;

  const secondSlot = await runAsync(
    `INSERT INTO meal_slots (name, start_time, end_time)
     VALUES (?, '20:00', '22:00')`,
    [`Booking DAO second slot ${uniqueSuffix}`]
  );

  secondSlotId = secondSlot.lastID;

  for (const [index, seatCount] of [4, 6, 6].entries()) {
    const table = await runAsync(
      `INSERT INTO dining_tables (name, seat_count)
       VALUES (?, ?)`,
      [`Booking DAO table ${index} ${uniqueSuffix}`, seatCount]
    );

    tableIds.push(table.lastID);
  }
});

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

beforeEach(async () => {
  await clearBookings();

  await runAsync(
    'DELETE FROM slot_tables WHERE slot_id IN (?, ?)',
    [slotId, secondSlotId]
  );

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

afterAll(async () => {
  await runAsync('DROP TRIGGER IF EXISTS fail_booking_allocation_test');

  if (slotId && secondSlotId) {
    await clearBookings();

    await runAsync(
      'DELETE FROM slot_tables WHERE slot_id IN (?, ?)',
      [slotId, secondSlotId]
    );
  }

  for (const id of tableIds) {
    await runAsync('DELETE FROM dining_tables WHERE id = ?', [id]);
  }

  if (slotId) {
    await runAsync('DELETE FROM meal_slots WHERE id = ?', [slotId]);
  }

  if (secondSlotId) {
    await runAsync('DELETE FROM meal_slots WHERE id = ?', [secondSlotId]);
  }
});

function input(partySize = 3) {
  return {
    hikerId,
    bookingDate,
    slotId,
    partySize,
  };
}

async function assignAllTables() {
  for (const id of tableIds.slice(1)) {
    await runAsync(
      'INSERT INTO slot_tables (slot_id, table_id) VALUES (?, ?)',
      [slotId, id]
    );
  }
}

describe('booking data access', () => {
  it('saves and retrieves a booking with its allocation', async () => {
    const saved = await createBooking(input());

    expect(saved).toMatchObject({
      ...input(),
      status: 'confirmed',
      allocations: [
        { tableId: tableIds[0], seatsReserved: 3 },
      ],
    });

    expect(await getBookingById(saved.id)).toEqual(saved);

    const bookings = await getBookingsByDateAndSlot(
      bookingDate,
      slotId
    );

    expect(bookings).toHaveLength(1);
    expect(bookings[0]).toEqual(saved);

    const hikerBookings = await getBookingsByHiker(hikerId);

    expect(hikerBookings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: saved.id }),
      ])
    );
  });

  it('returns null for a missing booking', async () => {
    expect(
      await getBookingById(Number.MAX_SAFE_INTEGER)
    ).toBeNull();
  });

  it('chooses the smallest single table that fits the party', async () => {
    await assignAllTables();

    const saved = await createBooking(input(3));

    expect(saved.allocations).toEqual([
      { tableId: tableIds[0], seatsReserved: 3 },
    ]);
  });

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

  it('splits a large party across free tables', async () => {
    await assignAllTables();

    const saved = await createBooking(input(8));

    expect(saved.allocations).toEqual([
      { tableId: tableIds[1], seatsReserved: 6 },
      { tableId: tableIds[2], seatsReserved: 2 },
    ]);

    expect(
      saved.allocations.reduce(
        (total, allocation) => total + allocation.seatsReserved,
        0
      )
    ).toBe(8);
  });

  it('does not share an assigned table with another party', async () => {
    await createBooking(input(1));

    await expect(
      createBooking(input(1))
    ).rejects.toMatchObject({ code: 'NO_AVAILABILITY' });

    const bookings = await getBookingsByDateAndSlot(
      bookingDate,
      slotId
    );

    expect(bookings).toHaveLength(1);
  });

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

  it('rejects a missing slot', async () => {
    await expect(
      createBooking({
        ...input(),
        slotId: Number.MAX_SAFE_INTEGER,
      })
    ).rejects.toMatchObject({ code: 'SLOT_NOT_FOUND' });
  });

  it('rejects an inactive slot', async () => {
    await runAsync(
      'UPDATE meal_slots SET is_active = 0 WHERE id = ?',
      [slotId]
    );

    await expect(
      createBooking(input())
    ).rejects.toMatchObject({ code: 'SLOT_INACTIVE' });
  });

  it.each([0, -1, 2.5, '3'])(
    'rejects invalid party size %s',
    async (partySize) => {
      await expect(
        createBooking(input(partySize))
      ).rejects.toMatchObject({ code: 'INVALID_PARTY_SIZE' });
    }
  );

  it('makes tables available again after cancellation', async () => {
    const first = await createBooking(input(1));

    expect(await cancelBooking(first.id)).toBe(true);
    expect(await cancelBooking(first.id)).toBe(false);

    expect(await getBookingById(first.id)).toMatchObject({
      status: 'cancelled',
    });

    expect(
      await getBookingsByDateAndSlot(bookingDate, slotId)
    ).toHaveLength(0);

    const second = await createBooking(input(4));

    expect(second.status).toBe('confirmed');
    expect(second.allocations).toEqual([
      { tableId: tableIds[0], seatsReserved: 4 },
    ]);
  });

  it('allows the same table on another date or another slot', async () => {
    await createBooking(input(4));

    const anotherDate = await createBooking({
      ...input(4),
      bookingDate: '2099-12-31',
    });

    await runAsync(
      'INSERT INTO slot_tables (slot_id, table_id) VALUES (?, ?)',
      [secondSlotId, tableIds[0]]
    );

    const anotherSlot = await createBooking({
      ...input(4),
      slotId: secondSlotId,
    });

    expect(anotherDate.allocations[0].tableId).toBe(tableIds[0]);
    expect(anotherSlot.allocations[0].tableId).toBe(tableIds[0]);
  });

  it('allows only one concurrent booking for the last free table', async () => {
    const results = await Promise.allSettled([
      createBooking(input(2)),
      createBooking(input(2)),
    ]);

    expect(
      results.filter((result) => result.status === 'fulfilled')
    ).toHaveLength(1);

    const rejected = results.filter(
      (result) => result.status === 'rejected'
    );

    expect(rejected).toHaveLength(1);

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

  it('rolls back the booking when allocation insertion fails', async () => {
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

      const bookings = await allAsync(
        'SELECT id FROM bookings WHERE slot_id = ?',
        [slotId]
      );

      expect(bookings).toHaveLength(0);
    } finally {
      await runAsync(
        'DROP TRIGGER IF EXISTS fail_booking_allocation_test'
      );
    }

    // A failed transaction must not block the transaction queue.
    const saved = await createBooking(input());
    expect(saved.status).toBe('confirmed');
  });
});