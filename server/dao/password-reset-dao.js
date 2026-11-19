import { getAsync, withTransaction } from '../db.js';

/**
 * Hiker account that can recover its password.
 *
 * @typedef {Object} RecoverableAccount
 * @property {number} id
 * @property {string} fullName
 * @property {string} email
 */

/* READ */

/**
 * Finds a hiker account that can sign in, by email.
 * Staff accounts and temporary hikers cannot recover a password.
 *
 * @param {string} email
 * @returns {Promise<RecoverableAccount | undefined>}
 */
export function getRecoverableAccountByEmail(email) {
  return getAsync(
    `SELECT id, full_name AS fullName, email
     FROM users
     WHERE email = ? COLLATE NOCASE
       AND role = 'hiker'
       AND is_temporary = 0`,
    [email],
  );
}

/**
 * Tells whether a reset token can still be used to set a new password.
 *
 * @param {string} tokenHash
 * @param {string} now - ISO timestamp.
 * @returns {Promise<boolean>} False when the token is unknown, already used
 * or expired.
 */
export async function isPasswordResetTokenValid(tokenHash, now) {
  const row = await getAsync(
    `SELECT 1 AS valid
     FROM password_reset_tokens AS t
     JOIN users AS u ON u.id = t.user_id
     WHERE t.token_hash = ?
       AND t.expires_at > ?
       AND u.role = 'hiker'
       AND u.is_temporary = 0`,
    [tokenHash, now],
  );

  return row !== undefined;
}

/* CREATE */

/**
 * Saves the hash of a new reset token for an account.
 * Earlier links of the same account stop working, and expired links of
 * every account are removed.
 *
 * @param {number} userId
 * @param {string} tokenHash
 * @param {string} expiresAt - ISO timestamp.
 * @param {string} now - ISO timestamp.
 * @returns {Promise<void>}
 */
export function savePasswordResetToken(userId, tokenHash, expiresAt, now) {
  return withTransaction(async ({ runAsync }) => {
    await runAsync(
      `DELETE FROM password_reset_tokens
       WHERE user_id = ?
          OR expires_at <= ?`,
      [userId, now],
    );

    await runAsync(
      `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
       VALUES (?, ?, ?)`,
      [userId, tokenHash, expiresAt],
    );
  });
}

/* UPDATE */

/**
 * Replaces the password of the account that owns a valid reset token.
 * The token and every other link of the account are then removed, so each
 * link can be used only once. The initial password, if any, no longer has
 * to be changed, because the hiker has just chosen a new one.
 *
 * @param {string} tokenHash
 * @param {string} passwordHash
 * @param {string} now - ISO timestamp.
 * @returns {Promise<RecoverableAccount | undefined>} Undefined when the token
 * is unknown, already used or expired.
 */
export function resetPasswordWithToken(tokenHash, passwordHash, now) {
  return withTransaction(async ({ getAsync: get, runAsync }) => {
    /** @type {RecoverableAccount | undefined} */
    const account = await get(
      `SELECT u.id, u.full_name AS fullName, u.email
       FROM password_reset_tokens AS t
       JOIN users AS u ON u.id = t.user_id
       WHERE t.token_hash = ?
         AND t.expires_at > ?
         AND u.role = 'hiker'
         AND u.is_temporary = 0`,
      [tokenHash, now],
    );

    if (!account) {
      return undefined;
    }

    await runAsync(
      `UPDATE users
       SET password_hash = ?, must_change_password = 0
       WHERE id = ?`,
      [passwordHash, account.id],
    );

    await runAsync(
      'DELETE FROM password_reset_tokens WHERE user_id = ?',
      [account.id],
    );

    return account;
  });
}
