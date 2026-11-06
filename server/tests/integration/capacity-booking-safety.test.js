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

// Keep each test's account, slot, and tables available for cleanup.
let userId;
let slot;
let table;
let spareTable;

// Track bookings and additional dated slots created by the helper.
const bookingIds = [];
const additionalSlots = new Map();

// Initialize the database schema before the suite.
beforeAll(async () => {
  await initializeDatabase();
});

// Create fresh fixtures with a fixed clock before each test.
beforeEach(async () => {
  // Mock only Date, leaving database timers unaffected.
  vi.useFakeTimers({ toFake: ['Date'] });

  // In Rome it is January 2, while in UTC it is still January 1.
  vi.setSystemTime(new Date('2030-01-01T23:30:00Z'));

  const suffix = Math.random().toString(36).slice(2);

  // Insert a hiker directly because these tests do not exercise authentication.
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

  // Create a future slot for the default booking scenarios.
  slot = await createMealSlot({
    slotDate: '2030-01-03',
    name: `Safety slot ${suffix}`,
    startTime: '12:00',
    endTime: '13:00',
  });

  // The helper allocates bookings to the eight-seat table.
  table = await createDiningTable({
    name: `Booked table ${suffix}`,
    seatCount: 8,
  });

  // Keep a second table available for assignment-removal tests.
  spareTable = await createDiningTable({
    name: `Spare table ${suffix}`,
    seatCount: 4,
  });

  await setMealSlotTables(
    slot.id,
    [table.id, spareTable.id],
  );
});

// Restore the clock and remove only records created by these tests.
afterEach(async () => {
  vi.useRealTimers();

  // Delete allocations before their parent bookings.
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

  // Remove additional dated slots created by addBooking.
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

  // Remove the primary slot after its bookings have been deleted.
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

  // Delete reusable tables after removing all assignments.
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

  // Clear fixture references before the next test.
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

  // Use a separate slot when the requested booking date differs.
  if (bookingDate !== slot.slotDate) {
    bookingSlot = additionalSlots.get(bookingDate);

    if (!bookingSlot) {
      // Reuse the primary service details on the additional date.
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

  // Insert the requested status directly, including cancelled test bookings.
  const booking = await runAsync(
    `INSERT INTO bookings (
       hiker_id, booking_date, slot_id, party_size, status
     )
     VALUES (?, ?, ?, ?, ?)`,
    [userId, bookingDate, bookingSlot.id, seats, status],
  );

  bookingIds.push(booking.lastID);

  // Allocate all requested seats to the primary table.
  await runAsync(
    `INSERT INTO booking_table_allocations (
       booking_id, table_id, seats_reserved
     )
     VALUES (?, ?, ?)`,
    [booking.lastID, table.id, seats],
  );
}

// Change capacity or active status while preserving the table's name.
function changeTable(seatCount, isActive = true) {
  return updateDiningTable(table.id, {
    name: table.name,
    seatCount,
    isActive,
  });
}

describe('capacity changes preserve confirmed bookings', () => {
  // Capacity checks must count all parties sharing the same service.
  it('rejects a reduction below the total seats reserved by multiple parties', async () => {
    await addBooking(3);
    await addBooking(3);

    await expect(
      changeTable(5),
    ).rejects.toBeInstanceOf(CapacityConflictError);

    // A rejected change must preserve the original table configuration.
    const savedTable = (await getDiningTables()).find(
      (item) => item.id === table.id,
    );

    expect(savedTable).toMatchObject({
      seatCount: 8,
      isActive: true,
    });
  });

  // Reducing capacity to the occupied seat count remains valid.
  it('allows reducing capacity to exactly the occupied seats', async () => {
    await addBooking(6);

    await expect(
      changeTable(6),
    ).resolves.toMatchObject({
      seatCount: 6,
      isActive: true,
    });
  });

  // Reservations on separate dates must not be added into one occupancy total.
  it('does not add together seats reserved on different dates', async () => {
    await addBooking(4, '2030-01-03');
    await addBooking(4, '2030-01-04');

    await expect(
      changeTable(4),
    ).resolves.toMatchObject({
      seatCount: 4,
    });
  });

  // Deactivation would remove capacity needed by confirmed bookings.
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

  // Removing an occupied table must fail without altering any assignments.
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

  // Clearing an occupied slot must preserve its tables and capacity.
  it('rejects clearing all tables from an occupied slot', async () => {
    await addBooking(6);

    await expect(
      setMealSlotTables(slot.id, []),
    ).rejects.toBeInstanceOf(CapacityConflictError);

    const capacity = await getMealSlotCapacity(slot.id);

    expect(capacity.tables).toHaveLength(2);
    expect(capacity.totalSeatCapacity).toBe(12);
  });

  // Unoccupied tables may be removed if all occupied tables remain assigned.
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

  // Booking protection uses the Rome calendar date rather than the UTC date.
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

  // Past bookings and cancelled future bookings do not block capacity changes.
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

  // Empty slots can have every table assignment removed.
  it('allows clearing a slot without bookings', async () => {
    await expect(
      setMealSlotTables(slot.id, []),
    ).resolves.toMatchObject({
      tables: [],
      totalSeatCapacity: 0,
    });
  });

  // Confirmed future bookings prevent changes to the service start time.
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

    // Verify that the rejected update left the original service unchanged.
    const savedSlot = (await getMealSlots()).find(
      (item) => item.id === slot.id,
    );

    expect(savedSlot).toMatchObject({
      startTime: slot.startTime,
      endTime: slot.endTime,
      isActive: true,
    });
  });

  // Confirmed future bookings also prevent changes to the service end time.
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

  // A service with confirmed bookings today cannot be deactivated.
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

  // Renaming remains allowed when date, times, and active status stay unchanged.
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

  // Time and active-status changes ignore past or cancelled reservations.
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

  // A slot without bookings can freely change its times and active status.
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

  // Moving a slot must not break its confirmed future bookings' date association.
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

  // Date changes also preserve the date association of confirmed past bookings.
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

  // A slot without bookings can move to another date.
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