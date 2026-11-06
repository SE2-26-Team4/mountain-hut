import { getAsync, runAsync } from '../db.js';
import { hashPassword } from '../services/password.js';

// Seed demo accounts only when explicitly enabled.
export async function initializeAccounts() {
  if (process.env.SEED_DEMO_ACCOUNTS !== 'true') {
    return;
  }

  await initializeEmployeeAccount();
  await initializeHikerAccounts();
}

async function initializeEmployeeAccount() {
  await initializeAccount({
    email: process.env.TEST_EMPLOYEE_EMAIL ?? 'employee@example.com',
    password:
      process.env.TEST_EMPLOYEE_PASSWORD ?? 'EmployeeTest123!',
    fullName: 'Test Employee',
    role: 'employee',
    label: 'Test employee',
  });
}

async function initializeHikerAccounts() {
  const universityHikers = [
    {
      studentId: 's349410',
      fullName: 'Lorenzo Bosso',
    },
    {
      studentId: 's353204',
      fullName: 'Jessica Barroero',
    },
    {
      studentId: 's356826',
      fullName: 'Masha Dolati',
    },
    {
      studentId: 's358411',
      fullName: 'Shoya Alimi',
    },
    {
      studentId: 's362713',
      fullName: 'Alessandro Michele Berardi',
    },
  ];

  const accounts = [
    {
      email: process.env.TEST_HIKER_EMAIL ?? 'hiker@example.com',
      password: process.env.TEST_HIKER_PASSWORD ?? 'HikerTest123!',
      fullName: 'Test Hiker',
      label: 'Test hiker',
    },
    ...universityHikers.map(({ studentId, fullName }) => ({
      email: `${studentId}@studenti.polito.it`,
      password: `${studentId}Test123!`,
      fullName,
      label: fullName,
    })),
  ];

  for (const account of accounts) {
    await initializeAccount({
      ...account,
      role: 'hiker',
    });

    const isUniversityDemoAccount = universityHikers.some(
      ({ studentId }) =>
        account.email === `${studentId}@studenti.polito.it`,
    );

    if (isUniversityDemoAccount) {
      await runAsync(
        `UPDATE users
         SET full_name = ?
         WHERE email = ? AND role = 'hiker'`,
        [account.fullName, account.email],
      );
    }
  }
}

/**
 * Creates an account only if its email is not already present.
 *
 * @param {Object} account
 * @param {string} account.email
 * @param {string} account.password
 * @param {string} account.fullName
 * @param {'hiker' | 'employee'} account.role
 * @param {string} account.label
 * @returns {Promise<void>}
 */
async function initializeAccount({
  email,
  password,
  fullName,
  role,
  label,
}) {
  const normalizedEmail = email.trim().toLowerCase();

  if (!normalizedEmail || !password) {
    throw new Error(
      `${label} email and password must not be empty.`,
    );
  }

  const existingUser = await getAsync(
    'SELECT id FROM users WHERE email = ?',
    [normalizedEmail],
  );

  if (existingUser) {
    console.log(`${label} account is ready.`);
    return;
  }

  const passwordHash = await hashPassword(password);

  await runAsync(
    `INSERT INTO users (
       full_name, email, password_hash, role
     )
     VALUES (?, ?, ?, ?)`,
    [fullName, normalizedEmail, passwordHash, role],
  );

  console.log(`${label} account created.`);
}