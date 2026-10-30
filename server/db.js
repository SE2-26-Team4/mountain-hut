import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import sqlite3 from 'sqlite3';

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

      // sqlite3 exposes lastID and changes through the callback's `this`.
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
      const result = await callback({ runAsync, getAsync, allAsync });

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

  // A failed transaction must not prevent subsequent transactions from running.
  transactionQueue = operation.then(
    () => undefined,
    () => undefined,
  );

  return operation;
}

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

  console.log('Mountain Hut database schema is ready.');
}

export default database;