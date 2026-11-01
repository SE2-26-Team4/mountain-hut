import { withTransaction } from '../db.js';

/**
 * @typedef {import('../models/models.js').MealSlotDTO} MealSlotDTO
 * @typedef {import('../models/models.js').DiningTableDTO} DiningTableDTO
 * @typedef {import('../models/models.js').MealSlotInputDTO} MealSlotInputDTO
 * @typedef {import('../models/models.js').DiningTableInputDTO} DiningTableInputDTO
 * @typedef {import('../models/models.js').MealSlotCapacityDTO} MealSlotCapacityDTO
 *
 * @typedef {Omit<MealSlotDTO, 'isActive'> & {
 *   isActive: number
 * }} MealSlotRow
 *
 * @typedef {Omit<DiningTableDTO, 'isActive'> & {
 *   isActive: number
 * }} DiningTableRow
 *
 * @typedef {import('../db.js').TransactionQueries} TransactionQueries
 */

/* ERRORS */

/**
 * Thrown when a table assignment references dining tables that do not exist.
 */
export class DiningTablesNotFoundError extends Error {
  /**
   * @param {number[]} missingTableIds
   */
  constructor(missingTableIds) {
    super('One or more dining tables were not found.');

    this.name = 'DiningTablesNotFoundError';
    this.missingTableIds = missingTableIds;
  }
}

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
  if (!slot) return null;

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
  if (!table) return null;

  return {
    ...table,
    isActive: Boolean(table.isActive),
  };
}

/**
 * Reads capacity using an already open transaction.
 * Assigned inactive tables do not contribute to capacity.
 *
 * @param {number} slotId
 * @param {TransactionQueries} queries
 * @returns {Promise<MealSlotCapacityDTO | null>}
 */
async function readMealSlotCapacity(
  slotId,
  { getAsync, allAsync }
) {
  /** @type {{ slotId: number, slotName: string } | undefined} */
  const slot = await getAsync(
    `SELECT id AS slotId, name AS slotName
     FROM meal_slots
     WHERE id = ?`,
    [slotId]
  );

  if (!slot) return null;

  /** @type {DiningTableRow[]} */
  const tables = await allAsync(
    `SELECT
       t.id,
       t.name,
       t.seat_count AS seatCount,
       t.is_active AS isActive
     FROM slot_tables AS st
     JOIN dining_tables AS t ON t.id = st.table_id
     WHERE st.slot_id = ?
     ORDER BY t.name, t.id`,
    [slotId]
  );

  const normalizedTables = tables.map(
    (table) => normalizeDiningTable(table)
  );

  return {
    ...slot,
    tables: normalizedTables,
    totalSeatCapacity: normalizedTables.reduce(
      (total, table) =>
        total + (table.isActive ? table.seatCount : 0),
      0
    ),
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
  return withTransaction(async ({ runAsync, getAsync }) => {
    const result = await runAsync(
      `INSERT INTO meal_slots (
         name, start_time, end_time, is_active
       )
       VALUES (?, ?, ?, ?)`,
      [name, startTime, endTime, isActive ? 1 : 0]
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
      [result.lastID]
    );

    return normalizeMealSlot(slot);
  });
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
  return withTransaction(async ({ runAsync, getAsync }) => {
    const result = await runAsync(
      `INSERT INTO dining_tables (name, seat_count, is_active)
       VALUES (?, ?, ?)`,
      [name, seatCount, isActive ? 1 : 0]
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
      [result.lastID]
    );

    return normalizeDiningTable(table);
  });
}

/* READ */

/**
 * Returns all meal slots, including inactive ones.
 *
 * @returns {Promise<MealSlotDTO[]>}
 */
export async function getMealSlots() {
  return withTransaction(async ({ allAsync }) => {
    /** @type {MealSlotRow[]} */
    const slots = await allAsync(
      `SELECT
         id,
         name,
         start_time AS startTime,
         end_time AS endTime,
         is_active AS isActive
       FROM meal_slots
       ORDER BY start_time, id`
    );

    return slots.map((slot) => normalizeMealSlot(slot));
  });
}

/**
 * Returns all dining tables, including inactive ones.
 *
 * @returns {Promise<DiningTableDTO[]>}
 */
export async function getDiningTables() {
  return withTransaction(async ({ allAsync }) => {
    /** @type {DiningTableRow[]} */
    const tables = await allAsync(
      `SELECT
         id,
         name,
         seat_count AS seatCount,
         is_active AS isActive
       FROM dining_tables
       ORDER BY name, id`
    );

    return tables.map((table) => normalizeDiningTable(table));
  });
}

/**
 * Returns assigned tables and configured capacity.
 * Returns null if the slot does not exist.
 *
 * @param {number} slotId
 * @returns {Promise<MealSlotCapacityDTO | null>}
 */
export async function getMealSlotCapacity(slotId) {
  return withTransaction((queries) =>
    readMealSlotCapacity(slotId, queries)
  );
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
  { name, startTime, endTime, isActive }
) {
  return withTransaction(async ({ runAsync, getAsync }) => {
    const result = await runAsync(
      `UPDATE meal_slots
       SET name = ?,
           start_time = ?,
           end_time = ?,
           is_active = ?
       WHERE id = ?`,
      [name, startTime, endTime, isActive ? 1 : 0, slotId]
    );

    if (result.changes === 0) return null;

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
      [slotId]
    );

    return normalizeMealSlot(slot);
  });
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
  { name, seatCount, isActive }
) {
  return withTransaction(async ({ runAsync, getAsync }) => {
    const result = await runAsync(
      `UPDATE dining_tables
       SET name = ?,
           seat_count = ?,
           is_active = ?
       WHERE id = ?`,
      [name, seatCount, isActive ? 1 : 0, tableId]
    );

    if (result.changes === 0) return null;

    /** @type {DiningTableRow | undefined} */
    const table = await getAsync(
      `SELECT
         id,
         name,
         seat_count AS seatCount,
         is_active AS isActive
       FROM dining_tables
       WHERE id = ?`,
      [tableId]
    );

    return normalizeDiningTable(table);
  });
}

/**
 * Replaces all table assignments in a single transaction.
 * An empty list clears assignments; duplicate IDs are ignored.
 * Inactive tables can be assigned, but do not contribute to capacity.
 * Returns null if the slot does not exist.
 *
 * @param {number} slotId
 * @param {number[]} tableIds
 * @returns {Promise<MealSlotCapacityDTO | null>}
 * @throws {TypeError} If tableIds is not an array of integers.
 * @throws {DiningTablesNotFoundError} If a requested table does not exist.
 */
export async function setMealSlotTables(slotId, tableIds) {
  // SQLite would bind true as 1 and match '1' to table 1, so reject non-integers.
  if (
    !Array.isArray(tableIds)
    || !tableIds.every((tableId) => Number.isInteger(tableId))
  ) {
    throw new TypeError('Table IDs must be provided as an array of integers.');
  }

  const uniqueTableIds = [...new Set(tableIds)];

  return withTransaction(async (queries) => {
    const { runAsync, getAsync, allAsync } = queries;

    const slot = await getAsync(
      'SELECT id FROM meal_slots WHERE id = ?',
      [slotId]
    );

    if (!slot) return null;

    // Validate every table before changing the existing assignments.
    if (uniqueTableIds.length > 0) {
      const placeholders = uniqueTableIds.map(() => '?').join(', ');

      /** @type {{ id: number }[]} */
      const existingTables = await allAsync(
        `SELECT id
         FROM dining_tables
         WHERE id IN (${placeholders})`,
        uniqueTableIds
      );

      const existingTableIds = new Set(
        existingTables.map((table) => table.id)
      );

      const missingTableIds = uniqueTableIds.filter(
        (tableId) => !existingTableIds.has(tableId)
      );

      if (missingTableIds.length > 0) {
        throw new DiningTablesNotFoundError(missingTableIds);
      }
    }

    await runAsync(
      'DELETE FROM slot_tables WHERE slot_id = ?',
      [slotId]
    );

    for (const tableId of uniqueTableIds) {
      await runAsync(
        `INSERT INTO slot_tables (slot_id, table_id)
         VALUES (?, ?)`,
        [slotId, tableId]
      );
    }

    // Reuse the current transaction instead of opening another one.
    return readMealSlotCapacity(slotId, queries);
  });
}