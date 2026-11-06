import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  hashPassword,
  verifyPassword,
} from '../../services/password.js';

describe('password hashing and verification', () => {
  // Stored hashes must include the algorithm, salt, and derived key.
  it('generates a hash in the expected format', async () => {
    const password = 'MountainTest123!';
    const storedHash = await hashPassword(password);

    expect(storedHash).toMatch(
      /^scrypt\$[a-f0-9]{32}\$[a-f0-9]{128}$/,
    );

    expect(storedHash).not.toContain(password);
  });

  // Verification must accept the password used to generate the hash.
  it('accepts the correct password', async () => {
    const password = 'MountainTest123!';
    const storedHash = await hashPassword(password);

    await expect(
      verifyPassword(password, storedHash),
    ).resolves.toBe(true);
  });

  // Verification must reject passwords that do not match the stored hash.
  it('rejects an incorrect password', async () => {
    const storedHash = await hashPassword('MountainTest123!');

    await expect(
      verifyPassword('WrongPassword123!', storedHash),
    ).resolves.toBe(false);
  });

  // Hashing the same password twice must generate distinct salts and hashes.
  it('generates different salts for the same password', async () => {
    const password = 'MountainTest123!';

    const firstHash = await hashPassword(password);
    const secondHash = await hashPassword(password);

    const firstSalt = firstHash.split('$')[1];
    const secondSalt = secondHash.split('$')[1];

    expect(firstSalt).not.toBe(secondSalt);
    expect(firstHash).not.toBe(secondHash);

    // Both independently salted hashes must still verify the original password.
    await expect(
      verifyPassword(password, firstHash),
    ).resolves.toBe(true);

    await expect(
      verifyPassword(password, secondHash),
    ).resolves.toBe(true);
  });

  // Malformed hashes and unsupported algorithms must return false.
  it.each([
    ['empty hash', ''],
    ['missing salt and key', 'scrypt'],
    [
      'unsupported algorithm',
      `other$${'a'.repeat(32)}$${'b'.repeat(128)}`,
    ],
    [
      'invalid salt length',
      `scrypt$${'a'.repeat(30)}$${'b'.repeat(128)}`,
    ],
    [
      'non-hexadecimal salt',
      `scrypt$${'z'.repeat(32)}$${'b'.repeat(128)}`,
    ],
    [
      'invalid key length',
      `scrypt$${'a'.repeat(32)}$${'b'.repeat(126)}`,
    ],
    [
      'non-hexadecimal key',
      `scrypt$${'a'.repeat(32)}$${'z'.repeat(128)}`,
    ],
  ])('rejects a stored hash with %s', async (_description, storedHash) => {
    await expect(
      verifyPassword('MountainTest123!', storedHash),
    ).resolves.toBe(false);
  });

  // A correctly formatted salt is insufficient when the derived key is missing.
  it('rejects a stored hash with a valid salt but no key', async () => {
    const incompleteHash = `scrypt$${'a'.repeat(32)}`;

    await expect(
      verifyPassword('MountainTest123!', incompleteHash),
    ).resolves.toBe(false);
  });
});