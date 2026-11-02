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

const state = vi.hoisted(() => ({
  openedPaths: [],
}));

// Record the requested path, but always open an isolated in-memory database.
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

let db;

beforeEach(() => {
  vi.resetModules();

  state.openedPaths.length = 0;

  vi.stubEnv('NODE_ENV', 'test');
  vi.stubEnv('DB_PATH', ':memory:');
});

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
    db = undefined;
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  }
});

async function loadDatabase() {
  db = await import('../../db.js');

  return db;
}

describe('database initialization', () => {
  it('creates the expected tables and enables foreign keys', async () => {
    await loadDatabase();
    await db.initializeDatabase();

    const tables = await db.allAsync(
      "SELECT name FROM sqlite_master WHERE type = 'table'",
    );

    expect(tables.map((table) => table.name)).toEqual(
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

  it('preserves existing data when initialized again', async () => {
    await loadDatabase();
    await db.initializeDatabase();

    const result = await db.runAsync(
      `INSERT INTO meal_slots (name, start_time, end_time)
       VALUES (?, ?, ?)`,
      ['Test Dinner', '18:00', '20:00'],
    );

    await db.initializeDatabase();

    expect(
      await db.getAsync(
        `SELECT id, name, start_time, end_time
         FROM meal_slots
         WHERE id = ?`,
        [result.lastID],
      ),
    ).toEqual({
      id: result.lastID,
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

  it('rejects an incomplete schema', async () => {
    await loadDatabase();

    await db.runAsync(
      'CREATE TABLE users (id INTEGER PRIMARY KEY)',
    );

    await expect(db.initializeDatabase()).rejects.toThrow(
      'Database schema is incomplete.',
    );
  });

  it('rejects a missing schema file without deleting the real file', async () => {
    await loadDatabase();

    const schemaPath = fileURLToPath(
      new URL('../../mountain-hut-schema.sql', import.meta.url),
    );

    const originalExistsSync = fs.existsSync.bind(fs);

    vi.spyOn(fs, 'existsSync').mockImplementation((filename) => {
      if (String(filename) === schemaPath) {
        return false;
      }

      return originalExistsSync(filename);
    });

    await expect(db.initializeDatabase()).rejects.toThrow(
      `Database schema file not found: ${schemaPath}`,
    );
  });
});

describe('default database paths', () => {
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

      expect(path.normalize(state.openedPaths[0])).toBe(
        path.normalize(expectedPath),
      );

      await expect(
        db.getAsync('SELECT 1 AS value'),
      ).resolves.toEqual({
        value: 1,
      });
    },
  );
});