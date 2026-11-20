import {
  getRecoverableAccountByEmail,
  isPasswordResetTokenValid,
  resetPasswordWithToken,
  savePasswordResetToken,
} from "../dao/password-reset-dao.js";
import {
  generateResetToken,
  getNewPasswordError,
  hashPassword,
  hashResetToken,
} from "./password.js";

/**
 * @typedef {import('../dao/password-reset-dao.js').RecoverableAccount} RecoverableAccount
 */

/**
 * Reset link to send to a hiker.
 *
 * @typedef {Object} PasswordResetRequest
 * @property {RecoverableAccount} account
 * @property {string} token - Plain token, included only in the email link.
 * @property {string} expiresAt - ISO timestamp.
 */

// [REQUIREMENT] MH-07: The typical expiration time for email reset link is 24 hours.
export const PASSWORD_RESET_LINK_LIFETIME_MS = 24 * 60 * 60 * 1000;

const MAX_EMAIL_LENGTH = 254;
const MAX_TOKEN_LENGTH = 256;

// Represent invalid reset requests with a code that the routes can report.
export class PasswordResetError extends Error {
  /**
   * @param {string} code
   * @param {string} message
   * @param {"newPassword" | "confirmPassword"} [field]
   */
  constructor(code, message, field) {
    super(message);

    this.name = "PasswordResetError";
    this.code = code;
    this.field = field;
  }
}

/**
 * Creates a reset link for the hiker who owns the email.
 * Returns null when no hiker can recover a password with that email, so
 * that the caller can answer in the same way without revealing whether
 * an account exists.
 *
 * @param {unknown} email
 * @returns {Promise<PasswordResetRequest | null>}
 */
export async function createPasswordResetRequest(email) {
  const address = typeof email === "string" ? email.trim().toLowerCase() : "";

  if (
    address.length === 0 ||
    address.length > MAX_EMAIL_LENGTH ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)
  ) {
    throw new PasswordResetError(
      "INVALID_EMAIL",
      "A valid email address is required.",
    );
  }

  const account = await getRecoverableAccountByEmail(address);

  if (!account) {
    return null;
  }

  const token = generateResetToken();
  const now = Date.now();
  const expiresAt = new Date(
    now + PASSWORD_RESET_LINK_LIFETIME_MS,
  ).toISOString();

  await savePasswordResetToken(
    account.id,
    hashResetToken(token),
    expiresAt,
    new Date(now).toISOString(),
  );

  return { account, token, expiresAt };
}

/**
 * @returns {PasswordResetError}
 */
function invalidLinkError() {
  return new PasswordResetError(
    "INVALID_RESET_TOKEN",
    "This password reset link is invalid or has expired. Request a new one.",
  );
}

/**
 * @param {unknown} token
 * @returns {token is string}
 */
function isWellFormedToken(token) {
  return (
    typeof token === "string" &&
    token.length > 0 &&
    token.length <= MAX_TOKEN_LENGTH
  );
}

/**
 * Checks that a reset link can still be used, so that the hiker is told
 * to request a new one before typing a new password.
 *
 * @param {unknown} token
 * @returns {Promise<void>}
 */
export async function checkPasswordResetToken(token) {
  if (
    !isWellFormedToken(token) ||
    !(await isPasswordResetTokenValid(
      hashResetToken(token),
      new Date().toISOString(),
    ))
  ) {
    throw invalidLinkError();
  }
}

/**
 * Sets a new password using the token of a reset link.
 *
 * @param {{ token?: unknown, newPassword?: unknown, confirmPassword?: unknown }} input
 * @returns {Promise<RecoverableAccount>} The account whose password changed.
 */
export async function resetPassword({ token, newPassword, confirmPassword }) {
  if (!isWellFormedToken(token)) {
    throw invalidLinkError();
  }

  const passwordError = getNewPasswordError(newPassword, confirmPassword);

  if (passwordError) {
    const field =
      passwordError.field === "password" ? "newPassword" : "confirmPassword";

    throw new PasswordResetError(
      passwordError.code,
      passwordError.message,
      field,
    );
  }

  // The token is checked in the same transaction that replaces the
  // password, so a link cannot be used twice.
  const account = await resetPasswordWithToken(
    hashResetToken(token),
    await hashPassword(/** @type {string} */ (newPassword)),
    new Date().toISOString(),
  );

  if (!account) {
    throw invalidLinkError();
  }

  return account;
}
