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

const uniqueSuffix = randomUUID();
const testEmail = `auth-dao-${uniqueSuffix}@example.com`;
const testFullName = 'Auth DAO Test Hiker';

let userId;
let passwordHash;

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

afterAll(async () => {
  if (userId !== undefined) {
    await runAsync(
      'DELETE FROM users WHERE id = ?',
      [userId],
    );
  }
});

describe('authentication data access', () => {
  describe('getUserByEmail', () => {
    it('returns the account and password hash for login', async () => {
      const user = await getUserByEmail(testEmail);

      expect(user).toEqual({
        id: userId,
        full_name: testFullName,
        email: testEmail,
        password_hash: passwordHash,
        role: 'hiker',
      });
    });

    it('matches the email regardless of letter case', async () => {
      const user = await getUserByEmail(testEmail.toUpperCase());

      expect(user).toBeDefined();
      expect(user?.id).toBe(userId);
      expect(user?.email).toBe(testEmail);
    });

    it('returns undefined when the email does not exist', async () => {
      const user = await getUserByEmail(
        `missing-${uniqueSuffix}@example.com`,
      );

      expect(user).toBeUndefined();
    });
  });

  describe('getUserById', () => {
    it('returns session user data without the password hash', async () => {
      const user = await getUserById(userId);

      expect(user).toEqual({
        id: userId,
        full_name: testFullName,
        email: testEmail,
        role: 'hiker',
      });

      expect(user).not.toHaveProperty('password_hash');
    });

    it('returns undefined when the ID does not exist', async () => {
      const { missingId } = await getAsync(
        'SELECT COALESCE(MAX(id), 0) + 1 AS missingId FROM users',
      );

      const user = await getUserById(missingId);

      expect(user).toBeUndefined();
    });
  });
});