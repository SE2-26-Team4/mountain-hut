import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

// Use a real SQLite database in memory, regardless of the configured path.
vi.mock('sqlite3', async () => {
  const actual = await vi.importActual('sqlite3');

  return {
    default: {
      ...actual.default,
      Database: function () {
        return new actual.default.Database(':memory:');
      },
    },
  };
});

let db;

beforeEach(async () => {
  vi.resetModules();

  vi.stubEnv('SEED_DEMO_ACCOUNTS', 'true');

  for (const key of [
    'TEST_HIKER_EMAIL',
    'TEST_HIKER_PASSWORD',
    'EMAIL_TEST_HIKER_EMAIL',
    'EMAIL_TEST_HIKER_PASSWORD',
    'TEST_EMPLOYEE_EMAIL',
    'TEST_EMPLOYEE_PASSWORD',
  ]) {
    vi.stubEnv(key, undefined);
  }

  db = await import('../../db.js');

  await db.initializeDatabase();
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
    vi.unstubAllEnvs();
  }
});

describe('demo account initialization', () => {
  it('creates no accounts when seeding is disabled', async () => {
    vi.stubEnv('SEED_DEMO_ACCOUNTS', 'false');

    const { initializeAccounts } = await import(
      '../../init/init-accounts.js'
    );

    await initializeAccounts();

    expect(await db.allAsync('SELECT * FROM users')).toEqual([]);
  });

  it('creates default accounts and preserves existing records', async () => {
    const { initializeAccounts } = await import(
      '../../init/init-accounts.js'
    );

    const { verifyPassword } = await import(
      '../../services/password.js'
    );

    await initializeAccounts();

    const before = await db.allAsync(
      'SELECT * FROM users ORDER BY id',
    );

    expect(before).toHaveLength(3);

    expect(before.map((user) => user.email).sort()).toEqual([
      'delivered@resend.dev',
      'employee@example.com',
      'hiker@example.com',
    ]);

    for (const user of before) {
      const password = {
        'employee@example.com': 'EmployeeTest123!',
        'hiker@example.com': 'HikerTest123!',
        'delivered@resend.dev': 'EmailTest123!',
      }[user.email];

      expect(
        await verifyPassword(password, user.password_hash),
      ).toBe(true);
    }

    vi.stubEnv('TEST_HIKER_PASSWORD', 'ChangedHikerPassword123!');
    vi.stubEnv('TEST_EMPLOYEE_PASSWORD', 'ChangedEmployeePassword123!');

    await initializeAccounts();

    const after = await db.allAsync(
      'SELECT * FROM users ORDER BY id',
    );

    expect(after).toEqual(before);
  });

  it('uses configured credentials and normalizes emails', async () => {
    vi.stubEnv('TEST_HIKER_EMAIL', '  HIKER-OVERRIDE@example.com  ');
    vi.stubEnv('TEST_HIKER_PASSWORD', 'CustomHiker!');
    vi.stubEnv(
      'TEST_EMPLOYEE_EMAIL',
      '  EMPLOYEE-OVERRIDE@example.com  ',
    );
    vi.stubEnv('TEST_EMPLOYEE_PASSWORD', 'CustomEmployee!');

    const { initializeAccounts } = await import(
      '../../init/init-accounts.js'
    );

    const { verifyPassword } = await import(
      '../../services/password.js'
    );

    await initializeAccounts();

    const users = await db.allAsync('SELECT * FROM users');

    expect(users).toHaveLength(3);

    for (const user of users) {
      const expectedEmail = {
        employee: 'employee-override@example.com',
        hiker: 'hiker-override@example.com',
      }[user.role];
      if (user.full_name === 'Email Test Hiker') {
        expect(user.email).toBe('delivered@resend.dev');
      } else {
        expect(user.email).toBe(expectedEmail);
      }

      const password =
        user.full_name === 'Email Test Hiker'
          ? 'EmailTest123!'
          : user.role === 'hiker'
            ? 'CustomHiker!'
            : 'CustomEmployee!';

      expect(
        await verifyPassword(password, user.password_hash),
      ).toBe(true);
    }
  });

  it.each([
    ['TEST_HIKER_EMAIL', '', 'hiker'],
    ['TEST_HIKER_EMAIL', '   ', 'hiker'],
    ['TEST_HIKER_PASSWORD', '', 'hiker'],
    ['EMAIL_TEST_HIKER_EMAIL', '', 'hiker'],
    ['EMAIL_TEST_HIKER_EMAIL', '   ', 'hiker'],
    ['EMAIL_TEST_HIKER_PASSWORD', '', 'hiker'],
    ['TEST_EMPLOYEE_EMAIL', '', 'employee'],
    ['TEST_EMPLOYEE_EMAIL', '   ', 'employee'],
    ['TEST_EMPLOYEE_PASSWORD', '', 'employee'],
  ])(
    'rejects invalid %s (%j)',
    async (variable, value, role) => {
      vi.stubEnv(variable, value);

      const { initializeAccounts } = await import(
        '../../init/init-accounts.js'
      );

      await expect(initializeAccounts()).rejects.toThrow(
        `Test ${role} email and password must not be empty.`,
      );
    },
  );
});