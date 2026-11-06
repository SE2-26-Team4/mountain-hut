import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest';

import {
  allAsync,
  getAsync,
  runAsync,
  withTransaction,
} from '../../db.js';

// Create a connection-local temporary table without altering the application schema.
beforeAll(async () => {
  await runAsync(`
    CREATE TEMP TABLE database_helpers_test (
      id INTEGER PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);
});

// Clear saved rows before each test.
beforeEach(async () => {
  await runAsync('DELETE FROM database_helpers_test');
});

// Remove the temporary table after all tests.
afterAll(async () => {
  await runAsync('DROP TABLE IF EXISTS database_helpers_test');
});

describe('database query errors', () => {
  // The write helper must propagate invalid SQL errors.
  it('rejects invalid SQL passed to runAsync', async () => {
    await expect(
      runAsync('THIS IS NOT VALID SQL'),
    ).rejects.toMatchObject({
      code: 'SQLITE_ERROR',
    });
  });

  // The multiple-row query helper must propagate invalid SQL errors.
  it('rejects invalid SQL passed to allAsync', async () => {
    await expect(
      allAsync('THIS IS NOT VALID SQL'),
    ).rejects.toMatchObject({
      code: 'SQLITE_ERROR',
    });
  });

  // The single-row query helper must propagate invalid SQL errors.
  it('rejects invalid SQL passed to getAsync', async () => {
    await expect(
      getAsync('THIS IS NOT VALID SQL'),
    ).rejects.toMatchObject({
      code: 'SQLITE_ERROR',
    });
  });
});

describe('database transactions', () => {
  // Successful transactions must persist changes and return the callback result.
  it('commits changes and returns the callback result', async () => {
    const result = await withTransaction(async (queries) => {
      await queries.runAsync(
        'INSERT INTO database_helpers_test (id, value) VALUES (?, ?)',
        [1, 'saved'],
      );

      // Read the inserted value within the same transaction.
      const row = await queries.getAsync(
        'SELECT value FROM database_helpers_test WHERE id = ?',
        [1],
      );

      return row.value;
    });

    expect(result).toBe('saved');

    // Verify that the inserted row remains available after the commit.
    const rows = await allAsync(
      'SELECT id, value FROM database_helpers_test',
    );

    expect(rows).toEqual([
      { id: 1, value: 'saved' },
    ]);
  });

  // A failed statement must roll back every earlier write in the transaction.
  it('rolls back all changes when a statement fails', async () => {
    const operation = withTransaction(async (queries) => {
      await queries.runAsync(
        'INSERT INTO database_helpers_test (id, value) VALUES (?, ?)',
        [1, 'must be rolled back'],
      );

      // Reusing the primary key forces a constraint failure.
      await queries.runAsync(
        'INSERT INTO database_helpers_test (id, value) VALUES (?, ?)',
        [1, 'duplicate ID'],
      );
    });

    await expect(operation).rejects.toMatchObject({
      code: 'SQLITE_CONSTRAINT',
    });

    // The first insert must also be removed by the rollback.
    const rows = await allAsync(
      'SELECT * FROM database_helpers_test',
    );

    expect(rows).toEqual([]);
  });

  // A rejected transaction must not prevent later transactions from succeeding.
  it('allows another transaction after a previous failure', async () => {
    const failure = new Error('Simulated operation failure');

    await expect(
      withTransaction(async () => {
        throw failure;
      }),
    ).rejects.toBe(failure);

    await withTransaction(async (queries) => {
      await queries.runAsync(
        'INSERT INTO database_helpers_test (id, value) VALUES (?, ?)',
        [2, 'saved after failure'],
      );
    });

    // Verify that the subsequent transaction committed its write.
    const row = await getAsync(
      'SELECT value FROM database_helpers_test WHERE id = ?',
      [2],
    );

    expect(row.value).toBe('saved after failure');
  });

  // Queued transactions must finish in order without interleaving callbacks.
  it('runs queued transactions sequentially', async () => {
    const events = [];

    const first = withTransaction(async (queries) => {
      events.push('first started');

      await queries.runAsync(
        'INSERT INTO database_helpers_test (id, value) VALUES (?, ?)',
        [1, 'first'],
      );

      events.push('first finished');
    });

    const second = withTransaction(async (queries) => {
      events.push('second started');

      // The second transaction must see the first transaction's saved row.
      const rows = await queries.allAsync(
        'SELECT id FROM database_helpers_test',
      );

      expect(rows).toEqual([{ id: 1 }]);

      events.push('second finished');
    });

    await Promise.all([first, second]);

    expect(events).toEqual([
      'first started',
      'first finished',
      'second started',
      'second finished',
    ]);
  });

  // A rollback failure must not replace the original callback error.
  it('preserves the original error if rollback also fails', async () => {
    const failure = new Error('Original operation failure');

    const operation = withTransaction(async (queries) => {
      // End the transaction deliberately so the outer rollback fails.
      await queries.runAsync('ROLLBACK');

      throw failure;
    });

    await expect(operation).rejects.toBe(failure);

    // The connection must remain usable after both failures.
    await expect(
      withTransaction(async () => 'connection still usable'),
    ).resolves.toBe('connection still usable');
  });
});