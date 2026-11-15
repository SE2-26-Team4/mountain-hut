import express from 'express';
import passport from '../config/passport.js';

import {
  changeUserPassword,
  getUserByEmail,
} from '../dao/auth-dao.js';
import { requireAuth } from '../middleware/require-auth.js';
import { hashPassword, verifyPassword } from '../services/password.js';

const router = express.Router();

/**
 * @param {'hiker' | 'staff'} area
 * @returns {import('express').RequestHandler}
 */
function loginFor(area) {
  return (req, res, next) => {
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

        const allowed =
          area === 'hiker'
            ? user.role === 'hiker'
            : user.role === 'employee' || user.role === 'warden';

        if (!allowed) {
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
      },
    )(req, res, next);
  };
}

router.post('/sessions', loginFor('hiker'));
router.post('/staff/sessions', loginFor('staff'));

router.get('/sessions/current', requireAuth, (req, res) => {
  return res.json({ user: req.user });
});

router.put(
  '/sessions/current/password',
  requireAuth,
  async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          error: {
            code: 'UNAUTHENTICATED',
            message: 'Login is required.',
          },
        });
      }

      const sessionUser = req.user;
      const {
        currentPassword,
        newPassword,
        confirmPassword,
      } = req.body ?? {};

      if (
        typeof currentPassword !== 'string' ||
        typeof newPassword !== 'string' ||
        typeof confirmPassword !== 'string' ||
        currentPassword.length === 0 ||
        newPassword.length < 8 ||
        newPassword.length > 128 ||
        newPassword !== confirmPassword
      ) {
        return res.status(400).json({
          error: {
            code: 'INVALID_PASSWORD',
            message:
              'The new password must be 8 to 128 characters and match the confirmation.',
          },
        });
      }

      const user = await getUserByEmail(sessionUser.email);

      if (
        !user ||
        !user.password_hash ||
        !(await verifyPassword(currentPassword, user.password_hash))
      ) {
        return res.status(401).json({
          error: {
            code: 'INVALID_PASSWORD',
            message: 'The current password is incorrect.',
          },
        });
      }

      if (currentPassword === newPassword) {
        return res.status(400).json({
          error: {
            code: 'INVALID_PASSWORD',
            message: 'The new password must differ from the current password.',
          },
        });
      }

      const updatedUser = await changeUserPassword(
        sessionUser.id,
        await hashPassword(newPassword),
      );

      if (!updatedUser) {
        return res.status(404).json({
          error: {
            code: 'ACCOUNT_NOT_FOUND',
            message: 'The account could not be updated.',
          },
        });
      }

      req.user = {
        ...updatedUser,
      };

      return res.status(200).json({ user: req.user });
    } catch (error) {
      return next(error);
    }
  },
);

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