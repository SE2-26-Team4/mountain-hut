import { allAsync, getAsync, runAsync } from '../db.js';

/**
 * Database account record used to verify login credentials.
 *
 * @typedef {Express.User & {
 *   password_hash: string | null,
 *   is_temporary: number,
 *   must_change_password: number
 * }} AuthenticationUserRow
 */

/**
 * @typedef {import('../db.js').TransactionQueries} TransactionQueries
 * @typedef {import('../models/models.js').HikerDTO} HikerDTO
 */

/**
 * Hiker data already validated and normalized by the booking service.
 * Temporary hikers have no email and no password hash.
 *
 * @typedef {Object} NewHikerRecord
 * @property {string} fullName
 * @property {string | null} email
 * @property {string | null} phone
 * @property {string | null} notes
 * @property {string | null} emergencyContact
 * @property {string | null} passwordHash
 * @property {boolean} isTemporary
 * @property {boolean} mustChangePassword
 */

/**
 * Hiker row as returned by SQLite, with integer flags.
 *
 * @typedef {Omit<HikerDTO, 'isTemporary' | 'mustChangePassword'> & {
 *   isTemporary: number,
 *   mustChangePassword: number
 * }} HikerRow
 */

// Hiker profile columns, never including the password hash.
const HIKER_COLUMNS = `
  id,
  full_name AS fullName,
  email,
  phone,
  notes,
  emergency_contact AS emergencyContact,
  is_temporary AS isTemporary,
  must_change_password AS mustChangePassword
`;

/**
 * @param {HikerRow} row
 * @returns {HikerDTO}
 */
function toHikerDTO(row) {
  return {
    ...row,
    isTemporary: Boolean(row.isTemporary),
    mustChangePassword: Boolean(row.mustChangePassword),
  };
}

/**
 * Escapes LIKE wildcards so that the search term is matched literally.
 *
 * @param {string} value
 * @returns {string}
 */
function escapeLikePattern(value) {
  return value.replace(/[\\%_]/g, "\\$&");
}

/* READ */

/**
 * Includes the password hash for credential verification.
 *
 * @param {string} email
 * @returns {Promise<AuthenticationUserRow | undefined>}
 */
export function getUserByEmail(email) {
  // [REQUIREMENT] MH-07: Temporary hikers cannot sign in, even if they
  // have an email address for booking confirmations.
  return getAsync(
    `SELECT
       id,
       full_name,
       email,
       password_hash,
       role,
       is_temporary,
       must_change_password
     FROM users
     WHERE email = ? COLLATE NOCASE
     AND is_temporary = 0`,
    [email],
  );
}

/**
 * Retrieves session user data without the password hash.
 *
 * @param {number} id
 * @returns {Promise<Express.User | undefined>}
 */
export function getUserById(id) {
  return getAsync(
    `SELECT
       id,
       full_name,
       email,
       role,
       is_temporary AS isTemporary,
       must_change_password AS mustChangePassword
     FROM users
     WHERE id = ?`,
    [id],
  ).then((user) =>
    user
      ? {
          ...user,
          isTemporary: Boolean(user.isTemporary),
          mustChangePassword: Boolean(user.mustChangePassword),
        }
      : undefined,
  );
}

/**
 * Updates the password and clears the first-login password-change flag.
 *
 * @param {number} id
 * @param {string} passwordHash
 * @returns {Promise<Express.User | undefined>}
 */
export async function changeUserPassword(id, passwordHash) {
  await runAsync(
    `UPDATE users
     SET password_hash = ?, must_change_password = 0
     WHERE id = ?
       AND is_temporary = 0`,
    [passwordHash, id],
  );

  return getUserById(id);
}

/**
 * Finds hikers, including temporary ones, by name, email or phone.
 * Matching is case-insensitive and ignores phone separators.
 * Staff accounts are never returned.
 *
 * @param {string} term - Trimmed search term.
 * @param {number} [limit]
 * @returns {Promise<HikerDTO[]>}
 */
export async function searchHikers(term, limit = 20) {
  const textPattern = `%${escapeLikePattern(term)}%`;

  // Phones are stored without separators, so compare digits only and skip
  // phone matching for terms without digits (e.g. a name).
  const phonePattern = /\d/.test(term)
    ? `%${escapeLikePattern(term.replace(/[\s\-().]/g, ""))}%`
    : null;

  /** @type {HikerRow[]} */
  const rows = await allAsync(
    `SELECT ${HIKER_COLUMNS}
     FROM users
     WHERE role = 'hiker'
       AND (
         full_name LIKE ? ESCAPE '\\'
         OR email LIKE ? ESCAPE '\\'
         OR phone LIKE ? ESCAPE '\\'
       )
     ORDER BY full_name COLLATE NOCASE, id
     LIMIT ?`,
    [textPattern, textPattern, phonePattern, limit],
  );

  return rows.map(toHikerDTO);
}

/* STAFF BOOKINGS */

// The functions below take the query helpers of the caller's transaction
// (see withTransaction in db.js), so that checking or creating a hiker is
// atomic with the booking that uses it.

/**
 * Retrieves a hiker profile. Staff accounts are reported as missing.
 *
 * @param {TransactionQueries} queries - Helpers of the open transaction.
 * @param {number} id
 * @returns {Promise<HikerDTO | undefined>}
 */
export async function getHikerById(queries, id) {
  /** @type {HikerRow | undefined} */
  const row = await queries.getAsync(
    `SELECT ${HIKER_COLUMNS}
     FROM users
     WHERE id = ?
       AND role = 'hiker'`,
    [id],
  );

  return row ? toHikerDTO(row) : undefined;
}

/**
 * Checks whether any account, hiker or staff, already uses the email.
 *
 * @param {TransactionQueries} queries - Helpers of the open transaction.
 * @param {string} email
 * @returns {Promise<boolean>}
 */
export async function isEmailRegistered(queries, email) {
  const row = await queries.getAsync(
    "SELECT id FROM users WHERE email = ? COLLATE NOCASE",
    [email],
  );

  return row !== undefined;
}

/**
 * Inserts a hiker account.
 *
 * @param {TransactionQueries} queries - Helpers of the open transaction.
 * @param {NewHikerRecord} hiker
 * @returns {Promise<HikerDTO>}
 */
export async function createHiker(queries, hiker) {
  const result = await queries.runAsync(
    `INSERT INTO users (
       full_name,
       email,
       password_hash,
       role,
       phone,
       notes,
       emergency_contact,
       is_temporary,
       must_change_password
     )
     VALUES (?, ?, ?, 'hiker', ?, ?, ?, ?, ?)`,
    [
      hiker.fullName,
      hiker.email,
      hiker.passwordHash,
      hiker.phone,
      hiker.notes,
      hiker.emergencyContact,
      hiker.isTemporary ? 1 : 0,
      hiker.mustChangePassword ? 1 : 0,
    ],
  );

  // Read the profile back within the same transaction.
  return /** @type {HikerDTO} */ (await getHikerById(queries, result.lastID));
}
