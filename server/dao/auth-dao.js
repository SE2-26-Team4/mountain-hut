import { getAsync } from '../db.js';

export async function findUserByEmail(email) {
  return getAsync(
    `SELECT id, full_name AS fullName, email, password_hash AS passwordHash, role
     FROM users
     WHERE email = ?`,
    [email],
  );
}