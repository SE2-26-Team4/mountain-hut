import { randomUUID } from 'node:crypto';

import {
  afterAll,
  beforeAll,
  describe,
  expect,
  it,
} from 'vitest';

import {
  createHiker,
  getHikerById,
  getUserByEmail,
  getUserById,
  isEmailRegistered,
  searchHikers,
} from '../../dao/auth-dao.js';
import {
  getAsync,
  initializeDatabase,
  runAsync,
  withTransaction,
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

// Staff search and register hikers when entering a booking.
describe('hiker data access for staff bookings', () => {
  // A dedicated suffix keeps these fixtures apart from the ones above.
  const searchSuffix = randomUUID();

  // Digits derived from the run keep phone numbers unique in the database.
  const phoneDigits = String(Date.now()).slice(-9);
  const fullHikerName = `Searchable Hiker ${searchSuffix}`;
  const fullHikerEmail = `search-${searchSuffix}@example.com`;
  const temporaryHikerName = `Searchable Walkin ${searchSuffix}`;
  const staffEmail = `search-staff-${searchSuffix}@example.com`;

  // Keep every account created by these tests for cleanup.
  const createdIds = [];

  let fullHikerId;
  let temporaryHikerId;
  let staffId;

  beforeAll(async () => {
    const fullHiker = await runAsync(
      `INSERT INTO users (
         full_name, email, password_hash, role, phone, notes, emergency_contact
       )
       VALUES (?, ?, ?, 'hiker', ?, ?, ?)`,
      [
        fullHikerName,
        fullHikerEmail,
        passwordHash,
        `+39${phoneDigits}`,
        'Registered mountain guide',
        'Anna, +39 333 0000000',
      ],
    );

    fullHikerId = fullHiker.lastID;

    const temporaryHiker = await runAsync(
      `INSERT INTO users (full_name, role, phone, is_temporary)
       VALUES (?, 'hiker', ?, 1)`,
      [temporaryHikerName, `+41${phoneDigits}`],
    );

    temporaryHikerId = temporaryHiker.lastID;

    // A staff account with a matching name and the same phone as the hiker.
    const staff = await runAsync(
      `INSERT INTO users (full_name, email, password_hash, role, phone)
       VALUES (?, ?, ?, 'employee', ?)`,
      [
        `Searchable Staff ${searchSuffix}`,
        staffEmail,
        passwordHash,
        `+39${phoneDigits}`,
      ],
    );

    staffId = staff.lastID;

    createdIds.push(fullHikerId, temporaryHikerId, staffId);
  });

  afterAll(async () => {
    for (const id of createdIds) {
      await runAsync('DELETE FROM users WHERE id = ?', [id]);
    }
  });

  // Expected profile of the full hiker, never including the password hash.
  function fullHikerProfile() {
    return {
      id: fullHikerId,
      fullName: fullHikerName,
      email: fullHikerEmail,
      phone: `+39${phoneDigits}`,
      notes: 'Registered mountain guide',
      emergencyContact: 'Anna, +39 333 0000000',
      isTemporary: false,
      mustChangePassword: false,
    };
  }

  describe('searchHikers', () => {
    it('finds a hiker by part of the name, ignoring letter case', async () => {
      const hikers = await searchHikers(
        `hiker ${searchSuffix}`.toUpperCase(),
      );

      expect(hikers).toEqual([fullHikerProfile()]);
      expect(hikers[0]).not.toHaveProperty('password_hash');
    });

    it('finds a hiker by part of the email', async () => {
      const hikers = await searchHikers(`search-${searchSuffix}@`);

      expect(hikers.map((hiker) => hiker.id)).toEqual([fullHikerId]);
    });

    // Phones are stored without separators, so formatted terms still match.
    it('finds a hiker by phone, ignoring separators', async () => {
      const hikers = await searchHikers(
        `+39 ${phoneDigits.slice(0, 3)} ${phoneDigits.slice(3, 6)}-${phoneDigits.slice(6)}`,
      );

      // The staff account with the same phone is not returned.
      expect(hikers.map((hiker) => hiker.id)).toEqual([fullHikerId]);
    });

    it('includes temporary hikers and excludes staff accounts', async () => {
      const hikers = await searchHikers(searchSuffix);

      expect(hikers.map((hiker) => hiker.id)).toEqual([
        fullHikerId,
        temporaryHikerId,
      ]);

      expect(hikers[1]).toEqual({
        id: temporaryHikerId,
        fullName: temporaryHikerName,
        email: null,
        phone: `+41${phoneDigits}`,
        notes: null,
        emergencyContact: null,
        isTemporary: true,
        mustChangePassword: false,
      });
    });

    // A term without digits is matched against names and emails only.
    it('finds a hiker by a name without digits', async () => {
      const ids = (await searchHikers('Searchable Walkin')).map(
        (hiker) => hiker.id,
      );

      expect(ids).toContain(temporaryHikerId);
      expect(ids).not.toContain(fullHikerId);
      expect(ids).not.toContain(staffId);
    });

    // LIKE wildcards in the term must be matched literally.
    it.each([
      ['a percent sign', () => `${searchSuffix}%`],
      [
        'an underscore',
        () => `${searchSuffix.slice(0, 8)}_${searchSuffix.slice(9)}`,
      ],
      ['a backslash', () => `${searchSuffix}\\`],
    ])('treats %s as a literal character', async (_label, term) => {
      await expect(searchHikers(term())).resolves.toEqual([]);
    });

    it('returns at most the requested number of hikers', async () => {
      const hikers = await searchHikers(searchSuffix, 1);

      expect(hikers.map((hiker) => hiker.id)).toEqual([fullHikerId]);
    });
  });

  // Like booking-dao, call these functions inside a transaction.
  describe('getHikerById', () => {
    it('returns the profile of a registered hiker', async () => {
      await expect(
        withTransaction((queries) => getHikerById(queries, fullHikerId)),
      ).resolves.toEqual(fullHikerProfile());
    });

    it('returns the profile of a temporary hiker', async () => {
      await expect(
        withTransaction((queries) =>
          getHikerById(queries, temporaryHikerId),
        ),
      ).resolves.toMatchObject({
        id: temporaryHikerId,
        email: null,
        isTemporary: true,
      });
    });

    // Only hikers can receive a booking entered by staff.
    it('returns undefined for a staff account or a missing ID', async () => {
      const { missingId } = await getAsync(
        'SELECT COALESCE(MAX(id), 0) + 1 AS missingId FROM users',
      );

      await expect(
        withTransaction((queries) => getHikerById(queries, staffId)),
      ).resolves.toBeUndefined();

      await expect(
        withTransaction((queries) => getHikerById(queries, missingId)),
      ).resolves.toBeUndefined();
    });
  });

  describe('isEmailRegistered', () => {
    it('detects emails of hikers and staff, ignoring letter case', async () => {
      await expect(
        withTransaction((queries) =>
          isEmailRegistered(queries, fullHikerEmail.toUpperCase()),
        ),
      ).resolves.toBe(true);

      await expect(
        withTransaction((queries) =>
          isEmailRegistered(queries, staffEmail),
        ),
      ).resolves.toBe(true);
    });

    it('returns false for an unused email', async () => {
      await expect(
        withTransaction((queries) =>
          isEmailRegistered(
            queries,
            `unused-${searchSuffix}@example.com`,
          ),
        ),
      ).resolves.toBe(false);
    });
  });

  describe('createHiker', () => {
    it('creates a full hiker who must change the initial password', async () => {
      const email = `created-${searchSuffix}@example.com`;

      const hiker = await withTransaction((queries) =>
        createHiker(queries, {
          fullName: `Created Hiker ${searchSuffix}`,
          email,
          phone: '+390000000001',
          notes: 'Arrives by e-bike',
          emergencyContact: null,
          passwordHash,
          isTemporary: false,
          mustChangePassword: true,
        }),
      );

      createdIds.push(hiker.id);

      expect(hiker).toEqual({
        id: expect.any(Number),
        fullName: `Created Hiker ${searchSuffix}`,
        email,
        phone: '+390000000001',
        notes: 'Arrives by e-bike',
        emergencyContact: null,
        isTemporary: false,
        mustChangePassword: true,
      });

      // The account can be found by the login and uses the given hash.
      await expect(getUserByEmail(email)).resolves.toEqual({
        id: hiker.id,
        full_name: `Created Hiker ${searchSuffix}`,
        email,
        password_hash: passwordHash,
        role: 'hiker',
      });
    });

    it('creates a temporary hiker without email and password', async () => {
      const hiker = await withTransaction((queries) =>
        createHiker(queries, {
          fullName: `Created Walkin ${searchSuffix}`,
          email: null,
          phone: null,
          notes: null,
          emergencyContact: null,
          passwordHash: null,
          isTemporary: true,
          mustChangePassword: false,
        }),
      );

      createdIds.push(hiker.id);

      expect(hiker).toMatchObject({
        email: null,
        phone: null,
        isTemporary: true,
        mustChangePassword: false,
      });

      await expect(
        getAsync(
          'SELECT email, password_hash, role FROM users WHERE id = ?',
          [hiker.id],
        ),
      ).resolves.toEqual({
        email: null,
        password_hash: null,
        role: 'hiker',
      });
    });
  });
});