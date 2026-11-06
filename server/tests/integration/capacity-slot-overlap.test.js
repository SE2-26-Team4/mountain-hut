import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest';

import {
  TableSlotConflictError,
  createDiningTable,
  createMealSlot,
  getMealSlotCapacity,
  getMealSlots,
  setMealSlotTables,
  updateMealSlot,
} from '../../dao/capacity-dao.js';

import {
  initializeDatabase,
  runAsync,
} from '../../db.js';

// Keep each test's slots and tables available for cleanup.
let firstSlot;
let secondSlot;
let firstTable;
let secondTable;

// Initialize the database schema before the suite.
beforeAll(async () => {
  await initializeDatabase();
});

// Create fresh overlapping slots and separate tables before each test.
beforeEach(async () => {
  const suffix = Math.random().toString(36).slice(2);

  firstSlot = await createMealSlot({
    slotDate: '2099-12-30',
    name: `First slot ${suffix}`,
    startTime: '12:00',
    endTime: '13:30',
  });

  secondSlot = await createMealSlot({
    slotDate: '2099-12-30',
    name: `Second slot ${suffix}`,
    startTime: '13:00',
    endTime: '14:00',
  });

  firstTable = await createDiningTable({
    name: `First table ${suffix}`,
    seatCount: 4,
  });

  secondTable = await createDiningTable({
    name: `Second table ${suffix}`,
    seatCount: 6,
  });

  // Reserve the first table for the first slot's conflict scenarios.
  await setMealSlotTables(
    firstSlot.id,
    [firstTable.id],
  );
});

// Remove assignments before deleting their slots and tables.
afterEach(async () => {
  for (const slot of [firstSlot, secondSlot]) {
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
  }

  for (const table of [firstTable, secondTable]) {
    if (table) {
      await runAsync(
        'DELETE FROM dining_tables WHERE id = ?',
        [table.id],
      );
    }
  }

  // Clear fixture references before the next test.
  firstSlot = undefined;
  secondSlot = undefined;
  firstTable = undefined;
  secondTable = undefined;
});

/**
 * Updates the second slot using its original fixture values
 * and any explicitly provided changes.
 */
function changeSecondSlot(changes = {}) {
  return updateMealSlot(secondSlot.id, {
    slotDate: secondSlot.slotDate,
    name: secondSlot.name,
    startTime: secondSlot.startTime,
    endTime: secondSlot.endTime,
    isActive: true,
    ...changes,
  });
}

// Read the second slot's persisted values after an update attempt.
async function readSecondSlot() {
  const slots = await getMealSlots();

  return slots.find((slot) => slot.id === secondSlot.id);
}

describe('table assignments across meal slots', () => {
  // Overlapping active slots must not share the same table.
  it('rejects assigning the same table to overlapping active slots', async () => {
    await expect(
      setMealSlotTables(secondSlot.id, [firstTable.id]),
    ).rejects.toBeInstanceOf(TableSlotConflictError);

    // A rejected assignment must leave the slot without tables.
    const capacity = await getMealSlotCapacity(secondSlot.id);

    expect(capacity.tables).toEqual([]);
  });

  // A slot may start exactly when another slot using the same table ends.
  it('allows the same table in consecutive slots', async () => {
    await changeSecondSlot({
      startTime: '13:30',
      endTime: '14:30',
    });

    const capacity = await setMealSlotTables(
      secondSlot.id,
      [firstTable.id],
    );

    expect(
      capacity.tables.map((table) => table.id),
    ).toEqual([firstTable.id]);
  });

  // Slots with separate service times may reuse the same table.
  it('allows the same table in separate slots', async () => {
    await changeSecondSlot({
      startTime: '18:00',
      endTime: '20:00',
    });

    await expect(
      setMealSlotTables(secondSlot.id, [firstTable.id]),
    ).resolves.toMatchObject({
      totalSeatCapacity: 4,
    });
  });

  // Overlapping slots remain valid when their assigned tables differ.
  it('allows different tables in overlapping slots', async () => {
    const capacity = await setMealSlotTables(
      secondSlot.id,
      [secondTable.id],
    );

    expect(
      capacity.tables.map((table) => table.id),
    ).toEqual([secondTable.id]);

    expect(capacity.totalSeatCapacity).toBe(6);
  });

  // A service fully contained within another service still creates a conflict.
  it('rejects a slot contained within another slot using the same table', async () => {
    await changeSecondSlot({
      startTime: '12:15',
      endTime: '13:00',
    });

    await expect(
      setMealSlotTables(secondSlot.id, [firstTable.id]),
    ).rejects.toBeInstanceOf(TableSlotConflictError);
  });

  // A service enclosing another service must also reject the shared table.
  it('rejects a slot containing another slot using the same table', async () => {
    await changeSecondSlot({
      startTime: '11:00',
      endTime: '15:00',
    });

    await expect(
      setMealSlotTables(secondSlot.id, [firstTable.id]),
    ).rejects.toBeInstanceOf(TableSlotConflictError);
  });

  // A conflicting replacement must preserve all previously saved assignments.
  it('preserves all previous assignments when replacement conflicts', async () => {
    await setMealSlotTables(
      secondSlot.id,
      [secondTable.id],
    );

    await expect(
      setMealSlotTables(
        secondSlot.id,
        [firstTable.id, secondTable.id],
      ),
    ).rejects.toBeInstanceOf(TableSlotConflictError);

    const capacity = await getMealSlotCapacity(secondSlot.id);

    expect(
      capacity.tables.map((table) => table.id),
    ).toEqual([secondTable.id]);

    expect(capacity.totalSeatCapacity).toBe(6);
  });

  // Existing assignments must not cause a slot to conflict with itself.
  it('excludes the slot itself when checking existing assignments', async () => {
    await expect(
      setMealSlotTables(firstSlot.id, [firstTable.id]),
    ).resolves.toMatchObject({
      totalSeatCapacity: 4,
    });

    await expect(
      updateMealSlot(firstSlot.id, {
        slotDate: firstSlot.slotDate,
        name: firstSlot.name,
        startTime: firstSlot.startTime,
        endTime: firstSlot.endTime,
        isActive: true,
      }),
    ).resolves.toMatchObject({
      id: firstSlot.id,
      isActive: true,
    });
  });

  // Time changes must reject new conflicts and preserve the saved service times.
  it('rejects changing times to overlap and preserves original times', async () => {
    await changeSecondSlot({
      startTime: '18:00',
      endTime: '20:00',
    });

    await setMealSlotTables(
      secondSlot.id,
      [firstTable.id],
    );

    await expect(
      changeSecondSlot({
        startTime: '13:00',
        endTime: '14:00',
      }),
    ).rejects.toBeInstanceOf(TableSlotConflictError);

    expect(await readSecondSlot()).toMatchObject({
      startTime: '18:00',
      endTime: '20:00',
      isActive: true,
    });
  });

  // Inactive slots may be configured, but activation must validate conflicts.
  it('allows configuring an inactive slot but rejects conflicting reactivation', async () => {
    await changeSecondSlot({
      isActive: false,
    });

    await expect(
      setMealSlotTables(secondSlot.id, [firstTable.id]),
    ).resolves.toMatchObject({
      totalSeatCapacity: 4,
    });

    await expect(
      changeSecondSlot({ isActive: true }),
    ).rejects.toBeInstanceOf(TableSlotConflictError);

    // Rejected reactivation must leave the slot inactive.
    expect(await readSecondSlot()).toMatchObject({
      isActive: false,
    });
  });

  // Reactivation remains valid when the assigned tables are available.
  it('allows reactivation when the assigned tables do not conflict', async () => {
    await changeSecondSlot({
      isActive: false,
    });

    await setMealSlotTables(
      secondSlot.id,
      [secondTable.id],
    );

    await expect(
      changeSecondSlot({ isActive: true }),
    ).resolves.toMatchObject({
      isActive: true,
    });
  });

  // Assignments on inactive slots must not block another slot's configuration.
  it('ignores assignments belonging to other inactive slots', async () => {
    await updateMealSlot(firstSlot.id, {
      slotDate: firstSlot.slotDate,
      name: firstSlot.name,
      startTime: firstSlot.startTime,
      endTime: firstSlot.endTime,
      isActive: false,
    });

    await expect(
      setMealSlotTables(secondSlot.id, [firstTable.id]),
    ).resolves.toMatchObject({
      totalSeatCapacity: 4,
    });
  });

  // Matching service times on different dates may reuse the same table.
  it('allows the same table in overlapping times on different dates', async () => {
    await changeSecondSlot({
      slotDate: '2099-12-31',
    });

    const capacity = await setMealSlotTables(
      secondSlot.id,
      [firstTable.id],
    );

    expect(
      capacity.tables.map((table) => table.id),
    ).toEqual([firstTable.id]);

    expect(await readSecondSlot()).toMatchObject({
      slotDate: '2099-12-31',
      startTime: '13:00',
      endTime: '14:00',
    });
  });

  // Date changes must reject conflicts with existing table assignments.
  it('rejects moving an assigned slot to a date with a table conflict', async () => {
    // Assign the shared table while the slots are on separate dates.
    await changeSecondSlot({
      slotDate: '2099-12-31',
    });

    await setMealSlotTables(
      secondSlot.id,
      [firstTable.id],
    );

    // Moving onto the first slot's date would double-book the table.
    await expect(
      changeSecondSlot({
        slotDate: firstSlot.slotDate,
      }),
    ).rejects.toBeInstanceOf(TableSlotConflictError);

    // A rejected move must preserve the date, times, and active status.
    expect(await readSecondSlot()).toMatchObject({
      slotDate: '2099-12-31',
      startTime: '13:00',
      endTime: '14:00',
      isActive: true,
    });

    // The existing table assignment must also remain unchanged.
    const capacity = await getMealSlotCapacity(secondSlot.id);

    expect(
      capacity.tables.map((table) => table.id),
    ).toEqual([firstTable.id]);
  });
});