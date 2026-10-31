import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  createDiningTable,
  createMealSlot,
  DiningTablesNotFoundError,
  getDiningTables,
  getMealSlotCapacity,
  getMealSlots,
  setMealSlotTables,
  updateDiningTable,
  updateMealSlot,
} from '../../dao/capacity-dao.js';
import { initializeDatabase, runAsync } from '../../db.js';

const uniqueSuffix = `${Date.now()}-${Math.random()}`;

let slotId;
let tableId;

beforeAll(async () => {
  await initializeDatabase();

  const slot = await createMealSlot({
    name: `Capacity test slot ${uniqueSuffix}`,
    startTime: '18:00',
    endTime: '20:00',
  });

  slotId = slot.id;

  const table = await createDiningTable({
    name: `Capacity test table ${uniqueSuffix}`,
    seatCount: 4,
  });

  tableId = table.id;
});

afterAll(async () => {
  if (slotId) {
    await runAsync('DELETE FROM slot_tables WHERE slot_id = ?', [slotId]);
    await runAsync('DELETE FROM meal_slots WHERE id = ?', [slotId]);
  }

  if (tableId) {
    await runAsync('DELETE FROM slot_tables WHERE table_id = ?', [tableId]);
    await runAsync('DELETE FROM dining_tables WHERE id = ?', [tableId]);
  }
});

describe('meal-slot and dining-table data access', () => {
  it('reads the created meal slot and dining table', async () => {
    const slots = await getMealSlots();
    const tables = await getDiningTables();

    expect(slots.find((slot) => slot.id === slotId)).toMatchObject({
      name: `Capacity test slot ${uniqueSuffix}`,
      startTime: '18:00',
      endTime: '20:00',
      isActive: true,
    });

    expect(tables.find((table) => table.id === tableId)).toMatchObject({
      name: `Capacity test table ${uniqueSuffix}`,
      seatCount: 4,
      isActive: true,
    });
  });

  it('updates a meal slot and a dining table', async () => {
    const updatedSlot = await updateMealSlot(slotId, {
      name: `Updated capacity test slot ${uniqueSuffix}`,
      startTime: '19:00',
      endTime: '21:00',
      isActive: true,
    });

    const updatedTable = await updateDiningTable(tableId, {
      name: `Updated capacity test table ${uniqueSuffix}`,
      seatCount: 6,
      isActive: true,
    });

    expect(updatedSlot).toMatchObject({
      id: slotId,
      name: `Updated capacity test slot ${uniqueSuffix}`,
      startTime: '19:00',
      endTime: '21:00',
      isActive: true,
    });

    expect(updatedTable).toMatchObject({
      id: tableId,
      name: `Updated capacity test table ${uniqueSuffix}`,
      seatCount: 6,
      isActive: true,
    });
  });

  it('returns null when updating a meal slot or table that does not exist', async () => {
    const missingSlot = await updateMealSlot(-1, {
      name: 'Missing slot',
      startTime: '18:00',
      endTime: '20:00',
      isActive: true,
    });

    const missingTable = await updateDiningTable(-1, {
      name: 'Missing table',
      seatCount: 2,
      isActive: true,
    });

    expect(missingSlot).toBeNull();
    expect(missingTable).toBeNull();
  });
});

// [Slot-table assignment and capacity aggregation]: Use dedicated records so the expected capacity is known.
describe('slot-table assignment and capacity aggregation', () => {
  const assignmentSlotName = `Assignment test slot ${uniqueSuffix}`;

  let assignmentSlotId;
  let fourSeatTableId;
  let twoSeatTableId;
  let inactiveTableId;

  /**
   * @param {number[]} ids
   * @returns {number[]}
   */
  const sortIds = (ids) => [...ids].sort((firstId, secondId) => firstId - secondId);

  /**
   * @returns {Promise<{ tableIds: number[], totalSeatCapacity: number }>}
   */
  async function readSavedAssignment() {
    const capacity = await getMealSlotCapacity(assignmentSlotId);

    return {
      tableIds: sortIds(capacity.tables.map((table) => table.id)),
      totalSeatCapacity: capacity.totalSeatCapacity,
    };
  }

  beforeAll(async () => {
    const slot = await createMealSlot({
      name: assignmentSlotName,
      startTime: '12:00',
      endTime: '13:00',
    });

    assignmentSlotId = slot.id;

    const fourSeatTable = await createDiningTable({
      name: `Four-seat assignment table ${uniqueSuffix}`,
      seatCount: 4,
    });

    fourSeatTableId = fourSeatTable.id;

    const twoSeatTable = await createDiningTable({
      name: `Two-seat assignment table ${uniqueSuffix}`,
      seatCount: 2,
    });

    twoSeatTableId = twoSeatTable.id;

    const inactiveTable = await createDiningTable({
      name: `Inactive assignment table ${uniqueSuffix}`,
      seatCount: 6,
      isActive: false,
    });

    inactiveTableId = inactiveTable.id;
  });

  afterAll(async () => {
    if (assignmentSlotId) {
      await runAsync(
        'DELETE FROM slot_tables WHERE slot_id = ?',
        [assignmentSlotId],
      );

      await runAsync(
        'DELETE FROM meal_slots WHERE id = ?',
        [assignmentSlotId],
      );
    }

    for (const id of [fourSeatTableId, twoSeatTableId, inactiveTableId]) {
      if (id) {
        await runAsync('DELETE FROM slot_tables WHERE table_id = ?', [id]);
        await runAsync('DELETE FROM dining_tables WHERE id = ?', [id]);
      }
    }
  });

  // [Slot-table assignment and capacity aggregation]: Verify a successful assignment and its total capacity.
  it('assigns tables to a meal slot and calculates its total seat capacity', async () => {
    const capacity = await setMealSlotTables(
      assignmentSlotId,
      [fourSeatTableId, twoSeatTableId],
    );

    expect(capacity).toMatchObject({
      slotId: assignmentSlotId,
      slotName: assignmentSlotName,
      totalSeatCapacity: 6,
    });

    expect(sortIds(capacity.tables.map((table) => table.id))).toEqual(
      sortIds([fourSeatTableId, twoSeatTableId]),
    );

    await expect(getMealSlotCapacity(assignmentSlotId)).resolves.toEqual(
      capacity,
    );
  });

  // [Slot-table assignment and capacity aggregation]: Verify inactive tables are listed but not counted.
  it('excludes assigned inactive tables from the total seat capacity', async () => {
    const capacity = await setMealSlotTables(
      assignmentSlotId,
      [fourSeatTableId, inactiveTableId],
    );

    expect(
      capacity.tables.find((table) => table.id === inactiveTableId),
    ).toMatchObject({
      seatCount: 6,
      isActive: false,
    });

    expect(capacity.totalSeatCapacity).toBe(4);
  });

  // [Slot-table assignment and capacity aggregation]: Verify a new assignment replaces the previous one.
  it('replaces previous assignments and ignores duplicate table IDs', async () => {
    await setMealSlotTables(assignmentSlotId, [fourSeatTableId, twoSeatTableId]);

    const capacity = await setMealSlotTables(
      assignmentSlotId,
      [twoSeatTableId, twoSeatTableId],
    );

    expect(capacity.tables.map((table) => table.id)).toEqual([twoSeatTableId]);
    expect(capacity.totalSeatCapacity).toBe(2);
  });

  // [Slot-table assignment and capacity aggregation]: Verify an empty list clears the assignment.
  it('clears all assignments when no tables are requested', async () => {
    await setMealSlotTables(assignmentSlotId, [fourSeatTableId]);

    const capacity = await setMealSlotTables(assignmentSlotId, []);

    expect(capacity.tables).toEqual([]);
    expect(capacity.totalSeatCapacity).toBe(0);
  });

  // [Slot-table assignment and capacity aggregation]: Verify failed assignments preserve the existing assignment.
  it('preserves existing assignments when a requested table does not exist', async () => {
    await setMealSlotTables(assignmentSlotId, [fourSeatTableId, twoSeatTableId]);

    const missingTableId = -1;
    const failedAssignment = setMealSlotTables(
      assignmentSlotId,
      [twoSeatTableId, missingTableId],
    );

    await expect(failedAssignment).rejects.toBeInstanceOf(
      DiningTablesNotFoundError,
    );

    await expect(failedAssignment).rejects.toMatchObject({
      message: 'One or more dining tables were not found.',
      missingTableIds: [missingTableId],
    });

    await expect(readSavedAssignment()).resolves.toEqual({
      tableIds: sortIds([fourSeatTableId, twoSeatTableId]),
      totalSeatCapacity: 6,
    });
  });

  // [Slot-table assignment and capacity aggregation]: Verify a failure after the first write is rolled back.
  it('rolls back partial changes when saving an assignment fails', async () => {
    await setMealSlotTables(assignmentSlotId, [fourSeatTableId, twoSeatTableId]);

    // The second insert fails after the old rows are deleted and the first new row is saved.
    await runAsync(
      `CREATE TEMP TRIGGER fail_slot_table_insert
       BEFORE INSERT ON slot_tables
       WHEN NEW.slot_id = ${assignmentSlotId}
         AND NEW.table_id = ${inactiveTableId}
       BEGIN
         SELECT RAISE(ABORT, 'Forced assignment failure');
       END`,
    );

    try {
      await expect(
        setMealSlotTables(assignmentSlotId, [twoSeatTableId, inactiveTableId]),
      ).rejects.toThrow('Forced assignment failure');
    } finally {
      await runAsync('DROP TRIGGER IF EXISTS fail_slot_table_insert');
    }

    await expect(readSavedAssignment()).resolves.toEqual({
      tableIds: sortIds([fourSeatTableId, twoSeatTableId]),
      totalSeatCapacity: 6,
    });
  });

  // [Slot-table assignment and capacity aggregation]: Verify table IDs must be integers.
  it('rejects table IDs that are not integers without changing assignments', async () => {
    await setMealSlotTables(assignmentSlotId, [fourSeatTableId]);

    await expect(
      setMealSlotTables(assignmentSlotId, String(fourSeatTableId)),
    ).rejects.toBeInstanceOf(TypeError);

    await expect(
      setMealSlotTables(assignmentSlotId, [String(twoSeatTableId)]),
    ).rejects.toBeInstanceOf(TypeError);

    await expect(
      setMealSlotTables(assignmentSlotId, [true]),
    ).rejects.toBeInstanceOf(TypeError);

    await expect(readSavedAssignment()).resolves.toEqual({
      tableIds: [fourSeatTableId],
      totalSeatCapacity: 4,
    });
  });

  // [Slot-table assignment and capacity aggregation]: Return null for an unknown meal slot.
  it('returns null when requesting capacity for a meal slot that does not exist', async () => {
    await expect(getMealSlotCapacity(-1)).resolves.toBeNull();
    await expect(setMealSlotTables(-1, [fourSeatTableId])).resolves.toBeNull();
  });
});
