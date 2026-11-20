import {
  createHash,
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";

// Convert the callback-based scrypt function into a promise-based function.
/** @type {(password: string, salt: string, keyLength: number) => Promise<Buffer>} */
const scrypt = promisify(scryptCallback);

export const MIN_PASSWORD_LENGTH = 15;
export const MAX_PASSWORD_LENGTH = 128;

/**
 * Returns the first field error for a new password, or null when valid.
 *
 * @param {unknown} newPassword
 * @param {unknown} confirmPassword
 * @returns {{ field: "password" | "confirmPassword", code: string, message: string } | null}
 */
export function getNewPasswordError(newPassword, confirmPassword) {
  if (typeof newPassword !== "string" || newPassword.length === 0) {
    return {
      field: "password",
      code: "PASSWORD_REQUIRED",
      message: "Enter a password.",
    };
  }

  const length = Array.from(newPassword).length;

  if (length < MIN_PASSWORD_LENGTH) {
    return {
      field: "password",
      code: "PASSWORD_TOO_SHORT",
      message: `Use at least ${MIN_PASSWORD_LENGTH} characters.`,
    };
  }

  if (length > MAX_PASSWORD_LENGTH) {
    return {
      field: "password",
      code: "PASSWORD_TOO_LONG",
      message: `Use ${MAX_PASSWORD_LENGTH} characters or fewer.`,
    };
  }

  if (typeof confirmPassword !== "string" || confirmPassword.length === 0) {
    return {
      field: "confirmPassword",
      code: "PASSWORD_CONFIRMATION_REQUIRED",
      message: "Enter your password again.",
    };
  }

  if (newPassword !== confirmPassword) {
    return {
      field: "confirmPassword",
      code: "PASSWORD_MISMATCH",
      message: "The passwords do not match.",
    };
  }

  return null;
}

/**
 * @param {unknown} newPassword
 * @param {unknown} confirmPassword
 * @returns {boolean}
 */
export function isAcceptableNewPassword(newPassword, confirmPassword) {
  return getNewPasswordError(newPassword, confirmPassword) === null;
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