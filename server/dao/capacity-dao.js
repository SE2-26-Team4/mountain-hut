import { withTransaction } from '../db.js';

/**
 * API data types used to configure meal slots and dining tables.
 *
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
 * Reports table IDs that do not exist when assigning tables to a slot.
 * The API can distinguish invalid table references from a missing slot.
 */
export class DiningTablesNotFoundError extends Error {
  /**
   * @param {number[]} missingTableIds
   */
  constructor(missingTableIds) {
    super('One or more dining tables were not found.');

    this.name = 'DiningTablesNotFoundError';
    this.code = 'DINING_TABLES_NOT_FOUND';
    this.missingTableIds = missingTableIds;
  }
}

/**
 * Reports a name already used by another record.
 */
export class DuplicateNameError extends Error {
  /**
   * @param {'meal slot' | 'dining table'} entity
   * @param {string} name
   */
  constructor(entity, name) {
    super(`A ${entity} named "${name}" already exists.`);

    this.name = 'DuplicateNameError';
    this.code = 'DUPLICATE_NAME';
  }
}

/**
 * Reports configuration changes that would invalidate confirmed bookings.
 */
export class CapacityConflictError extends Error {
  constructor() {
    super(
      'This change conflicts with existing confirmed bookings.'
    );

    this.name = 'CapacityConflictError';
    this.code = 'CAPACITY_CONFLICT';
  }
}

/**
 * Reports a table assigned to overlapping active slots on the same date.
 */
export class TableSlotConflictError extends Error {
  /**
   * @param {string} tableName
   * @param {string} slotName
   */
  constructor(tableName, slotName) {
    super(
      `Table "${tableName}" is already assigned to the active slot "${slotName}" with overlapping times.`
    );

    this.name = 'TableSlotConflictError';
    this.code = 'TABLE_SLOT_CONFLICT';
  }
}

/**
 * Reports an existing slot with the same date, name, and time range.
 */
export class DuplicateMealSlotError extends Error {
  constructor() {
    super(
      'A meal slot with the same date, name, start time and end time already exists.'
    );

    this.name = 'DuplicateMealSlotError';
    this.code = 'DUPLICATE_MEAL_SLOT';
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
 * Converts the database's numeric active status to a boolean.
 * Returns null when no meal-slot record is available.
 *
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
 * Converts the database's numeric active status to a boolean.
 * Returns null when no dining-table record is available.
 *
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
  // Retrieve the slot's identity before loading its assigned tables.
  /** @type {{ slotId: number, slotName: string } | undefined} */
  const slot = await getAsync(
    `SELECT id AS slotId, name AS slotName
     FROM meal_slots
     WHERE id = ?`,
    [slotId]
  );

  if (!slot) return null;

  // Include all assigned tables, ordered by name and ID.
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

  // Convert database active flags to the boolean values expected by the API.
  const normalizedTables = tables.map(
    (table) => normalizeDiningTable(table)
  );

  // Return every assigned table, but count seats only from active tables.
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

/**
 * Rejects a name already used by another record, ignoring letter case.
 * Runs inside the caller's transaction.
 *
 * @param {TransactionQueries['getAsync']} getAsync
 * @param {'meal_slots' | 'dining_tables'} tableName
 * @param {string} name
 * @param {number} [excludedId] - Record being updated, which may keep its name.
 * @returns {Promise<void>}
 * @throws {DuplicateNameError} If the name is already used.
 */
async function assertNameAvailable(getAsync, tableName, name, excludedId) {
  // Exclude the record being updated so it can retain its current name.
  const existing = await getAsync(
    `SELECT id
     FROM ${tableName}
     WHERE name = ? COLLATE NOCASE
       AND id <> ?`,
    [name, excludedId ?? 0]
  );

  if (existing) {
    throw new DuplicateNameError(
      'dining table',
      name
    );
  }
}

/**
 * Returns today's calendar date in the hut's time zone.
 */
function getTodayInHutTimeZone() {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Rome',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());

  /** @param {Intl.DateTimeFormatPartTypes} type */
  const value = (type) =>
    parts.find((part) => part.type === type)?.value;

  return `${value('year')}-${value('month')}-${value('day')}`;
}

/**
 * Rejects using the same table in overlapping active slots
 * on the same date. Consecutive slots are allowed.
 *
 * @param {TransactionQueries['getAsync']} getAsync
 * @param {number} slotId
 * @param {string} slotDate
 * @param {string} startTime
 * @param {string} endTime
 * @param {number[]} tableIds
 * @returns {Promise<void>}
 */
async function assertNoTableSlotOverlap(
  getAsync,
  slotId,
  slotDate,
  startTime,
  endTime,
  tableIds,
) {
  // An empty assignment cannot overlap with another slot.
  if (tableIds.length === 0) return;

  // Bind one SQL parameter for each table being checked.
  const placeholders = tableIds.map(() => '?').join(', ');

  // Strict time comparisons allow one slot to start when another ends.
  const conflict = await getAsync(
    `SELECT
       t.name AS tableName,
       s.name AS slotName
     FROM slot_tables AS st
     JOIN meal_slots AS s ON s.id = st.slot_id
     JOIN dining_tables AS t ON t.id = st.table_id
     WHERE st.table_id IN (${placeholders})
       AND s.id <> ?
       AND s.slot_date = ?
       AND s.is_active = 1
       AND s.start_time < ?
       AND s.end_time > ?
     ORDER BY s.start_time, s.id, t.id
     LIMIT 1`,
    [...tableIds, slotId, slotDate, endTime, startTime]
  );

  // Report the first conflicting table and slot.
  if (conflict) {
    throw new TableSlotConflictError(
      conflict.tableName,
      conflict.slotName,
    );
  }
}

/**
 * Rejects duplicate slots on the same date.
 *
 * @param {TransactionQueries['getAsync']} getAsync
 * @param {string} slotDate
 * @param {string} name
 * @param {string} startTime
 * @param {string} endTime
 * @param {number} [excludedId]
 * @returns {Promise<void>}
 */
async function assertMealSlotAvailable(
  getAsync,
  slotDate,
  name,
  startTime,
  endTime,
  excludedId,
) {
  // Compare names without surrounding whitespace or letter-case differences.
  // Exclude the current record when checking an update.
  const existing = await getAsync(
    `SELECT id
     FROM meal_slots
     WHERE slot_date = ?
       AND trim(name) = trim(?) COLLATE NOCASE
       AND start_time = ?
       AND end_time = ?
       AND id <> ?`,
    [slotDate, name, startTime, endTime, excludedId ?? 0]
  );

  if (existing) {
    throw new DuplicateMealSlotError();
  }
}

/* CREATE */

/**
 * Creates a meal slot after checking for duplicates.
 *
 * @param {MealSlotInputDTO} input
 * @returns {Promise<MealSlotDTO | null>}
 * @throws {DuplicateMealSlotError} If the same slot already exists.
 */
export async function createMealSlot({
  slotDate,
  name,
  startTime,
  endTime,
  isActive = true,
}) {
  // Keep the duplicate check and insertion in the same transaction.
  return withTransaction(async ({ runAsync, getAsync }) => {
    await assertMealSlotAvailable(
      getAsync,
      slotDate,
      name,
      startTime,
      endTime,
    );

    // Store boolean active status as a SQLite integer.
    const result = await runAsync(
      `INSERT INTO meal_slots (
        slot_date, name, start_time, end_time, is_active
      )
      VALUES (?, ?, ?, ?, ?)`,
      [slotDate, name, startTime, endTime, isActive ? 1 : 0]
    );

    // Read the inserted record using API property names.
    /** @type {MealSlotRow | undefined} */
    const slot = await getAsync(
      `SELECT
         id,
         name,
         slot_date AS slotDate,
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
 * Creates a reusable dining table with a unique name.
 *
 * @param {DiningTableInputDTO} input
 * @returns {Promise<DiningTableDTO | null>}
 * @throws {DuplicateNameError} If another dining table uses the name.
 */
export async function createDiningTable({
  name,
  seatCount,
  isActive = true,
}) {
  return withTransaction(async ({ runAsync, getAsync }) => {
    // Prevent case-insensitive duplicate table names.
    await assertNameAvailable(getAsync, 'dining_tables', name);

    // Save the table independently of any meal-slot assignment.
    const result = await runAsync(
      `INSERT INTO dining_tables (name, seat_count, is_active)
       VALUES (?, ?, ?)`,
      [name, seatCount, isActive ? 1 : 0]
    );

    // Read and normalize the newly created table.
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
    // Order slots by start time, then by ID for stable results.
    /** @type {MealSlotRow[]} */
    const slots = await allAsync(
      `SELECT
         id,
         name,
         slot_date AS slotDate,
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
    // Return reusable table definitions ordered by name and ID.
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
  // Open a transaction and delegate the capacity calculation to the helper.
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
 * @throws {DuplicateMealSlotError} If the same slot already exists.
 */
export async function updateMealSlot(
  slotId,
  { slotDate, name, startTime, endTime, isActive }
) {
  // Validate booking safety and save the update atomically.
  return withTransaction(async ({
    runAsync,
    getAsync,
    allAsync,
  }) => {
    // Load the existing values to determine which fields are changing.
    const existingSlot = await getAsync(
      `SELECT
        id,
        slot_date AS slotDate,
        start_time AS startTime,
        end_time AS endTime,
        is_active AS isActive
      FROM meal_slots
      WHERE id = ?`,
      [slotId]
    );

    if (!existingSlot) return null;

    // A slot with any confirmed booking cannot move to another date.
    const dateChanged = existingSlot.slotDate !== slotDate;

    if (dateChanged) {
      const confirmedBooking = await getAsync(
        `SELECT id
        FROM bookings
        WHERE slot_id = ?
          AND status = 'confirmed'
        LIMIT 1`,
        [slotId]
      );

      if (confirmedBooking) {
        throw new CapacityConflictError();
      }
    }

    // Detect changes that could disrupt current or future reservations.
    const timesChanged =
      existingSlot.startTime !== startTime ||
      existingSlot.endTime !== endTime;

    const isBeingDeactivated =
      Boolean(existingSlot.isActive) && !isActive;

    // Protect confirmed bookings dated today or later.
    if (timesChanged || isBeingDeactivated) {
      const confirmedBooking = await getAsync(
        `SELECT id
        FROM bookings
        WHERE slot_id = ?
          AND status = 'confirmed'
          AND booking_date >= ?
        LIMIT 1`,
        [slotId, getTodayInHutTimeZone()]
      );

      if (confirmedBooking) {
        throw new CapacityConflictError();
      }
    }

    // Reject a duplicate while allowing the slot to retain its own values.
    await assertMealSlotAvailable(
      getAsync,
      slotDate,
      name,
      startTime,
      endTime,
      slotId,
    );

    if (isActive) {
      // Check existing assignments against the proposed date and time range.
      /** @type {{ tableId: number }[]} */
      const assignedTables = await allAsync(
        `SELECT table_id AS tableId
        FROM slot_tables
        WHERE slot_id = ?`,
        [slotId]
      );

      await assertNoTableSlotOverlap(
        getAsync,
        slotId,
        slotDate,
        startTime,
        endTime,
        assignedTables.map((table) => table.tableId),
      );
    }

    // Persist the slot only after every conflict check passes.
    await runAsync(
      `UPDATE meal_slots
      SET slot_date = ?,
          name = ?,
          start_time = ?,
          end_time = ?,
          is_active = ?
      WHERE id = ?`,
      [slotDate, name, startTime, endTime, isActive ? 1 : 0, slotId]
    );

    // Return the updated record with a boolean active flag.
    /** @type {MealSlotRow | undefined} */
    const slot = await getAsync(
      `SELECT
         id,
         name,
         slot_date AS slotDate,
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
 * @throws {DuplicateNameError} If another dining table uses the name.
 */
export async function updateDiningTable(
  tableId,
  { name, seatCount, isActive }
) {
  return withTransaction(async ({ runAsync, getAsync }) => {
    // Report a missing table before checking for a name conflict.
    const existingTable = await getAsync(
      'SELECT id FROM dining_tables WHERE id = ?',
      [tableId]
    );

    if (!existingTable) return null;

    // Allow the table to retain its own name.
    await assertNameAvailable(getAsync, 'dining_tables', name, tableId);

    // Reject capacity reductions below the seats already reserved per slot.
    // Deactivation is checked as a proposed capacity of zero.
    const conflict = await getAsync(
      `SELECT 1
      FROM booking_table_allocations AS a
      JOIN bookings AS b ON b.id = a.booking_id
      WHERE a.table_id = ?
        AND b.status = 'confirmed'
        AND b.booking_date >= ?
      GROUP BY b.booking_date, b.slot_id
      HAVING SUM(a.seats_reserved) > ?
      LIMIT 1`,
      [
        tableId,
        getTodayInHutTimeZone(),
        isActive ? seatCount : 0,
      ]
    );

    if (conflict) {
      throw new CapacityConflictError();
    }

    // Update the reusable table definition after validating booking safety.
    await runAsync(
      `UPDATE dining_tables
       SET name = ?,
           seat_count = ?,
           is_active = ?
       WHERE id = ?`,
      [name, seatCount, isActive ? 1 : 0, tableId]
    );

    // Retrieve and normalize the saved table.
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
  // Reject values SQLite could otherwise coerce into matching numeric IDs.
  if (
    !Array.isArray(tableIds) ||
    !tableIds.every((tableId) => Number.isInteger(tableId))
  ) {
    throw new TypeError('Table IDs must be provided as an array of integers.');
  }

  // Store each table assignment only once.
  const uniqueTableIds = [...new Set(tableIds)];

  // Validate and replace assignments within the same transaction.
  return withTransaction(async (queries) => {
    const { runAsync, getAsync, allAsync } = queries;

    // Read the slot details needed for overlap checks.
    const slot = await getAsync(
      `SELECT
        id,
        slot_date AS slotDate,
        start_time AS startTime,
        end_time AS endTime,
        is_active AS isActive
      FROM meal_slots
      WHERE id = ?`,
      [slotId]
    );

    if (!slot) return null;

    // Validate every requested table before changing existing assignments.
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

      // Identify requested IDs that are missing from the database.
      const missingTableIds = uniqueTableIds.filter(
        (tableId) => !existingTableIds.has(tableId)
      );

      if (missingTableIds.length > 0) {
        throw new DiningTablesNotFoundError(missingTableIds);
      }
    }

    // Active slots cannot share a table with overlapping active slots.
    if (slot.isActive) {
      await assertNoTableSlotOverlap(
        getAsync,
        slotId,
        slot.slotDate,
        slot.startTime,
        slot.endTime,
        uniqueTableIds,
      );
    }

    // Restrict the booking check to tables that would be removed.
    // With an empty selection, every existing allocation is checked.
    const retainedClause = uniqueTableIds.length > 0
      ? `AND a.table_id NOT IN (${
          uniqueTableIds.map(() => '?').join(', ')
        })`
      : '';

    // Prevent removing tables used by confirmed bookings dated today or later.
    const conflict = await getAsync(
      `SELECT 1
      FROM booking_table_allocations AS a
      JOIN bookings AS b ON b.id = a.booking_id
      WHERE b.slot_id = ?
        AND b.status = 'confirmed'
        AND b.booking_date >= ?
        ${retainedClause}
      LIMIT 1`,
      [
        slotId,
        getTodayInHutTimeZone(),
        ...uniqueTableIds,
      ]
    );

    if (conflict) {
      throw new CapacityConflictError();
    }

    // Replace the previous assignment with the complete requested set.
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

    // Return the updated capacity without opening a nested transaction.
    return readMealSlotCapacity(slotId, queries);
  });
}