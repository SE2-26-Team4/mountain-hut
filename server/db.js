import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import sqlite3 from 'sqlite3';

/* DATABASE TYPES */

/**
 * @typedef {string | number | null | Buffer} SqlValue
 */

/**
 * Query helpers available inside a transaction.
 *
 * @typedef {Object} TransactionQueries
 * @property {typeof runAsync} runAsync
 * @property {typeof getAsync} getAsync
 * @property {typeof allAsync} allAsync
 */

/* DATABASE CONFIGURATION */

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));

const defaultDatabaseFile =
  process.env.NODE_ENV === 'test'
    ? 'mountain-hut-test.sqlite'
    : 'mountain-hut.sqlite';

// Docker can override the path to use persistent storage.
const databasePath =
  process.env.DB_PATH ?? path.join(currentDirectory, defaultDatabaseFile);

fs.mkdirSync(path.dirname(databasePath), { recursive: true });

const schemaPath = path.join(currentDirectory, 'mountain-hut-schema.sql');
const database = new sqlite3.Database(databasePath);

/* DATABASE QUERY HELPERS */

/**
 * Executes a statement and returns its insertion/update metadata.
 *
 * @param {string} sql
 * @param {SqlValue[]} [parameters]
 * @returns {Promise<import('sqlite3').RunResult>}
 */
export function runAsync(sql, parameters = []) {
  return new Promise((resolve, reject) => {
    database.run(sql, parameters, function (error) {
      if (error) {
        reject(error);
        return;
      }

      resolve(this);
    });
  });
}

/**
 * Returns all matching rows, or an empty array.
 * Row structure depends on the query and is described by the caller.
 *
 * @param {string} sql
 * @param {SqlValue[]} [parameters]
 * @returns {Promise<any[]>}
 */
export function allAsync(sql, parameters = []) {
  return new Promise((resolve, reject) => {
    database.all(sql, parameters, (error, rows) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(rows);
    });
  });
}

/**
 * Returns the first matching row, or undefined.
 * Row structure depends on the query and is described by the caller.
 *
 * @param {string} sql
 * @param {SqlValue[]} [parameters]
 * @returns {Promise<any>}
 */
export function getAsync(sql, parameters = []) {
  return new Promise((resolve, reject) => {
    database.get(sql, parameters, (error, row) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(row);
    });
  });
}

/**
 * Executes SQL statements without returning rows.
 *
 * @param {string} sql
 * @returns {Promise<void>}
 */
function execAsync(sql) {
  return new Promise((resolve, reject) => {
    database.exec(sql, (error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

/* TRANSACTION MANAGEMENT */

let transactionQueue = Promise.resolve();

/**
 * Runs a callback within a transaction.
 * Queues transactions on this connection and rolls back on failure.
 *
 * @template T
 * @param {(queries: TransactionQueries) => T | Promise<T>} callback
 * @returns {Promise<T>}
 */
export function withTransaction(callback) {
  const operation = transactionQueue.then(async () => {
    await execAsync('BEGIN IMMEDIATE');

    try {
      const result = await callback({
        runAsync,
        getAsync,
        allAsync,
      });

      await execAsync('COMMIT');

      return result;
    } catch (error) {
      try {
        await execAsync('ROLLBACK');
      } catch {
        // Preserve the original error if rollback also fails.
      }

      throw error;
    }
  });

  transactionQueue = operation.then(
    () => undefined,
    () => undefined,
  );

  return operation;
}

/**
 * Converts legacy reusable meal slots into date-specific slots.
 * Slots referenced by bookings on multiple dates are copied per date.
 *
 * @returns {Promise<void>}
 */
async function migrateMealSlotsToDatedSchema() {
  const columns = await allAsync('PRAGMA table_info(meal_slots)');

  if (columns.some((column) => column.name === 'slot_date')) {
    return;
  }

  const slots = await allAsync(
    `SELECT id, name, start_time, end_time, is_active
     FROM meal_slots
     ORDER BY id`,
  );
  const bookings = await allAsync(
    `SELECT id, booking_date, slot_id
     FROM bookings
     ORDER BY id`,
  );
  const slotTables = await allAsync(
    'SELECT slot_id, table_id FROM slot_tables',
  );

  /** @type {Map<number, {id: number, booking_date: string, slot_id: number}[]>} */
  const bookingsBySlot = new Map();
  for (const booking of bookings) {
    const records = bookingsBySlot.get(booking.slot_id) ?? [];
    records.push(booking);
    bookingsBySlot.set(booking.slot_id, records);
  }

  /** @type {Map<number, number[]>} */
  const tablesBySlot = new Map();
  for (const assignment of slotTables) {
    const tableIds = tablesBySlot.get(assignment.slot_id) ?? [];
    tableIds.push(assignment.table_id);
    tablesBySlot.set(assignment.slot_id, tableIds);
  }

  await execAsync('PRAGMA foreign_keys = OFF');

  try {
    await execAsync('BEGIN IMMEDIATE');

    try {
      await execAsync(`
        CREATE TABLE meal_slots_migrated (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          slot_date TEXT NOT NULL,
          name TEXT NOT NULL CHECK (length(trim(name)) > 0),
          start_time TEXT NOT NULL,
          end_time TEXT NOT NULL,
          is_active INTEGER NOT NULL DEFAULT 1
            CHECK (is_active IN (0, 1))
        )
      `);

      await execAsync('DELETE FROM slot_tables');

      for (const slot of slots) {
        const slotBookings = bookingsBySlot.get(slot.id) ?? [];
        const dates = [
          ...new Set(slotBookings.map((booking) => booking.booking_date)),
        ].sort();

        if (dates.length === 0) {
          dates.push(new Date().toISOString().slice(0, 10));
        }

        /** @type {Map<string, number>} */
        const migratedIdsByDate = new Map();

        for (const [index, slotDate] of dates.entries()) {
          let migratedId;

          if (index === 0) {
            migratedId = slot.id;
            await runAsync(
              `INSERT INTO meal_slots_migrated (
                 id, slot_date, name, start_time, end_time, is_active
               )
               VALUES (?, ?, ?, ?, ?, ?)`,
              [
                migratedId,
                slotDate,
                slot.name,
                slot.start_time,
                slot.end_time,
                slot.is_active,
              ],
            );
          } else {
            const result = await runAsync(
              `INSERT INTO meal_slots_migrated (
                 slot_date, name, start_time, end_time, is_active
               )
               VALUES (?, ?, ?, ?, ?)`,
              [
                slotDate,
                slot.name,
                slot.start_time,
                slot.end_time,
                slot.is_active,
              ],
            );
            migratedId = result.lastID;
          }

          if (migratedId === undefined) {
            throw new Error('Failed to create a migrated meal slot.');
          }

          migratedIdsByDate.set(slotDate, migratedId);

          for (const tableId of tablesBySlot.get(slot.id) ?? []) {
            await runAsync(
              `INSERT INTO slot_tables (slot_id, table_id)
               VALUES (?, ?)`,
              [migratedId, tableId],
            );
          }
        }

        for (const booking of slotBookings) {
          const migratedId = migratedIdsByDate.get(booking.booking_date);

          if (migratedId === undefined) {
            throw new Error(
              `Failed to migrate meal slot ${booking.slot_id} for ${booking.booking_date}.`,
            );
          }

          await runAsync(
            'UPDATE bookings SET slot_id = ? WHERE id = ?',
            [migratedId, booking.id],
          );
        }
      }

      await execAsync('DROP TABLE meal_slots');
      await execAsync(
        'ALTER TABLE meal_slots_migrated RENAME TO meal_slots',
      );
      await execAsync(`
        CREATE UNIQUE INDEX idx_meal_slots_name_times
        ON meal_slots (
          slot_date,
          trim(name) COLLATE NOCASE,
          start_time,
          end_time
        )
      `);
      await execAsync('COMMIT');
    } catch (error) {
      try {
        await execAsync('ROLLBACK');
      } catch {
        // Preserve the migration error if rollback also fails.
      }

      throw error;
    }
  } finally {
    await execAsync('PRAGMA foreign_keys = ON');
  }

  const foreignKeyViolations = await allAsync('PRAGMA foreign_key_check');

  if (foreignKeyViolations.length > 0) {
    throw new Error(
      'Database migration left foreign key violations.',
    );
  }
}

/* DATABASE INITIALIZATION */

/**
 * Creates the schema for an empty database.
 * Rejects a database containing only part of the expected table set.
 *
 * @returns {Promise<void>}
 */
export async function initializeDatabase() {
  await runAsync('PRAGMA foreign_keys = ON');

  const expectedTables = [
    'users',
    'meal_slots',
    'dining_tables',
    'slot_tables',
    'bookings',
    'booking_table_allocations',
  ];

  const placeholders = expectedTables.map(() => '?').join(', ');

  const existingTables = await allAsync(
    `SELECT name
     FROM sqlite_master
     WHERE type = 'table'
       AND name IN (${placeholders})`,
    expectedTables,
  );

  if (existingTables.length === 0) {
    if (!fs.existsSync(schemaPath)) {
      throw new Error(`Database schema file not found: ${schemaPath}`);
    }

    const schema = fs.readFileSync(schemaPath, 'utf8');

    await execAsync(schema);

    console.log('Mountain Hut database schema initialized.');

    return;
  }

  if (existingTables.length !== expectedTables.length) {
    throw new Error(
      `Database schema is incomplete. Found ${existingTables.length} of ${expectedTables.length} expected tables.`,
    );
  }

  await migrateMealSlotsToDatedSchema();

  const bookingColumns = await allAsync(
    'PRAGMA table_info(bookings)',
  );

  if (
    !bookingColumns.some(
      (column) => column.name === 'special_requests',
    )
  ) {
    await runAsync(`
      ALTER TABLE bookings
      ADD COLUMN special_requests TEXT NOT NULL DEFAULT ''
      CHECK (length(special_requests) <= 1000)
    `);
  }

  console.log('Mountain Hut database schema is ready.');
}

export default database;