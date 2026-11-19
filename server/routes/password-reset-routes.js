import express from 'express';

import { sendBookingConfirmationEmail } from '../services/booking-confirmation-service.js';
import {
  buildPasswordChangedEmail,
  buildPasswordResetEmail,
} from '../services/password-reset-content.js';
import {
  checkPasswordResetToken,
  createPasswordResetRequest,
  PasswordResetError,
  resetPassword,
} from '../services/password-reset-service.js';

/**
 * @typedef {import('../services/password-reset-service.js').PasswordResetRequest} PasswordResetRequest
 * @typedef {import('../dao/password-reset-dao.js').RecoverableAccount} RecoverableAccount
 */

const router = express.Router();

/**
 * Forwards rejected promises to Express error-handling middleware.
 *
 * @param {(
 *   req: import('express').Request,
 *   res: import('express').Response
 * ) => Promise<unknown>} handler
 * @returns {import('express').RequestHandler}
 */
function asyncRoute(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res)).catch(next);
  };
}

/**
 * Sends the reset link. Failures are only logged: the response must not
 * reveal whether an account exists or whether the email could be sent.
 *
 * @param {PasswordResetRequest} resetRequest
 * @returns {Promise<void>}
 */
async function sendResetLink({ account, token }) {
  try {
    await sendBookingConfirmationEmail(
      buildPasswordResetEmail({
        fullName: account.fullName,
        email: account.email,
        token,
      }),
    );
  } catch (emailError) {
    console.error('Password reset email could not be sent:', emailError);
  }
}

/**
 * Notifies the hiker that the password changed. A failure does not undo
 * the new password.
 *
 * @param {RecoverableAccount} account
 * @returns {Promise<void>}
 */
async function sendPasswordChangedNotice(account) {
  try {
    await sendBookingConfirmationEmail(
      buildPasswordChangedEmail({
        fullName: account.fullName,
        email: account.email,
      }),
    );
  } catch (emailError) {
    console.error(
      'Password reset, but the notification email could not be sent:',
      emailError,
    );
  }
}

// [REQUIREMENT] MH-07: In any case the hiker can recover their password via email.
// The same answer is returned whether or not the email belongs to a hiker.
router.post(
  '/password-reset-requests',
  asyncRoute(async (req, res) => {
    const resetRequest = await createPasswordResetRequest(req.body?.email);

    // Send the email without waiting for it, so that the response time
    // does not reveal whether an account exists.
    if (resetRequest) {
      void sendResetLink(resetRequest);
    }

    return res.status(202).json({
      message:
        'If a hiker account uses this email, we have sent a link to choose a new password. The link expires in 24 hours.',
    });
  }),
);

// Check a reset link when its page opens: a link that was already used,
// replaced or has expired cannot set a password, and a new one is needed.
router.post(
  '/password-reset-checks',
  asyncRoute(async (req, res) => {
    await checkPasswordResetToken(req.body?.token);

    return res.status(204).end();
  }),
);

// Set a new password with the token received by email.
router.post(
  '/password-resets',
  asyncRoute(async (req, res) => {
    const account = await resetPassword(req.body ?? {});

    await sendPasswordChangedNotice(account);

    return res.status(200).json({
      message: 'Your password has been reset. You can now sign in.',
    });
  }),
);

/**
 * Reports invalid reset requests as client errors and any other failure
 * with a generic message.
 *
 * @type {import('express').ErrorRequestHandler}
 */
const handlePasswordResetError = (error, _req, res, _next) => {
  if (error instanceof PasswordResetError) {
    return res.status(400).json({
      error: {
        code: error.code,
        message: error.message,
      },
    });
  }

  console.error('Password reset API error:', error);

  return res.status(500).json({
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred.',
    },
  });
};

router.use(handlePasswordResetError);

export default router;
