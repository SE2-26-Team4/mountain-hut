import {
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
} from 'node:crypto';
import { promisify } from 'node:util';

/** @type {(password: string, salt: string, keyLength: number) => Promise<Buffer>} */
const scrypt = promisify(scryptCallback);

/**
 * Generates a password hash with a random salt.
 *
 * @param {string} password
 * @returns {Promise<string>}
 */
export async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const derivedKey = await scrypt(password, salt, 64);

  return `scrypt$${salt}$${derivedKey.toString('hex')}`;
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
  const [algorithm, salt, storedKeyHex] = storedHash.split('$');

  if (
    algorithm !== 'scrypt' ||
    !/^[a-f0-9]{32}$/i.test(salt ?? '') ||
    !/^[a-f0-9]{128}$/i.test(storedKeyHex ?? '')
  ) {
    return false;
  }

  const storedKey = Buffer.from(storedKeyHex, 'hex');
  const derivedKey = await scrypt(password, salt, storedKey.length);

  // Compare equal-length keys using a timing-safe comparison.
  return timingSafeEqual(storedKey, derivedKey);
}