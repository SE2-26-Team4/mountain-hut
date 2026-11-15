/**
 * @typedef {Object} LoginCredentials
 * @property {string} email
 * @property {string} password
 */

/**
 * Authenticated user data returned by the server, without the password hash.
 *
 * @typedef {Object} SessionUser
 * @property {number} id
 * @property {string} full_name
 * @property {string} email
 * @property {'hiker' | 'employee' | 'warden'} role
 * @property {boolean} mustChangePassword
 */

const API_URL = (
  import.meta.env.VITE_API_BASE_URL ?? '/api'
).replace(/\/$/, '');

class SessionApiError extends Error {
  /**
   * @param {string} message
   * @param {number} status
   */
  constructor(message, status) {
    super(message);

    this.name = 'SessionApiError';
    this.status = status;
  }
}

/**
 * Includes the session cookie in every request.
 *
 * @param {string} path
 * @param {RequestInit} [options]
 * @returns {Promise<any>}
 */
async function request(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
  });

  const data =
    response.status === 204
      ? null
      : await response.json().catch(() => null);

  if (!response.ok) {
    throw new SessionApiError(
      data?.error?.message ?? 'The request could not be completed.',
      response.status,
    );
  }

  return data;
}

/**
 * @param {LoginCredentials} credentials
 * @param {'hiker' | 'staff'} [area]
 * @returns {Promise<SessionUser>}
 */
async function login(credentials, area = 'hiker') {
  /** @type {{ user: SessionUser }} */
  const data = await request(
    area === 'staff' ? '/staff/sessions' : '/sessions',
    {
      method: 'POST',
      body: JSON.stringify(credentials),
    },
  );

  return data.user;
}

/**
 * Returns the current user or rejects if the session is not authenticated.
 *
 * @returns {Promise<SessionUser>}
 */
async function getUserInfo() {
  /** @type {{ user: SessionUser }} */
  const data = await request('/sessions/current');

  return data.user;
}

/**
 * @returns {Promise<void>}
 */
async function logout() {
  await request('/sessions/current', {
    method: 'DELETE',
  });
}

/**
 * @param {{ currentPassword: string, newPassword: string, confirmPassword: string }} passwords
 * @returns {Promise<SessionUser>}
 */
async function changePassword(passwords) {
  /** @type {{ user: SessionUser }} */
  const data = await request('/sessions/current/password', {
    method: 'PUT',
    body: JSON.stringify(passwords),
  });

  return data.user;
}

const API = {
  login,
  getUserInfo,
  changePassword,
  logout,
};

export { SessionApiError };
export default API;