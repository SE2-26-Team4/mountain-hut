import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

// Always use an isolated SQLite database in memory.
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

// Keep the database module available for queries and cleanup.
let db;

// Define the university accounts expected alongside the default demo accounts.
const universityAccounts = [
  {
    email: 's353204@studenti.polito.it',
    role: 'hiker',
    password: 's353204Test123!',
  },
  {
    email: 's356826@studenti.polito.it',
    role: 'hiker',
    password: 's356826Test123!',
  },
  {
    email: 's358411@studenti.polito.it',
    role: 'hiker',
    password: 's358411Test123!',
  },
  {
    email: 's362713@studenti.polito.it',
    role: 'hiker',
    password: 's362713Test123!',
  },
  {
    email: 's349410@studenti.polito.it',
    role: 'hiker',
    password: 's349410Test123!',
  },
];

// Reload modules and initialize a fresh database with default seeding settings.
beforeEach(async () => {
  vi.resetModules();

  vi.stubEnv('SEED_DEMO_ACCOUNTS', 'true');

  // Remove credential overrides so each test starts with the default values.
  for (const key of [
    'TEST_HIKER_EMAIL',
    'TEST_HIKER_PASSWORD',
    'TEST_EMPLOYEE_EMAIL',
    'TEST_EMPLOYEE_PASSWORD',
  ]) {
    vi.stubEnv(key, undefined);
  }

  db = await import('../../db.js');

  await db.initializeDatabase();
});

// Close the database and restore environment variables after each test.
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

    vi.unstubAllEnvs();
  }
});

describe('demo account initialization', () => {
  // Disabled seeding must leave the users table empty.
  it('creates no accounts when seeding is disabled', async () => {
    vi.stubEnv('SEED_DEMO_ACCOUNTS', 'false');

    const { initializeAccounts } = await import(
      '../../init/init-accounts.js'
    );

    await initializeAccounts();

    expect(
      await db.allAsync('SELECT * FROM users'),
    ).toEqual([]);
  });

  // Default seeding must create the expected accounts without overwriting them.
  it('creates one employee and six hikers and preserves existing records', async () => {
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

    const expectedAccounts = [
      {
        email: 'employee@example.com',
        role: 'employee',
        password: 'EmployeeTest123!',
      },
      {
        email: 'hiker@example.com',
        role: 'hiker',
        password: 'HikerTest123!',
      },
      ...universityAccounts,
    ];

    // Verify the total number of accounts and their role distribution.
    expect(before).toHaveLength(7);

    expect(
      before.filter((user) => user.role === 'hiker'),
    ).toHaveLength(6);

    expect(
      before.filter((user) => user.role === 'employee'),
    ).toHaveLength(1);

    // Verify each account's email, role, and hashed password.
    for (const expected of expectedAccounts) {
      const user = before.find(
        (account) => account.email === expected.email,
      );

      expect(user).toBeDefined();
      expect(user.role).toBe(expected.role);

      expect(
        await verifyPassword(
          expected.password,
          user.password_hash,
        ),
      ).toBe(true);
    }

    // Change configured passwords before running account initialization again.
    vi.stubEnv(
      'TEST_HIKER_PASSWORD',
      'ChangedHikerPassword123!',
    );

    vi.stubEnv(
      'TEST_EMPLOYEE_PASSWORD',
      'ChangedEmployeePassword123!',
    );

    await initializeAccounts();

    // Existing records, including their password hashes, must remain unchanged.
    const after = await db.allAsync(
      'SELECT * FROM users ORDER BY id',
    );

    expect(after).toEqual(before);
  });

  // Configured credentials must override defaults and normalize email addresses.
  it('uses configured credentials and normalizes emails', async () => {
    vi.stubEnv(
      'TEST_HIKER_EMAIL',
      '  HIKER-OVERRIDE@example.com  ',
    );

    vi.stubEnv(
      'TEST_HIKER_PASSWORD',
      'CustomHiker!',
    );

    vi.stubEnv(
      'TEST_EMPLOYEE_EMAIL',
      '  EMPLOYEE-OVERRIDE@example.com  ',
    );

    vi.stubEnv(
      'TEST_EMPLOYEE_PASSWORD',
      'CustomEmployee!',
    );

    const { initializeAccounts } = await import(
      '../../init/init-accounts.js'
    );

    const { verifyPassword } = await import(
      '../../services/password.js'
    );

    await initializeAccounts();

    const users = await db.allAsync('SELECT * FROM users');

    const expectedAccounts = [
      {
        email: 'employee-override@example.com',
        role: 'employee',
        password: 'CustomEmployee!',
      },
      {
        email: 'hiker-override@example.com',
        role: 'hiker',
        password: 'CustomHiker!',
      },
      ...universityAccounts,
    ];

    expect(users).toHaveLength(7);

    // Verify normalized emails, assigned roles, and configured passwords.
    for (const expected of expectedAccounts) {
      const user = users.find(
        (account) => account.email === expected.email,
      );

      expect(user).toBeDefined();
      expect(user.role).toBe(expected.role);

      expect(
        await verifyPassword(
          expected.password,
          user.password_hash,
        ),
      ).toBe(true);
    }

    // Overridden demo accounts must not also be created with default emails.
    expect(
      users.some((user) => user.email === 'hiker@example.com'),
    ).toBe(false);

    expect(
      users.some((user) => user.email === 'employee@example.com'),
    ).toBe(false);
  });

  // Empty passwords and empty or whitespace-only emails must be rejected.
  it.each([
    ['TEST_HIKER_EMAIL', '', 'hiker'],
    ['TEST_HIKER_EMAIL', '   ', 'hiker'],
    ['TEST_HIKER_PASSWORD', '', 'hiker'],
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

      await expect(
        initializeAccounts(),
      ).rejects.toThrow(
        `Test ${role} email and password must not be empty.`,
      );
    },
  );
});