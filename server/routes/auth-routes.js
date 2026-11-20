import express from "express";
import passport from "../config/passport.js";

import {
  changeUserPassword,
  getUserByEmail,
  registerHiker,
} from "../dao/auth-dao.js";
import { requireAuth } from "../middleware/require-auth.js";
import {
  hashPassword,
  isAcceptableNewPassword,
  getNewPasswordError,
  verifyPassword,
} from "../services/password.js";

const router = express.Router();

/**
 * @param {'hiker' | 'staff'} area
 * @returns {import('express').RequestHandler}
 */
function loginFor(area) {
  return (req, res, next) => {
    const { email, password } = req.body ?? {};

    if (
      typeof email !== "string" ||
      typeof password !== "string" ||
      email.trim().length === 0 ||
      password.length === 0
    ) {
      return res.status(400).json({
        error: {
          code: "INVALID_CREDENTIALS",
          message: "Email and password are required.",
        },
      });
    }

    passport.authenticate(
      "local",
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
              code: "INVALID_CREDENTIALS",
              message: "Email or password is incorrect.",
            },
          });
        }

        const allowed =
          area === "hiker"
            ? user.role === "hiker"
            : user.role === "employee" || user.role === "warden";

        if (!allowed) {
          return res.status(401).json({
            error: {
              code: "INVALID_CREDENTIALS",
              message: "Email or password is incorrect.",
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

router.post("/hikers", async (req, res, next) => {
  try {
    const {
      fullName,
      email,
      phone,
      notes,
      emergencyContact,
      password,
      confirmPassword,
    } = req.body ?? {};

    const name = typeof fullName === "string" ? fullName.trim() : "";
    const address = typeof email === "string" ? email.trim().toLowerCase() : "";

    if (name.length === 0 || name.length > 100) {
      return res.status(400).json({
        error: {
          code: "INVALID_NAME",
          message: "Enter a full name of up to 100 characters.",
        },
      });
    }

    if (address.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) {
      return res.status(400).json({
        error: {
          code: "INVALID_EMAIL",
          message: "Enter a valid email address.",
        },
      });
    }

    const phoneText = typeof phone === "string" ? phone.trim() : "";
    const normalizedPhone = phoneText.replace(/[\s().-]/g, "");

    if (phoneText.length > 30 || !/^\+?\d{6,15}$/.test(normalizedPhone)) {
      return res.status(400).json({
        error: {
          field: "phone",
          code: "INVALID_PHONE",
          message: phoneText
            ? "Enter 6 to 15 digits, optionally starting with +."
            : "Enter your mobile number.",
        },
      });
    }

    const optionalFields = [
      { field: "notes", value: notes, code: "INVALID_NOTES" },
      {
        field: "emergencyContact",
        value: emergencyContact,
        code: "INVALID_EMERGENCY_CONTACT",
      },
    ];

    for (const { field, value, code } of optionalFields) {
      if (
        value != null &&
        (typeof value !== "string" || value.trim().length > 500)
      ) {
        return res.status(400).json({
          error: {
            field,
            code,
            message: "Enter text of up to 500 characters.",
          },
        });
      }
    }

    const passwordError = getNewPasswordError(password, confirmPassword);

    if (passwordError) {
      return res.status(400).json({ error: passwordError });
    }

    const passwordHash = await hashPassword(password);
    const hiker = await registerHiker(
      name,
      address,
      passwordHash,
      normalizedPhone,
      notes?.trim() || null,
      emergencyContact?.trim() || null,
    );

    if (!hiker) {
      return res.status(409).json({
        error: {
          code: "EMAIL_ALREADY_REGISTERED",
          message: "This email is already associated with an account.",
        },
      });
    }

    return res.status(201).json({ id: hiker.id });
  } catch (error) {
    return next(error);
  }
});

router.post("/sessions", loginFor("hiker"));
router.post("/staff/sessions", loginFor("staff"));

router.get("/sessions/current", requireAuth, (req, res) => {
  return res.json({ user: req.user });
});

router.put(
  "/sessions/current/password",
  requireAuth,
  async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          error: {
            code: "UNAUTHENTICATED",
            message: "Login is required.",
          },
        });
      }

      const sessionUser = req.user;
      const { currentPassword, newPassword, confirmPassword } = req.body ?? {};

      if (typeof currentPassword !== "string" || currentPassword.length === 0) {
        return res.status(400).json({
          error: {
            field: "currentPassword",
            code: "INVALID_PASSWORD",
            message: "Enter your current password.",
          },
        });
      }

      const passwordError = getNewPasswordError(newPassword, confirmPassword);

      if (passwordError) {
        return res.status(400).json({
          error: {
            ...passwordError,
            field:
              passwordError.field === "password"
                ? "newPassword"
                : "confirmPassword",
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
            code: "INVALID_PASSWORD",
            message: "The current password is incorrect.",
          },
        });
      }

      if (currentPassword === newPassword) {
        return res.status(400).json({
          error: {
            code: "INVALID_PASSWORD",
            message: "The new password must differ from the current password.",
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
            code: "ACCOUNT_NOT_FOUND",
            message: "The account could not be updated.",
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

router.delete("/sessions/current", (req, res, next) => {
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
      res.clearCookie("mountain-hut.sid", {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.COOKIE_SECURE === "true",
      });

      return res.status(204).end();
    });
  });
});

export default router;
