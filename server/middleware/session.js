import { randomBytes } from 'node:crypto';

const COOKIE_NAME = 'mountain_hut_session';
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const sessions = new Map();

function getCookieValue(cookieHeader, name) {
  for (const cookie of (cookieHeader ?? '').split(';')) {
    const separator = cookie.indexOf('=');

    if (separator < 0 || cookie.slice(0, separator).trim() !== name) {
      continue;
    }

    return cookie.slice(separator + 1).trim();
  }

  return undefined;
}

export function createSession(user) {
  const sessionId = randomBytes(32).toString('hex');
  sessions.set(sessionId, {
    user,
    expiresAt: Date.now() + SESSION_TTL_MS,
  });

  return sessionId;
}

export function destroySession(sessionId) {
  sessions.delete(sessionId);
}

export function setSessionCookie(res, sessionId) {
  res.append(
    'Set-Cookie',
    `${COOKIE_NAME}=${sessionId}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_TTL_MS / 1000}`,
  );
}

export function clearSessionCookie(res) {
  res.append(
    'Set-Cookie',
    `${COOKIE_NAME}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`,
  );
}

export function sessionMiddleware(req, _res, next) {
  req.isAuthenticated = () => Boolean(req.user);

  const sessionId = getCookieValue(req.headers.cookie, COOKIE_NAME);

  if (!sessionId || !/^[a-f0-9]{64}$/i.test(sessionId)) {
    return next();
  }

  const session = sessions.get(sessionId);

  if (!session || session.expiresAt <= Date.now()) {
    sessions.delete(sessionId);
    return next();
  }

  session.expiresAt = Date.now() + SESSION_TTL_MS;
  req.sessionId = sessionId;
  req.user = session.user;

  return next();
}

export function requireSession(req, res, next) {
  if (!req.isAuthenticated()) {
    return res.status(401).json({
      error: {
        code: 'UNAUTHENTICATED',
        message: 'Login is required.',
      },
    });
  }

  return next();
}
