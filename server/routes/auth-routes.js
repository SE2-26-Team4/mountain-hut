import express from 'express';
import passport from '../config/passport.js';

import { requireAuth } from '../middleware/require-auth.js';

const router = express.Router();

/* AUTHENTICATION */

// [Minimal login setup (backend)]: Authenticate a user and create a session.
router.post('/sessions', (req, res, next) => {
  const { email, password } = req.body ?? {};

  if (
    typeof email !== 'string' ||
    typeof password !== 'string' ||
    email.trim().length === 0 ||
    password.length === 0
  ) {
    return res.status(400).json({
      error: {
        code: 'INVALID_CREDENTIALS',
        message: 'Email and password are required.',
      },
    });
  }

  passport.authenticate('local', (error, user) => {
    if (error) {
      return next(error);
    }

    if (!user) {
      return res.status(401).json({
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Email or password is incorrect.',
        },
      });
    }

    req.logIn(user, (loginError) => {
      if (loginError) {
        return next(loginError);
      }

      return res.status(201).json({ user: req.user });
    });
  })(req, res, next);
});

// [Minimal login setup (backend)]: Return the user restored from the current session.
router.get('/sessions/current', requireAuth, (req, res) => {
  return res.json({ user: req.user });
});

// [Minimal login setup (backend)]: Destroy the current login session.
router.delete('/sessions/current', (req, res, next) => {
  if (!req.isAuthenticated()) {
    return res.status(204).end();
  }

  req.logout((logoutError) => {
    if (logoutError) {
      return next(logoutError);
    }

    req.session.destroy((sessionError) => {
      if (sessionError) {
        return next(sessionError);
      }

      res.clearCookie('mountain-hut.sid', {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.COOKIE_SECURE === 'true',
      });

      return res.status(204).end();
    });
  });
});

export default router;
