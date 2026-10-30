import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  createDiningTable,
  createMealSlot,
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
let secondTableId;

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

  // [Slot-table assignment and capacity aggregation]: Create a second table for assignment tests.
  const secondTable = await createDiningTable({
    name: `Second capacity test table ${uniqueSuffix}`,
    seatCount: 2,
  });

  secondTableId = secondTable.id;
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

  if (secondTableId) {
    await runAsync(
      'DELETE FROM slot_tables WHERE table_id = ?',
      [secondTableId],
    );

    await runAsync(
      'DELETE FROM dining_tables WHERE id = ?',
      [secondTableId],
    );
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

  // [Slot-table assignment and capacity aggregation]: Verify table assignments and total active capacity.
  it('assigns tables to a meal slot and calculates its capacity', async () => {
    const capacity = await setMealSlotTables(
      slotId,
      [tableId, secondTableId],
    );

    const assignedTableIds = capacity.tables
      .map((table) => table.id)
      .sort((firstId, secondId) => firstId - secondId);

    expect(assignedTableIds).toEqual(
      [tableId, secondTableId].sort(
        (firstId, secondId) => firstId - secondId,
      ),
    );

    expect(capacity.totalSeatCapacity).toBe(
      capacity.tables.reduce(
        (total, table) => total + (table.isActive ? table.seatCount : 0),
        0,
      ),
    );

    const savedCapacity = await getMealSlotCapacity(slotId);

    expect(savedCapacity).toEqual(capacity);
  });

  // [Slot-table assignment and capacity aggregation]: Verify failed assignments preserve the existing assignment.
  it('preserves existing assignments when a requested table does not exist', async () => {
    await setMealSlotTables(slotId, [tableId, secondTableId]);

    await expect(
      setMealSlotTables(slotId, [secondTableId, -1]),
    ).rejects.toThrow('One or more dining tables were not found.');

    const capacity = await getMealSlotCapacity(slotId);

    const assignedTableIds = capacity.tables
      .map((table) => table.id)
      .sort((firstId, secondId) => firstId - secondId);

    expect(assignedTableIds).toEqual(
      [tableId, secondTableId].sort(
        (firstId, secondId) => firstId - secondId,
      ),
    );
  });

  // [Slot-table assignment and capacity aggregation]: Return null for an unknown meal slot.
  it('returns null when requesting capacity for a meal slot that does not exist', async () => {
    await expect(getMealSlotCapacity(-1)).resolves.toBeNull();
    await expect(setMealSlotTables(-1, [tableId])).resolves.toBeNull();
  });
});
