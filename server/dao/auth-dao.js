import { getAsync } from '../db.js';

/**
 * Database account record used to verify login credentials.
 *
 * @typedef {Express.User & {
 *   password_hash: string
 * }} AuthenticationUserRow
 */

/**
 * Includes the password hash for credential verification.
 *
 * @param {string} email
 * @returns {Promise<AuthenticationUserRow | undefined>}
 */
export function getUserByEmail(email) {
  return getAsync(
    `SELECT id, full_name, email, password_hash, role
     FROM users
     WHERE email = ? COLLATE NOCASE`,
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
    `SELECT id, full_name, email, role
     FROM users
     WHERE id = ?`,
    [id],
  );
}