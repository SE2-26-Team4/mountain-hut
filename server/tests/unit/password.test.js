import { describe, expect, it } from "vitest";

import {
  generateInitialPassword,
  generateResetToken,
  getNewPasswordError,
  hashPassword,
  hashResetToken,
  isAcceptableNewPassword,
  verifyPassword,
} from "../../services/password.js";

describe("password hashing and verification", () => {
  // Stored hashes must include the algorithm, salt, and derived key.
  it("generates a hash in the expected format", async () => {
    const password = "MountainTest123!";
    const storedHash = await hashPassword(password);

    expect(storedHash).toMatch(/^scrypt\$[a-f0-9]{32}\$[a-f0-9]{128}$/);

    expect(storedHash).not.toContain(password);
  });

  // Verification must accept the password used to generate the hash.
  it("accepts the correct password", async () => {
    const password = "MountainTest123!";
    const storedHash = await hashPassword(password);

    await expect(verifyPassword(password, storedHash)).resolves.toBe(true);
  });

  // Verification must reject passwords that do not match the stored hash.
  it("rejects an incorrect password", async () => {
    const storedHash = await hashPassword("MountainTest123!");

    await expect(verifyPassword("WrongPassword123!", storedHash)).resolves.toBe(
      false,
    );
  });

  // Hashing the same password twice must generate distinct salts and hashes.
  it("generates different salts for the same password", async () => {
    const password = "MountainTest123!";

    const firstHash = await hashPassword(password);
    const secondHash = await hashPassword(password);

    const firstSalt = firstHash.split("$")[1];
    const secondSalt = secondHash.split("$")[1];

    expect(firstSalt).not.toBe(secondSalt);
    expect(firstHash).not.toBe(secondHash);

    // Both independently salted hashes must still verify the original password.
    await expect(verifyPassword(password, firstHash)).resolves.toBe(true);

    await expect(verifyPassword(password, secondHash)).resolves.toBe(true);
  });

  // Malformed hashes and unsupported algorithms must return false.
  it.each([
    ["empty hash", ""],
    ["missing salt and key", "scrypt"],
    ["unsupported algorithm", `other$${"a".repeat(32)}$${"b".repeat(128)}`],
    ["invalid salt length", `scrypt$${"a".repeat(30)}$${"b".repeat(128)}`],
    ["non-hexadecimal salt", `scrypt$${"z".repeat(32)}$${"b".repeat(128)}`],
    ["invalid key length", `scrypt$${"a".repeat(32)}$${"b".repeat(126)}`],
    ["non-hexadecimal key", `scrypt$${"a".repeat(32)}$${"z".repeat(128)}`],
  ])("rejects a stored hash with %s", async (_description, storedHash) => {
    await expect(verifyPassword("MountainTest123!", storedHash)).resolves.toBe(
      false,
    );
  });

  // A correctly formatted salt is insufficient when the derived key is missing.
  it("rejects a stored hash with a valid salt but no key", async () => {
    const incompleteHash = `scrypt$${"a".repeat(32)}`;

    await expect(
      verifyPassword("MountainTest123!", incompleteHash),
    ).resolves.toBe(false);
  });
});

// Staff-created hikers receive a random password to change at first login.
describe("initial password generation", () => {
  it("generates 16 URL-safe characters", () => {
    expect(generateInitialPassword()).toMatch(/^[A-Za-z0-9_-]{16}$/);
  });

  it("generates a different password each time", () => {
    const passwords = new Set(
      Array.from({ length: 20 }, () => generateInitialPassword()),
    );

    expect(passwords.size).toBe(20);
  });

  it("generates a password that can be hashed and verified", async () => {
    const password = generateInitialPassword();
    const storedHash = await hashPassword(password);

    await expect(verifyPassword(password, storedHash)).resolves.toBe(true);
  });
});

// Sign-up, password change, and reset share the same password rules.
// Each validation error identifies the field and the message to display.
describe("new password rules", () => {
  const validPassword = "Four hikers cross the valley";

  it.each([
    ["exactly 15 characters", "a".repeat(15)],
    ["exactly 128 characters", "a".repeat(128)],
    ["a passphrase with spaces", validPassword],
    ["15 Unicode characters", "🥾".repeat(15)],
  ])("accepts %s when confirmed", (_label, password) => {
    expect(getNewPasswordError(password, password)).toBeNull();
    expect(isAcceptableNewPassword(password, password)).toBe(true);
  });

  it.each([
    {
      label: "empty password",
      password: "",
      confirmation: "",
      field: "password",
      code: "PASSWORD_REQUIRED",
      message: "Enter a password.",
    },
    {
      label: "non-text password",
      password: 12345678,
      confirmation: 12345678,
      field: "password",
      code: "PASSWORD_REQUIRED",
      message: "Enter a password.",
    },
    {
      label: "14 characters",
      password: "a".repeat(14),
      confirmation: "a".repeat(14),
      field: "password",
      code: "PASSWORD_TOO_SHORT",
      message: "Use at least 15 characters.",
    },
    {
      label: "14 Unicode characters",
      password: "🥾".repeat(14),
      confirmation: "🥾".repeat(14),
      field: "password",
      code: "PASSWORD_TOO_SHORT",
      message: "Use at least 15 characters.",
    },
    {
      label: "129 characters",
      password: "a".repeat(129),
      confirmation: "a".repeat(129),
      field: "password",
      code: "PASSWORD_TOO_LONG",
      message: "Use 128 characters or fewer.",
    },
    {
      label: "empty confirmation",
      password: validPassword,
      confirmation: "",
      field: "confirmPassword",
      code: "PASSWORD_CONFIRMATION_REQUIRED",
      message: "Enter your password again.",
    },
    {
      label: "missing confirmation",
      password: validPassword,
      confirmation: undefined,
      field: "confirmPassword",
      code: "PASSWORD_CONFIRMATION_REQUIRED",
      message: "Enter your password again.",
    },
    {
      label: "different confirmation",
      password: validPassword,
      confirmation: "Five hikers cross the valley",
      field: "confirmPassword",
      code: "PASSWORD_MISMATCH",
      message: "The passwords do not match.",
    },
  ])(
    "reports the field and message for $label",
    ({ password, confirmation, field, code, message }) => {
      expect(getNewPasswordError(password, confirmation)).toEqual({
        field,
        code,
        message,
      });
      expect(isAcceptableNewPassword(password, confirmation)).toBe(false);
    },
  );
});

// Reset links carry a random token whose hash is stored.
describe("password reset tokens", () => {
  it("generates 256 random bits as URL-safe text", () => {
    const tokens = new Set(
      Array.from({ length: 20 }, () => generateResetToken()),
    );

    expect(tokens.size).toBe(20);

    for (const token of tokens) {
      expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    }
  });

  it("hashes a token with SHA-256", () => {
    expect(hashResetToken("token")).toBe(
      "3c469e9d6c5875d37a43f353d4f88e61fcf812c66eee3457465a40b0da4153e0",
    );
    expect(hashResetToken("token")).not.toBe(hashResetToken("token2"));
  });
});
