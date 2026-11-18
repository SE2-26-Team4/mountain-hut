import {
  createHash,
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
} from 'node:crypto';
import { promisify } from 'node:util';

// Convert the callback-based scrypt function into a promise-based function.
/** @type {(password: string, salt: string, keyLength: number) => Promise<Buffer>} */
const scrypt = promisify(scryptCallback);

export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_LENGTH = 128;

/**
 * Checks a new password and its confirmation against the password rules
 * shared by the password change and the password reset.
 *
 * @param {unknown} newPassword
 * @param {unknown} confirmPassword
 * @returns {boolean}
 */
export function isAcceptableNewPassword(newPassword, confirmPassword) {
  return (
    typeof newPassword === 'string' &&
    newPassword.length >= MIN_PASSWORD_LENGTH &&
    newPassword.length <= MAX_PASSWORD_LENGTH &&
    newPassword === confirmPassword
  );
}

/**
 * Generates the secret sent in a password reset link (256 random bits).
 *
 * @returns {string}
 */
export function generateResetToken() {
  return randomBytes(32).toString('base64url');
}

/**
 * Hashes a reset token, so that the database never stores a usable link.
 * The token is random and long, so a fast hash is enough.
 *
 * @param {string} token
 * @returns {string}
 */
export function hashResetToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Generates a password hash with a random salt.
 *
 * @param {string} password
 * @returns {Promise<string>}
 */
export async function hashPassword(password) {
  // Generate a random 16-byte salt and encode it as hexadecimal text.
  const salt = randomBytes(16).toString('hex');

  // Derive a 64-byte key from the password and salt.
  const derivedKey = await scrypt(password, salt, 64);

  // Store the algorithm, salt, and derived key in a single string.
  return `scrypt$${salt}$${derivedKey.toString('hex')}`;
}

/**
 * @returns {string}
 */
export function generateInitialPassword() {
  return randomBytes(12).toString('base64url');
}

/**
 * Verifies a password against the stored scrypt hash.
 * Returns false if the stored algorithm, salt or key format is invalid.
 *
 * @param {string} password
 * @param {string} storedHash
 * @returns {Promise<boolean>}
 */
export async function verifyPassword(password, storedHash) {
  // Extract the algorithm, salt, and hexadecimal key from the stored hash.
  const [algorithm, salt, storedKeyHex] = storedHash.split('$');

  // Require scrypt, a 16-byte hexadecimal salt, and a 64-byte hexadecimal key.
  if (
    algorithm !== 'scrypt' ||
    !/^[a-f0-9]{32}$/i.test(salt ?? '') ||
    !/^[a-f0-9]{128}$/i.test(storedKeyHex ?? '')
  ) {
    return false;
  }

  // Decode the stored key and derive a key from the supplied password.
  const storedKey = Buffer.from(storedKeyHex, 'hex');
  const derivedKey = await scrypt(password, salt, storedKey.length);

  // Compare equal-length keys using a timing-safe comparison.
  return timingSafeEqual(storedKey, derivedKey);
}