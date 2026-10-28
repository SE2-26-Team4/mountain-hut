// [Minimal login setup (backend)]: Hash and verify passwords without storing plain-text credentials.
import {
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
} from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback);

export async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const derivedKey = await scrypt(password, salt, 64);

  return `scrypt$${salt}$${derivedKey.toString('hex')}`;
}

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

  return timingSafeEqual(storedKey, derivedKey);
}
