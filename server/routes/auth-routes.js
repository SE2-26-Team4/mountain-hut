import { Router } from 'express';

import { findUserByEmail } from '../dao/auth-dao.js';
import {
  createSession,
  destroySession,
  requireSession,
  setSessionCookie,
  clearSessionCookie,
} from '../middleware/session.js';
import { verifyPassword } from '../services/password.js';

const router = Router();

function asyncHandler(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

router.post('/sessions', asyncHandler(async (req, res) => {
  const email = typeof req.body?.email === 'string'
    ? req.body.email.trim().toLowerCase()
    : '';
  const password = typeof req.body?.password === 'string'
    ? req.body.password
    : '';

  if (!email || !password) {
    return res.status(400).json({
      error: {
        code: 'INVALID_REQUEST',
        message: 'Email and password are required.',
      },
    });
  }

  const user = await findUserByEmail(email);
  const passwordMatches = user
    ? await verifyPassword(password, user.passwordHash)
    : false;

  if (!passwordMatches) {
    return res.status(401).json({
      error: {
        code: 'INVALID_CREDENTIALS',
        message: 'Email or password is incorrect.',
      },
    });
  }

  const publicUser = {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    role: user.role,
  };
  const sessionId = createSession(publicUser);

  setSessionCookie(res, sessionId);

  return res.status(201).json({ user: publicUser });
}));

router.get('/sessions/current', requireSession, (req, res) => {
  res.status(200).json({ user: req.user });
});

router.delete('/sessions/current', (req, res) => {
  if (req.sessionId) {
    destroySession(req.sessionId);
  }

  clearSessionCookie(res);
  res.status(204).end();
});

export default router;