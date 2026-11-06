import { randomUUID } from 'node:crypto';

import {
  afterAll,
  beforeAll,
  describe,
  expect,
  it,
} from 'vitest';

import {
  getUserByEmail,
  getUserById,
} from '../../dao/auth-dao.js';
import {
  getAsync,
  initializeDatabase,
  runAsync,
} from '../../db.js';
import { hashPassword } from '../../services/password.js';

// Generate a unique email to avoid conflicts with other test accounts.
const uniqueSuffix = randomUUID();
const testEmail = `auth-dao-${uniqueSuffix}@example.com`;
const testFullName = 'Auth DAO Test Hiker';

// Keep the inserted account's ID and password hash for assertions and cleanup.
let userId;
let passwordHash;

// Create an account used by the authentication DAO tests.
beforeAll(async () => {
  await initializeDatabase();

  passwordHash = await hashPassword('AuthDaoTest123!');

  const result = await runAsync(
    `INSERT INTO users (full_name, email, password_hash, role)
     VALUES (?, ?, ?, ?)`,
    [testFullName, testEmail, passwordHash, 'hiker'],
  );

  userId = result.lastID;
});

// Remove the test account if setup inserted it successfully.
afterAll(async () => {
  if (userId !== undefined) {
    await runAsync(
      'DELETE FROM users WHERE id = ?',
      [userId],
    );
  }
});

describe('authentication data access', () => {
  // Verify account lookup by email for credential verification.
  describe('getUserByEmail', () => {
    it('returns the account and password hash for login', async () => {
      const user = await getUserByEmail(testEmail);

      // Login verification requires the stored password hash.
      expect(user).toEqual({
        id: userId,
        full_name: testFullName,
        email: testEmail,
        password_hash: passwordHash,
        role: 'hiker',
      });
    });

    it('matches the email regardless of letter case', async () => {
      // Uppercase input must resolve to the same stored account.
      const user = await getUserByEmail(testEmail.toUpperCase());

      expect(user).toBeDefined();
      expect(user?.id).toBe(userId);
      expect(user?.email).toBe(testEmail);
    });

    it('returns undefined when the email does not exist', async () => {
      // Use a unique address that was never inserted.
      const user = await getUserByEmail(
        `missing-${uniqueSuffix}@example.com`,
      );

      expect(user).toBeUndefined();
    });
  });

  // Verify account lookup by ID for restoring authenticated sessions.
  describe('getUserById', () => {
    it('returns session user data without the password hash', async () => {
      const user = await getUserById(userId);

      // Session data contains identity and role information only.
      expect(user).toEqual({
        id: userId,
        full_name: testFullName,
        email: testEmail,
        role: 'hiker',
      });

      expect(user).not.toHaveProperty('password_hash');
    });

    it('returns undefined when the ID does not exist', async () => {
      // Choose an ID above the highest ID currently stored.
      const { missingId } = await getAsync(
        'SELECT COALESCE(MAX(id), 0) + 1 AS missingId FROM users',
      );

      const user = await getUserById(missingId);

      expect(user).toBeUndefined();
    });
  });
});