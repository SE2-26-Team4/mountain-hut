import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import sqlite3 from 'sqlite3';

/* DATABASE CONFIGURATION */

// [Database initialization and initial schema]: Resolve the SQLite database and schema paths.
const currentDirectory = path.dirname(fileURLToPath(import.meta.url));

const defaultDatabaseFile =
  process.env.NODE_ENV === 'test'
    ? 'mountain-hut-test.sqlite'
    : 'mountain-hut.sqlite';

// [Database initialization and initial schema]: Allow Docker to configure a persistent database path.
const databasePath =
  process.env.DB_PATH ?? path.join(currentDirectory, defaultDatabaseFile);

// [Database initialization and initial schema]: Create the SQLite directory if it does not exist.
fs.mkdirSync(path.dirname(databasePath), { recursive: true });

// [Database initialization and initial schema]: Open the SQLite database.
const schemaPath = path.join(currentDirectory, 'mountain-hut-schema.sql');
const database = new sqlite3.Database(databasePath);

/* DATABASE QUERY HELPERS */

// [Database initialization and initial schema]: Execute an SQL statement with parameters.
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

// [Database initialization and initial schema]: Retrieve multiple database records.
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

// [Minimal login setup (backend)]: Look up a single database record for authentication.
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

// [Database initialization and initial schema]: Execute multiple SQL statements.
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

/* DATABASE TRANSACTIONS */

let transactionQueue = Promise.resolve();

// [Booking data access and transaction support]: Run a group of database operations atomically.
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

  // [Booking data access and transaction support]: Keep transactions sequential even after failures.
  transactionQueue = operation.then(
    () => undefined,
    () => undefined,
  );

  return operation;
}

/* DATABASE INITIALIZATION */

// [Database initialization and initial schema]: Initialize the Mountain Hut database before accepting requests.
export async function initializeDatabase() {
  // [Database initialization and initial schema]: Enable SQLite foreign key constraints.
  await runAsync('PRAGMA foreign_keys = ON');

  const expectedTables = [
    'users',
    'meal_slots',
    'dining_tables',
    'slot_tables',
    'bookings',
    'booking_table_allocations',
  ];

  // [Database initialization and initial schema]: Check whether the expected tables already exist.
  const placeholders = expectedTables.map(() => '?').join(', ');

  const existingTables = await allAsync(
    `SELECT name
     FROM sqlite_master
     WHERE type = 'table'
       AND name IN (${placeholders})`,
    expectedTables,
  );

  // [Database initialization and initial schema]: Create the schema when the database is empty.
  if (existingTables.length === 0) {
    if (!fs.existsSync(schemaPath)) {
      throw new Error(`Database schema file not found: ${schemaPath}`);
    }

    const schema = fs.readFileSync(schemaPath, 'utf8');

    await execAsync(schema);

    console.log('Mountain Hut database schema initialized.');
    return;
  }

  // [Database initialization and initial schema]: Reject incomplete schemas to avoid inconsistent data.
  if (existingTables.length !== expectedTables.length) {
    throw new Error(
      `Database schema is incomplete. Found ${existingTables.length} of ${expectedTables.length} expected tables.`,
    );
  }

  console.log('Mountain Hut database schema is ready.');
}

export default database;
