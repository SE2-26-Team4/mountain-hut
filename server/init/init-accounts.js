import { getAsync, runAsync } from '../db.js';
import { hashPassword } from '../services/password.js';

// Seed demo accounts only when explicitly enabled; preserve existing accounts.
export async function initializeAccounts() {
  if (process.env.SEED_DEMO_ACCOUNTS !== 'true') {
    return;
  }

  await initializeEmployeeAccount();
  await initializeHikerAccount(
    process.env.TEST_HIKER_EMAIL ?? 'hiker@example.com',
    process.env.TEST_HIKER_PASSWORD ?? 'HikerTest123!',
    'Test Hiker',
    'Local test hiker'
  );
  await initializeHikerAccount(
    process.env.EMAIL_TEST_HIKER_EMAIL ?? 'delivered@resend.dev',
    process.env.EMAIL_TEST_HIKER_PASSWORD ?? 'EmailTest123!',
    'Email Test Hiker',
    'Email test hiker'
  );
}

async function initializeHikerAccount(emailValue, password, fullName, label) {
  const email = emailValue.trim().toLowerCase();
  if (!email || !password) {
    throw new Error('Test hiker email and password must not be empty.');
  }

  const existingUser = await getAsync(
    'SELECT id FROM users WHERE email = ?',
    [email],
  );

  if (existingUser) {
    console.log(`${label} account is ready.`);
    return;
  }

  const passwordHash = await hashPassword(password);

  await runAsync(
    `INSERT INTO users (full_name, email, password_hash, role)
     VALUES (?, ?, ?, 'hiker')`,
    [fullName, email, passwordHash],
  );

  console.log(`${label} account created.`);
}

async function initializeEmployeeAccount() {
  const email = (
    process.env.TEST_EMPLOYEE_EMAIL ?? 'employee@example.com'
  ).trim().toLowerCase();

  const password =
    process.env.TEST_EMPLOYEE_PASSWORD ?? 'EmployeeTest123!';

  const fullName = 'Test Employee';

  if (!email || !password) {
    throw new Error('Test employee email and password must not be empty.');
  }

  const existingEmployee = await getAsync(
    'SELECT id FROM users WHERE email = ?',
    [email],
  );

  if (existingEmployee) {
    console.log('Local test employee account is ready.');
    return;
  }

  const passwordHash = await hashPassword(password);

  await runAsync(
    `INSERT INTO users (full_name, email, password_hash, role)
     VALUES (?, ?, ?, 'employee')`,
    [fullName, email, passwordHash],
  );

  console.log('Local test employee account created.');
}
