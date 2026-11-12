import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

// Keep requested database paths available to the hoisted SQLite mock.
const state = vi.hoisted(() => ({
  openedPaths: [],
}));

// Record the requested path while opening an isolated in-memory database.
vi.mock('sqlite3', async () => {
  const actual = await vi.importActual('sqlite3');

  return {
    default: {
      ...actual.default,
      Database: function (filename) {
        state.openedPaths.push(filename);

        return new actual.default.Database(':memory:');
      },
    },
  };
});

// Keep the imported database module available for queries and cleanup.
let db;

// Reset module state and configure an in-memory test database before each test.
beforeEach(() => {
  vi.resetModules();

  state.openedPaths.length = 0;

  vi.stubEnv('NODE_ENV', 'test');
  vi.stubEnv('DB_PATH', ':memory:');
});

// Close the database and restore mocks and environment variables after each test.
afterEach(async () => {
  try {
    if (db) {
      await new Promise((resolve, reject) => {
        db.default.close((error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        });
      });
    }
  } finally {
    // Restore test state even if closing the database fails.
    db = undefined;

    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  }
});

// Import the database module after applying the current test's environment.
async function loadDatabase() {
  db = await import('../../db.js');

  return db;
}

describe('database initialization', () => {
  // Initialization must create the application tables and enforce foreign keys.
  it('creates the expected tables and enables foreign keys', async () => {
    await loadDatabase();
    await db.initializeDatabase();

    const tables = await db.allAsync(
      "SELECT name FROM sqlite_master WHERE type = 'table'",
    );

    expect(
      tables.map((table) => table.name),
    ).toEqual(
      expect.arrayContaining([
        'users',
        'meal_slots',
        'dining_tables',
        'slot_tables',
        'bookings',
        'booking_table_allocations',
      ]),
    );

    expect(
      await db.getAsync('PRAGMA foreign_keys'),
    ).toEqual({
      foreign_keys: 1,
    });
  });

  // Repeated initialization must preserve existing records without duplicating them.
  it('preserves existing data when initialized again', async () => {
    await loadDatabase();
    await db.initializeDatabase();

    const result = await db.runAsync(
      `INSERT INTO meal_slots (
         slot_date, name, start_time, end_time
       )
       VALUES (?, ?, ?, ?)`,
      ['2099-12-30', 'Test Dinner', '18:00', '20:00'],
    );

    await db.initializeDatabase();

    // Verify that the original record retains all its saved values.
    expect(
      await db.getAsync(
        `SELECT id, slot_date, name, start_time, end_time
         FROM meal_slots
         WHERE id = ?`,
        [result.lastID],
      ),
    ).toEqual({
      id: result.lastID,
      slot_date: '2099-12-30',
      name: 'Test Dinner',
      start_time: '18:00',
      end_time: '20:00',
    });

    expect(
      await db.getAsync('SELECT COUNT(*) AS total FROM meal_slots'),
    ).toEqual({
      total: 1,
    });
  });

  // The users table must reject inconsistent accounts.
  it.each([
    [
      'a temporary hiker with an email',
      `INSERT INTO users (full_name, email, role, is_temporary)
       VALUES ('Temp', 'temp@example.com', 'hiker', 1)`,
    ],
    [
      'a temporary hiker with a password',
      `INSERT INTO users (full_name, password_hash, role, is_temporary)
       VALUES ('Temp', 'hash', 'hiker', 1)`,
    ],
    [
      'a temporary staff account',
      `INSERT INTO users (full_name, role, is_temporary)
       VALUES ('Temp', 'employee', 1)`,
    ],
    [
      'a registered account without email',
      `INSERT INTO users (full_name, password_hash, role)
       VALUES ('Registered', 'hash', 'hiker')`,
    ],
    [
      'a registered account without password',
      `INSERT INTO users (full_name, email, role)
       VALUES ('Registered', 'registered@example.com', 'hiker')`,
    ],
    [
      'an invalid must_change_password flag',
      `INSERT INTO users (
         full_name, email, password_hash, role, must_change_password
       )
       VALUES ('Registered', 'flag@example.com', 'hash', 'hiker', 2)`,
    ],
  ])('rejects %s', async (_label, sql) => {
    await loadDatabase();
    await db.initializeDatabase();

    await expect(db.runAsync(sql)).rejects.toMatchObject({
      code: 'SQLITE_CONSTRAINT',
    });
  });

  // Unique emails must still allow several temporary hikers without email.
  it('stores several temporary hikers without email', async () => {
    await loadDatabase();
    await db.initializeDatabase();

    for (const name of ['First Walk-in', 'Second Walk-in']) {
      await db.runAsync(
        `INSERT INTO users (full_name, phone, role, is_temporary)
         VALUES (?, NULL, 'hiker', 1)`,
        [name],
      );
    }

    expect(
      await db.getAsync(
        'SELECT COUNT(*) AS total FROM users WHERE is_temporary = 1',
      ),
    ).toEqual({ total: 2 });
  });

  // An existing schema that lacks required structures must be rejected.
  it('rejects an incomplete schema', async () => {
    await loadDatabase();

    await db.runAsync(
      'CREATE TABLE users (id INTEGER PRIMARY KEY)',
    );

    await expect(
      db.initializeDatabase(),
    ).rejects.toThrow('Database schema is incomplete.');
  });

  // Simulate a missing schema file by mocking its existence check.
  it('rejects a missing schema file without deleting the real file', async () => {
    await loadDatabase();

    const schemaPath = fileURLToPath(
      new URL('../../mountain-hut-schema.sql', import.meta.url),
    );

    const originalExistsSync = fs.existsSync.bind(fs);

    // Report only the schema file as missing and preserve other filesystem checks.
    vi.spyOn(fs, 'existsSync').mockImplementation((filename) => {
      if (String(filename) === schemaPath) {
        return false;
      }

      return originalExistsSync(filename);
    });

    await expect(
      db.initializeDatabase(),
    ).rejects.toThrow(
      `Database schema file not found: ${schemaPath}`,
    );
  });
});

describe('default database paths', () => {
  // Without DB_PATH, the environment must determine the default database filename.
  it.each([
    ['test', 'mountain-hut-test.sqlite'],
    ['development', 'mountain-hut.sqlite'],
  ])(
    'uses the expected filename in %s',
    async (environment, filename) => {
      vi.stubEnv('NODE_ENV', environment);
      vi.stubEnv('DB_PATH', undefined);

      await loadDatabase();

      const expectedPath = fileURLToPath(
        new URL(`../../${filename}`, import.meta.url),
      );

      // Compare normalized paths recorded by the SQLite mock.
      expect(
        path.normalize(state.openedPaths[0]),
      ).toBe(
        path.normalize(expectedPath),
      );

      // Verify that the isolated database connection remains usable.
      await expect(
        db.getAsync('SELECT 1 AS value'),
      ).resolves.toEqual({
        value: 1,
      });
    },
  );
});