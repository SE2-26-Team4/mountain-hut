import express from 'express';
import passport from '../config/passport.js';

import { requireAuth } from '../middleware/require-auth.js';

const router = express.Router();

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

  passport.authenticate(
    'local',
    /**
     * @param {unknown} error
     * @param {Express.User | false | null | undefined} user
     */
    (error, user) => {
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

      // A custom authentication callback must establish the session explicitly.
      req.logIn(user, (loginError) => {
        if (loginError) {
          return next(loginError);
        }

        return res.status(201).json({ user: req.user });
      });
    },
  )(req, res, next);
});

router.get('/sessions/current', requireAuth, (req, res) => {
  return res.json({ user: req.user });
});

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

      // Match the options used when setting the session cookie.
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