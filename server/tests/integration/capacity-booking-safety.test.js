import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import {
  CapacityConflictError,
  createDiningTable,
  createMealSlot,
  getDiningTables,
  getMealSlotCapacity,
  setMealSlotTables,
  updateDiningTable,
  getMealSlots,
  updateMealSlot,
} from '../../dao/capacity-dao.js';

import {
  initializeDatabase,
  runAsync,
} from '../../db.js';

let userId;
let slot;
let table;
let spareTable;

const bookingIds = [];
const additionalSlots = new Map();

beforeAll(async () => {
  await initializeDatabase();
});

beforeEach(async () => {
  // Mock only Date, leaving database timers unaffected.
  vi.useFakeTimers({ toFake: ['Date'] });

  // In Rome it is January 2, while in UTC it is still January 1.
  vi.setSystemTime(new Date('2030-01-01T23:30:00Z'));

  const suffix = Math.random().toString(36).slice(2);

  const user = await runAsync(
    `INSERT INTO users (
       full_name, email, password_hash, role
     )
     VALUES (?, ?, ?, ?)`,
    [
      'Capacity safety test',
      `capacity-safety-${suffix}@example.org`,
      'unused-test-hash',
      'hiker',
    ],
  );

  userId = user.lastID;

  slot = await createMealSlot({
    slotDate: '2030-01-03',
    name: `Safety slot ${suffix}`,
    startTime: '12:00',
    endTime: '13:00',
  });

  table = await createDiningTable({
    name: `Booked table ${suffix}`,
    seatCount: 8,
  });

  spareTable = await createDiningTable({
    name: `Spare table ${suffix}`,
    seatCount: 4,
  });

  await setMealSlotTables(
    slot.id,
    [table.id, spareTable.id],
  );
});

afterEach(async () => {
  vi.useRealTimers();

  // Delete only the records created by these tests.
  for (const bookingId of bookingIds.splice(0)) {
    await runAsync(
      'DELETE FROM booking_table_allocations WHERE booking_id = ?',
      [bookingId],
    );

    await runAsync(
      'DELETE FROM bookings WHERE id = ?',
      [bookingId],
    );
  }

  for (const additionalSlot of additionalSlots.values()) {
    await runAsync(
        'DELETE FROM slot_tables WHERE slot_id = ?',
        [additionalSlot.id],
    );

    await runAsync(
        'DELETE FROM meal_slots WHERE id = ?',
        [additionalSlot.id],
    );
    }

    additionalSlots.clear();

  if (slot) {
    await runAsync(
      'DELETE FROM slot_tables WHERE slot_id = ?',
      [slot.id],
    );

    await runAsync(
      'DELETE FROM meal_slots WHERE id = ?',
      [slot.id],
    );
  }

  for (const diningTable of [table, spareTable]) {
    if (diningTable) {
      await runAsync(
        'DELETE FROM dining_tables WHERE id = ?',
        [diningTable.id],
      );
    }
  }

  if (userId) {
    await runAsync(
      'DELETE FROM users WHERE id = ?',
      [userId],
    );
  }

  userId = undefined;
  slot = undefined;
  table = undefined;
  spareTable = undefined;
});

/**
 * Inserts a booking and its allocation directly to isolate
 * capacity checks from booking validation and email delivery.
 */
async function addBooking(
  seats,
  bookingDate = '2030-01-03',
  status = 'confirmed',
) {
  let bookingSlot = slot;

  if (bookingDate !== slot.slotDate) {
    bookingSlot = additionalSlots.get(bookingDate);

    if (!bookingSlot) {
      bookingSlot = await createMealSlot({
        slotDate: bookingDate,
        name: slot.name,
        startTime: slot.startTime,
        endTime: slot.endTime,
      });

      additionalSlots.set(bookingDate, bookingSlot);

      await setMealSlotTables(
        bookingSlot.id,
        [table.id],
      );
    }
  }

  const booking = await runAsync(
    `INSERT INTO bookings (
       hiker_id, booking_date, slot_id, party_size, status
     )
     VALUES (?, ?, ?, ?, ?)`,
    [userId, bookingDate, bookingSlot.id, seats, status],
  );

  bookingIds.push(booking.lastID);

  await runAsync(
    `INSERT INTO booking_table_allocations (
       booking_id, table_id, seats_reserved
     )
     VALUES (?, ?, ?)`,
    [booking.lastID, table.id, seats],
  );
}

function changeTable(seatCount, isActive = true) {
  return updateDiningTable(table.id, {
    name: table.name,
    seatCount,
    isActive,
  });
}

describe('capacity changes preserve confirmed bookings', () => {
  it('rejects a reduction below the total seats reserved by multiple parties', async () => {
    await addBooking(3);
    await addBooking(3);

    await expect(
      changeTable(5),
    ).rejects.toBeInstanceOf(CapacityConflictError);

    const savedTable = (await getDiningTables()).find(
      (item) => item.id === table.id,
    );

    expect(savedTable).toMatchObject({
      seatCount: 8,
      isActive: true,
    });
  });

  it('allows reducing capacity to exactly the occupied seats', async () => {
    await addBooking(6);

    await expect(
      changeTable(6),
    ).resolves.toMatchObject({
      seatCount: 6,
      isActive: true,
    });
  });

  it('does not add together seats reserved on different dates', async () => {
    await addBooking(4, '2030-01-03');
    await addBooking(4, '2030-01-04');

    await expect(
      changeTable(4),
    ).resolves.toMatchObject({
      seatCount: 4,
    });
  });

  it('rejects deactivating a table with confirmed bookings', async () => {
    await addBooking(2);

    await expect(
      changeTable(8, false),
    ).rejects.toMatchObject({
      code: 'CAPACITY_CONFLICT',
    });

    const savedTable = (await getDiningTables()).find(
      (item) => item.id === table.id,
    );

    expect(savedTable.isActive).toBe(true);
  });

  it('rejects removing an occupied table and preserves all assignments', async () => {
    await addBooking(6);

    await expect(
      setMealSlotTables(slot.id, [spareTable.id]),
    ).rejects.toBeInstanceOf(CapacityConflictError);

    const capacity = await getMealSlotCapacity(slot.id);

    expect(
      capacity.tables.map((item) => item.id),
    ).toEqual(
      expect.arrayContaining([table.id, spareTable.id]),
    );

    expect(capacity.tables).toHaveLength(2);
    expect(capacity.totalSeatCapacity).toBe(12);
  });

  it('rejects clearing all tables from an occupied slot', async () => {
    await addBooking(6);

    await expect(
      setMealSlotTables(slot.id, []),
    ).rejects.toBeInstanceOf(CapacityConflictError);

    const capacity = await getMealSlotCapacity(slot.id);

    expect(capacity.tables).toHaveLength(2);
    expect(capacity.totalSeatCapacity).toBe(12);
  });

  it('allows removing an unoccupied table while retaining the occupied one', async () => {
    await addBooking(6);

    const capacity = await setMealSlotTables(
      slot.id,
      [table.id],
    );

    expect(
      capacity.tables.map((item) => item.id),
    ).toEqual([table.id]);

    expect(capacity.totalSeatCapacity).toBe(8);
  });

  it('protects bookings for today according to the Rome timezone', async () => {

    slot = await updateMealSlot(slot.id, {
    ...slot,
    slotDate: '2030-01-02',
    });

    await addBooking(6, '2030-01-02');

    await expect(
      changeTable(2),
    ).rejects.toBeInstanceOf(CapacityConflictError);

    await expect(
      setMealSlotTables(slot.id, []),
    ).rejects.toBeInstanceOf(CapacityConflictError);
  });

  it('ignores past bookings and cancelled future bookings', async () => {
    slot = await updateMealSlot(slot.id, {
    ...slot,
    slotDate: '2030-01-01',
    });
    await addBooking(6, '2030-01-01');
    await addBooking(6, '2030-01-03', 'cancelled');

    await expect(
      changeTable(2, false),
    ).resolves.toMatchObject({
      seatCount: 2,
      isActive: false,
    });

    await expect(
      setMealSlotTables(slot.id, []),
    ).resolves.toMatchObject({
      tables: [],
      totalSeatCapacity: 0,
    });
  });

  it('allows clearing a slot without bookings', async () => {
    await expect(
      setMealSlotTables(slot.id, []),
    ).resolves.toMatchObject({
      tables: [],
      totalSeatCapacity: 0,
    });
  });

  it('rejects changing the start time of a booked slot', async () => {
    await addBooking(4);

    await expect(
        updateMealSlot(slot.id, {
        slotDate: slot.slotDate,
        name: slot.name,
        startTime: '11:30',
        endTime: slot.endTime,
        isActive: true,
        }),
    ).rejects.toBeInstanceOf(CapacityConflictError);

    const savedSlot = (await getMealSlots()).find(
        (item) => item.id === slot.id,
    );

    expect(savedSlot).toMatchObject({
        startTime: slot.startTime,
        endTime: slot.endTime,
        isActive: true,
    });
    });

    it('rejects changing the end time of a booked slot', async () => {
    await addBooking(4);

    await expect(
        updateMealSlot(slot.id, {
        slotDate: slot.slotDate,
        name: slot.name,
        startTime: slot.startTime,
        endTime: '14:00',
        isActive: true,
        }),
    ).rejects.toBeInstanceOf(CapacityConflictError);
    });

    it('rejects deactivating a slot with bookings today', async () => {

    slot = await updateMealSlot(slot.id, {
    ...slot,
    slotDate: '2030-01-02',
    });
    await addBooking(4, '2030-01-02');

    await expect(
        updateMealSlot(slot.id, {
        slotDate: slot.slotDate,
        name: slot.name,
        startTime: slot.startTime,
        endTime: slot.endTime,
        isActive: false,
        }),
    ).rejects.toBeInstanceOf(CapacityConflictError);

    const savedSlot = (await getMealSlots()).find(
        (item) => item.id === slot.id,
    );

    expect(savedSlot.isActive).toBe(true);
    });

    it('allows renaming a booked slot without changing its service', async () => {
    await addBooking(4);

    await expect(
        updateMealSlot(slot.id, {
        slotDate: slot.slotDate,
        name: `${slot.name} renamed`,
        startTime: slot.startTime,
        endTime: slot.endTime,
        isActive: true,
        }),
    ).resolves.toMatchObject({
        name: `${slot.name} renamed`,
        startTime: slot.startTime,
        endTime: slot.endTime,
        isActive: true,
    });
    });

    it('allows slot changes when only past or cancelled bookings exist', async () => {
    slot = await updateMealSlot(slot.id, {
    ...slot,
    slotDate: '2030-01-01',
    });
    await addBooking(4, '2030-01-01');
    await addBooking(4, '2030-01-03', 'cancelled');

    await expect(
        updateMealSlot(slot.id, {
        slotDate: slot.slotDate,
        name: slot.name,
        startTime: '18:00',
        endTime: '20:00',
        isActive: false,
        }),
    ).resolves.toMatchObject({
        startTime: '18:00',
        endTime: '20:00',
        isActive: false,
    });
    });

    it('allows changing times and deactivating a slot without bookings', async () => {
    await expect(
        updateMealSlot(slot.id, {
        slotDate: slot.slotDate,
        name: slot.name,
        startTime: '18:00',
        endTime: '20:00',
        isActive: false,
        }),
    ).resolves.toMatchObject({
        startTime: '18:00',
        endTime: '20:00',
        isActive: false,
    });
    });

    it('rejects moving a slot with a confirmed future booking', async () => {
        await addBooking(4);

        await expect(
            updateMealSlot(slot.id, {
            ...slot,
            slotDate: '2030-01-04',
            }),
        ).rejects.toBeInstanceOf(CapacityConflictError);

        const savedSlot = (await getMealSlots()).find(
            (item) => item.id === slot.id,
        );

        expect(savedSlot.slotDate).toBe('2030-01-03');
        });

        it('rejects moving a slot with a confirmed past booking', async () => {
        slot = await updateMealSlot(slot.id, {
            ...slot,
            slotDate: '2030-01-01',
        });

        await addBooking(4, '2030-01-01');

        await expect(
            updateMealSlot(slot.id, {
            ...slot,
            slotDate: '2030-01-04',
            }),
        ).rejects.toBeInstanceOf(CapacityConflictError);

        const savedSlot = (await getMealSlots()).find(
            (item) => item.id === slot.id,
        );

        expect(savedSlot.slotDate).toBe('2030-01-01');
        });

        it('allows moving a slot without bookings to another date', async () => {
        await expect(
            updateMealSlot(slot.id, {
            ...slot,
            slotDate: '2030-01-04',
            }),
        ).resolves.toMatchObject({
            id: slot.id,
            slotDate: '2030-01-04',
        });
        });
});