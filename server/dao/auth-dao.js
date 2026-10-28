import { getAsync } from '../db.js';

// [Minimal login setup (backend)]: Retrieve account records for login and session restoration.
export function getUserByEmail(email) {
  return getAsync(
    `SELECT id, full_name, email, password_hash, role
     FROM users
     WHERE email = ? COLLATE NOCASE`,
    [email],
  );
}

export function getUserById(id) {
  return getAsync(
    `SELECT id, full_name, email, role
     FROM users
     WHERE id = ?`,
    [id],
  );
}
