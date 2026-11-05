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

let firstSlot;
let secondSlot;
let firstTable;
let secondTable;

beforeAll(async () => {
  await initializeDatabase();
});

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

  await setMealSlotTables(firstSlot.id, [firstTable.id]);
});

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

  firstSlot = undefined;
  secondSlot = undefined;
  firstTable = undefined;
  secondTable = undefined;
});

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

async function readSecondSlot() {
  const slots = await getMealSlots();

  return slots.find((slot) => slot.id === secondSlot.id);
}

describe('table assignments across meal slots', () => {
  it('rejects assigning the same table to overlapping active slots', async () => {
    await expect(
      setMealSlotTables(secondSlot.id, [firstTable.id]),
    ).rejects.toBeInstanceOf(TableSlotConflictError);

    const capacity = await getMealSlotCapacity(secondSlot.id);

    expect(capacity.tables).toEqual([]);
  });

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

  it('rejects a slot contained within another slot using the same table', async () => {
    await changeSecondSlot({
      startTime: '12:15',
      endTime: '13:00',
    });

    await expect(
      setMealSlotTables(secondSlot.id, [firstTable.id]),
    ).rejects.toBeInstanceOf(TableSlotConflictError);
  });

  it('rejects a slot containing another slot using the same table', async () => {
    await changeSecondSlot({
      startTime: '11:00',
      endTime: '15:00',
    });

    await expect(
      setMealSlotTables(secondSlot.id, [firstTable.id]),
    ).rejects.toBeInstanceOf(TableSlotConflictError);
  });

  it('preserves all previous assignments when replacement conflicts', async () => {
    await setMealSlotTables(secondSlot.id, [secondTable.id]);

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

  it('rejects changing times to overlap and preserves original times', async () => {
    await changeSecondSlot({
      startTime: '18:00',
      endTime: '20:00',
    });

    await setMealSlotTables(secondSlot.id, [firstTable.id]);

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

  it('allows configuring an inactive slot but rejects conflicting reactivation', async () => {
    await changeSecondSlot({ isActive: false });

    await expect(
      setMealSlotTables(secondSlot.id, [firstTable.id]),
    ).resolves.toMatchObject({
      totalSeatCapacity: 4,
    });

    await expect(
      changeSecondSlot({ isActive: true }),
    ).rejects.toBeInstanceOf(TableSlotConflictError);

    expect(await readSecondSlot()).toMatchObject({
      isActive: false,
    });
  });

  it('allows reactivation when the assigned tables do not conflict', async () => {
    await changeSecondSlot({ isActive: false });

    await setMealSlotTables(secondSlot.id, [secondTable.id]);

    await expect(
      changeSecondSlot({ isActive: true }),
    ).resolves.toMatchObject({
      isActive: true,
    });
  });

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

    it('rejects moving an assigned slot to a date with a table conflict', async () => {
    // Initially the slots are on different dates.
    await changeSecondSlot({
        slotDate: '2099-12-31',
    });

    await setMealSlotTables(
        secondSlot.id,
        [firstTable.id],
    );

    // Moving it onto the first date would double-book the table.
    await expect(
        changeSecondSlot({
        slotDate: firstSlot.slotDate,
        }),
    ).rejects.toBeInstanceOf(TableSlotConflictError);

    expect(await readSecondSlot()).toMatchObject({
        slotDate: '2099-12-31',
        startTime: '13:00',
        endTime: '14:00',
        isActive: true,
    });

    const capacity = await getMealSlotCapacity(secondSlot.id);

    expect(
        capacity.tables.map((table) => table.id),
    ).toEqual([firstTable.id]);
    });
});