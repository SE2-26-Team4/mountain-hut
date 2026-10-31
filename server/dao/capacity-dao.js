import {
  allAsync,
  getAsync,
  runAsync,
  withTransaction,
} from '../db.js';

/**
 * @typedef {import('../models/models.js').MealSlotDTO} MealSlotDTO
 * @typedef {import('../models/models.js').DiningTableDTO} DiningTableDTO
 * @typedef {import('../models/models.js').MealSlotInputDTO} MealSlotInputDTO
 * @typedef {import('../models/models.js').DiningTableInputDTO} DiningTableInputDTO
 * @typedef {import('../models/models.js').MealSlotCapacityDTO} MealSlotCapacityDTO
 */

/**
 * SQLite stores boolean flags as integers.
 *
 * @typedef {Omit<MealSlotDTO, 'isActive'> & {
 *   isActive: number
 * }} MealSlotRow
 */

/**
 * @typedef {Omit<DiningTableDTO, 'isActive'> & {
 *   isActive: number
 * }} DiningTableRow
 */

/* HELPERS */

/**
 * @overload
 * @param {MealSlotRow} slot
 * @returns {MealSlotDTO}
 */

/**
 * @overload
 * @param {MealSlotRow | null | undefined} slot
 * @returns {MealSlotDTO | null}
 */

/**
 * @param {MealSlotRow | null | undefined} slot
 * @returns {MealSlotDTO | null}
 */
function normalizeMealSlot(slot) {
  if (!slot) {
    return null;
  }

  return {
    ...slot,
    isActive: Boolean(slot.isActive),
  };
}

/**
 * @overload
 * @param {DiningTableRow} table
 * @returns {DiningTableDTO}
 */

/**
 * @overload
 * @param {DiningTableRow | null | undefined} table
 * @returns {DiningTableDTO | null}
 */

/**
 * @param {DiningTableRow | null | undefined} table
 * @returns {DiningTableDTO | null}
 */
function normalizeDiningTable(table) {
  if (!table) {
    return null;
  }

  return {
    ...table,
    isActive: Boolean(table.isActive),
  };
}

/**
 * Uses the supplied query helpers so it can also run within a transaction.
 * Assigned inactive tables are included, but do not contribute to capacity.
 *
 * @param {number} slotId
 * @param {typeof getAsync} get
 * @param {typeof allAsync} all
 * @returns {Promise<MealSlotCapacityDTO | null>}
 */
async function readMealSlotCapacity(slotId, get, all) {
  /** @type {{ slotId: number, slotName: string } | undefined} */
  const slot = await get(
    `SELECT
       id AS slotId,
       name AS slotName
     FROM meal_slots
     WHERE id = ?`,
    [slotId],
  );

  if (!slot) {
    return null;
  }

  /** @type {DiningTableRow[]} */
  const tables = await all(
    `SELECT
       dining_tables.id,
       dining_tables.name,
       dining_tables.seat_count AS seatCount,
       dining_tables.is_active AS isActive
     FROM slot_tables
     INNER JOIN dining_tables
       ON dining_tables.id = slot_tables.table_id
     WHERE slot_tables.slot_id = ?
     ORDER BY dining_tables.name, dining_tables.id`,
    [slotId],
  );

  const normalizedTables = tables.map(
    (table) => normalizeDiningTable(table),
  );

  const totalSeatCapacity = normalizedTables.reduce(
    (total, table) => total + (table.isActive ? table.seatCount : 0),
    0,
  );

  return {
    ...slot,
    tables: normalizedTables,
    totalSeatCapacity,
  };
}

/* CREATE */

/**
 * @param {MealSlotInputDTO} input
 * @returns {Promise<MealSlotDTO | null>}
 */
export async function createMealSlot({
  name,
  startTime,
  endTime,
  isActive = true,
}) {
  const result = await runAsync(
    `INSERT INTO meal_slots (name, start_time, end_time, is_active)
     VALUES (?, ?, ?, ?)`,
    [name, startTime, endTime, isActive ? 1 : 0],
  );

  /** @type {MealSlotRow | undefined} */
  const slot = await getAsync(
    `SELECT
       id,
       name,
       start_time AS startTime,
       end_time AS endTime,
       is_active AS isActive
     FROM meal_slots
     WHERE id = ?`,
    [result.lastID],
  );

  return normalizeMealSlot(slot);
}

/**
 * @param {DiningTableInputDTO} input
 * @returns {Promise<DiningTableDTO | null>}
 */
export async function createDiningTable({
  name,
  seatCount,
  isActive = true,
}) {
  const result = await runAsync(
    `INSERT INTO dining_tables (name, seat_count, is_active)
     VALUES (?, ?, ?)`,
    [name, seatCount, isActive ? 1 : 0],
  );

  /** @type {DiningTableRow | undefined} */
  const table = await getAsync(
    `SELECT
       id,
       name,
       seat_count AS seatCount,
       is_active AS isActive
     FROM dining_tables
     WHERE id = ?`,
    [result.lastID],
  );

  return normalizeDiningTable(table);
}

/* READ */

/**
 * Returns all meal slots, including inactive ones.
 *
 * @returns {Promise<MealSlotDTO[]>}
 */
export async function getMealSlots() {
  /** @type {MealSlotRow[]} */
  const slots = await allAsync(
    `SELECT
       id,
       name,
       start_time AS startTime,
       end_time AS endTime,
       is_active AS isActive
     FROM meal_slots
     ORDER BY start_time, id`,
  );

  return slots.map((slot) => normalizeMealSlot(slot));
}

/**
 * Returns all dining tables, including inactive ones.
 *
 * @returns {Promise<DiningTableDTO[]>}
 */
export async function getDiningTables() {
  /** @type {DiningTableRow[]} */
  const tables = await allAsync(
    `SELECT
       id,
       name,
       seat_count AS seatCount,
       is_active AS isActive
     FROM dining_tables
     ORDER BY name, id`,
  );

  return tables.map((table) => normalizeDiningTable(table));
}

/**
 * Returns the assigned tables and configured capacity.
 * Returns null if the slot does not exist.
 *
 * @param {number} slotId
 * @returns {Promise<MealSlotCapacityDTO | null>}
 */
export async function getMealSlotCapacity(slotId) {
  return readMealSlotCapacity(slotId, getAsync, allAsync);
}

/* UPDATE */

/**
 * Replaces the editable fields of a meal slot.
 * Returns null if the slot does not exist.
 *
 * @param {number} slotId
 * @param {MealSlotInputDTO & { isActive: boolean }} input
 * @returns {Promise<MealSlotDTO | null>}
 */
export async function updateMealSlot(
  slotId,
  { name, startTime, endTime, isActive },
) {
  const result = await runAsync(
    `UPDATE meal_slots
     SET name = ?,
         start_time = ?,
         end_time = ?,
         is_active = ?
     WHERE id = ?`,
    [name, startTime, endTime, isActive ? 1 : 0, slotId],
  );

  if (result.changes === 0) {
    return null;
  }

  /** @type {MealSlotRow | undefined} */
  const slot = await getAsync(
    `SELECT
       id,
       name,
       start_time AS startTime,
       end_time AS endTime,
       is_active AS isActive
     FROM meal_slots
     WHERE id = ?`,
    [slotId],
  );

  return normalizeMealSlot(slot);
}

/**
 * Replaces the editable fields of a dining table.
 * Returns null if the table does not exist.
 *
 * @param {number} tableId
 * @param {DiningTableInputDTO & { isActive: boolean }} input
 * @returns {Promise<DiningTableDTO | null>}
 */
export async function updateDiningTable(
  tableId,
  { name, seatCount, isActive },
) {
  const result = await runAsync(
    `UPDATE dining_tables
     SET name = ?,
         seat_count = ?,
         is_active = ?
     WHERE id = ?`,
    [name, seatCount, isActive ? 1 : 0, tableId],
  );

  if (result.changes === 0) {
    return null;
  }

  /** @type {DiningTableRow | undefined} */
  const table = await getAsync(
    `SELECT
       id,
       name,
       seat_count AS seatCount,
       is_active AS isActive
     FROM dining_tables
     WHERE id = ?`,
    [tableId],
  );

  return normalizeDiningTable(table);
}

/**
 * Replaces all table assignments in a single transaction.
 * An empty list clears the assignments; duplicate IDs are ignored.
 *
 * @param {number} slotId
 * @param {number[]} tableIds
 * @returns {Promise<MealSlotCapacityDTO | null>}
 * @throws {TypeError} If tableIds is not an array.
 * @throws {Error} If a requested table does not exist.
 */
export async function setMealSlotTables(slotId, tableIds) {
  if (!Array.isArray(tableIds)) {
    throw new TypeError('Table IDs must be provided as an array.');
  }

  const uniqueTableIds = [...new Set(tableIds)];

  return withTransaction(async ({ runAsync, getAsync, allAsync }) => {
    const slot = await getAsync(
      'SELECT id FROM meal_slots WHERE id = ?',
      [slotId],
    );

    if (!slot) {
      return null;
    }

    if (uniqueTableIds.length > 0) {
      const placeholders = uniqueTableIds.map(() => '?').join(', ');
      const existingTables = await allAsync(
        `SELECT id
         FROM dining_tables
         WHERE id IN (${placeholders})`,
        uniqueTableIds,
      );

      if (existingTables.length !== uniqueTableIds.length) {
        throw new Error('One or more dining tables were not found.');
      }
    }

    await runAsync(
      'DELETE FROM slot_tables WHERE slot_id = ?',
      [slotId],
    );

    for (const tableId of uniqueTableIds) {
      await runAsync(
        `INSERT INTO slot_tables (slot_id, table_id)
         VALUES (?, ?)`,
        [slotId, tableId],
      );
    }

    return readMealSlotCapacity(slotId, getAsync, allAsync);
  });
}