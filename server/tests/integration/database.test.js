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

  // Existing databases must gain the special_requests column automatically.
  it('adds special_requests to an existing database', async () => {
    await loadDatabase();
    await db.initializeDatabase();

    // Simulate an older bookings table without special_requests.
    await db.runAsync('PRAGMA foreign_keys = OFF');

    await db.runAsync(`
      CREATE TABLE bookings_old AS
      SELECT
        id,
        hiker_id,
        booking_date,
        slot_id,
        party_size,
        status,
        created_at
      FROM bookings
    `);

    await db.runAsync('DROP TABLE bookings');

    await db.runAsync(
      'ALTER TABLE bookings_old RENAME TO bookings',
    );

    await db.initializeDatabase();

    const columns = await db.allAsync(
      'PRAGMA table_info(bookings)',
    );

    const specialRequestsColumn = columns.find(
      (column) => column.name === 'special_requests',
    );

    expect(specialRequestsColumn).toBeDefined();
    expect(specialRequestsColumn.notnull).toBe(1);
    expect(specialRequestsColumn.dflt_value).toBe("''");
  });

  it('migrates legacy meal slots to dates used by their bookings', async () => {
    await loadDatabase();
    await db.initializeDatabase();

    await db.runAsync('PRAGMA foreign_keys = OFF');
    await db.runAsync('DROP TABLE slot_tables');
    await db.runAsync('DROP TABLE bookings');
    await db.runAsync('DROP TABLE meal_slots');

    await db.runAsync(`
      CREATE TABLE meal_slots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        start_time TEXT NOT NULL,
        end_time TEXT NOT NULL,
        is_active INTEGER NOT NULL DEFAULT 1
      )
    `);
    await db.runAsync(`
      CREATE TABLE bookings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        hiker_id INTEGER NOT NULL REFERENCES users(id),
        booking_date TEXT NOT NULL,
        slot_id INTEGER NOT NULL REFERENCES meal_slots(id),
        party_size INTEGER NOT NULL,
        special_requests TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'confirmed',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await db.runAsync(`
      CREATE TABLE slot_tables (
        slot_id INTEGER NOT NULL REFERENCES meal_slots(id),
        table_id INTEGER NOT NULL REFERENCES dining_tables(id),
        PRIMARY KEY (slot_id, table_id)
      )
    `);

    const user = await db.runAsync(
      `INSERT INTO users (
         full_name, email, password_hash, role
       )
       VALUES (?, ?, ?, ?)`,
      ['Migration test', 'migration@example.com', 'hash', 'hiker'],
    );
    const table = await db.runAsync(
      `INSERT INTO dining_tables (name, seat_count)
       VALUES (?, ?)`,
      ['Migration table', 4],
    );

    await db.runAsync(
      `INSERT INTO meal_slots (
         id, name, start_time, end_time, is_active
       )
       VALUES (?, ?, ?, ?, ?)`,
      [7, 'Dinner', '18:00', '20:00', 1],
    );
    await db.runAsync(
      'INSERT INTO slot_tables (slot_id, table_id) VALUES (?, ?)',
      [7, table.lastID],
    );

    for (const [bookingDate, partySize] of [
      ['2099-12-30', 2],
      ['2099-12-31', 3],
    ]) {
      await db.runAsync(
        `INSERT INTO bookings (
           hiker_id, booking_date, slot_id, party_size
         )
         VALUES (?, ?, ?, ?)`,
        [user.lastID, bookingDate, 7, partySize],
      );
    }

    await db.initializeDatabase();

    const migratedSlots = await db.allAsync(
      `SELECT id, slot_date, name, start_time, end_time
       FROM meal_slots
       ORDER BY slot_date`,
    );

    expect(migratedSlots).toEqual([
      {
        id: 7,
        slot_date: '2099-12-30',
        name: 'Dinner',
        start_time: '18:00',
        end_time: '20:00',
      },
      {
        id: 8,
        slot_date: '2099-12-31',
        name: 'Dinner',
        start_time: '18:00',
        end_time: '20:00',
      },
    ]);

    expect(
      await db.allAsync(
        `SELECT bookings.booking_date, meal_slots.slot_date
         FROM bookings
         JOIN meal_slots ON meal_slots.id = bookings.slot_id
         ORDER BY bookings.booking_date`,
      ),
    ).toEqual([
      { booking_date: '2099-12-30', slot_date: '2099-12-30' },
      { booking_date: '2099-12-31', slot_date: '2099-12-31' },
    ]);

    expect(
      await db.allAsync(
        'SELECT slot_id, table_id FROM slot_tables ORDER BY slot_id',
      ),
    ).toEqual([
      { slot_id: 7, table_id: table.lastID },
      { slot_id: 8, table_id: table.lastID },
    ]);
    expect(
      await db.getAsync('PRAGMA foreign_keys'),
    ).toEqual({ foreign_keys: 1 });
    expect(
      await db.allAsync('PRAGMA foreign_key_check'),
    ).toEqual([]);
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