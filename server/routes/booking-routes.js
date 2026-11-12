import express from 'express';

import {
  BookingError,
  cancelBooking,
  getBookingById,
  getBookingsByHiker,
} from '../dao/booking-dao.js';
import { requireRole, requireStaff } from '../middleware/require-role.js';
import { getDiningTables, getMealSlots } from '../dao/capacity-dao.js';
import { buildBookingConfirmationEmail } from '../services/booking-confirmation-content.js';
import { sendBookingConfirmationEmail } from '../services/booking-confirmation-service.js';
import {
  createBookingForHiker,
  getMealSlotAvailability,
} from '../services/booking-service.js';
import { randomUUID } from 'node:crypto';
import { allAsync, getAsync, runAsync } from '../db.js';
import { hashPassword } from '../services/password.js';



// Group booking endpoints and their error handler in a dedicated router.
const router = express.Router();

/**
 * Forwards rejected promises to Express error-handling middleware.
 *
 * @param {(
 *   req: import('express').Request,
 *   res: import('express').Response,
 *   next: import('express').NextFunction
 * ) => Promise<unknown>} handler
 * @returns {import('express').RequestHandler}
 */
function asyncRoute(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

/* CREATE */

// Create a reservation for the authenticated hiker.
router.post(
  '/bookings',
  requireRole('hiker'),
  asyncRoute(async (req, res) => {
    const user = req.user;

    // Require a session user before accepting a booking.
    if (!user) {
      return res.status(401).json({
        error: {
          code: 'UNAUTHENTICATED',
          message: 'Login is required.',
        },
      });
    }

    // Read the booking selection and optional requests from the request body.
    const {
      bookingDate,
      slotId,
      partySize,
      specialRequests,
    } = req.body ?? {};

    // Validate and persist the booking for the session user.
    // The DAO checks availability and allocates seats atomically.
    const booking = await createBookingForHiker({
      hikerId: user.id,
      bookingDate,
      slotId,
      partySize,
      specialRequests,
    });

    // Send the email after persistence so delivery failures do not undo
    // a valid booking or encourage the client to submit it again.
    let emailSent = false;

    try {
      // Load slot details and table names for the confirmation message.
      const [mealSlots, tables] = await Promise.all([
        getMealSlots(),
        getDiningTables(),
      ]);

      const mealSlot = mealSlots.find(
        (slot) => slot.id === booking.slotId
      );

      if (!mealSlot) {
        throw new Error(`Meal slot ${booking.slotId} not found.`);
      }

      // Include only tables allocated to this booking.
      const allocatedTableIds = new Set(
        booking.allocations.map((allocation) => allocation.tableId)
      );

      // Build the confirmation using saved booking details.
      // Include optional requests without automatically classifying them
      // as allergies; their full description remains in the message.
      const email = buildBookingConfirmationEmail({
        hiker: user,
        booking,
        mealSlot,
        tables: tables.filter((table) =>
          allocatedTableIds.has(table.id)
        ),
        requirements: booking.specialRequests
          ? [
              {
                hasAllergies: false,
                description: booking.specialRequests,
              },
            ]
          : [],
      });

      // Mark the email as sent when the sending service completes successfully.
      // This does not confirm that it has reached the recipient's inbox.
      await sendBookingConfirmationEmail(email);
      emailSent = true;
    } catch (emailError) {
      // Log email failures while preserving the successfully saved booking.
      console.error(
        'Booking saved, but confirmation email could not be sent:',
        emailError
      );
    }

    // Return the booking and email status so the UI can display both outcomes.
    return res.status(201).json({ booking, emailSent });
  })
);

/* READ */

// Return bookings belonging to the authenticated hiker.
router.get(
  '/bookings',
  requireRole('hiker'),
  asyncRoute(async (req, res) => {
    const user = req.user;

    // Ensure an authenticated user is available before reading their bookings.
    if (!user) {
      return res.status(401).json({
        error: {
          code: 'UNAUTHENTICATED',
          message: 'Login is required.',
        },
      });
    }

    // Use the session user's ID rather than an ID supplied by the client.
    const bookings = await getBookingsByHiker(user.id);

    return res.status(200).json({ bookings });
  })
);

// Expose seat availability for a date and meal slot without requiring login.
router.get(
  '/bookings/availability',
  asyncRoute(async (req, res) => {
    const { bookingDate } = req.query;
    const rawSlotId = req.query.slotId;

    // Require a date string and a slot ID written as a positive integer.
    if (
      typeof bookingDate !== 'string' ||
      typeof rawSlotId !== 'string' ||
      !/^[1-9]\d*$/.test(rawSlotId)
    ) {
      return res.status(400).json({
        error: {
          code: 'INVALID_BOOKING',
          message: 'A valid booking date and meal-slot ID are required.',
        },
      });
    }

    // The service validates the calendar date and numeric slot ID,
    // then calculates the remaining seats.
    const availability = await getMealSlotAvailability(
      bookingDate,
      Number(rawSlotId)
    );

    // Report a slot that does not exist, is inactive, or does not match the date.
    if (!availability) {
      return res.status(404).json({
        error: {
          code: 'MEAL_SLOT_NOT_FOUND',
          message: 'The requested active meal slot was not found.',
        },
      });
    }

    // Availability is informative; this endpoint does not reserve seats.
    return res.status(200).json({ availability });
  })
);

/* DELETE */

// Cancel a confirmed booking owned by the authenticated hiker.
router.delete(
  '/bookings/:id',
  requireRole('hiker'),
  asyncRoute(async (req, res) => {
    const user = req.user;
    const rawBookingId = req.params.id;
    const bookingId = Number(rawBookingId);

    // Reject malformed IDs and numbers outside the safe integer range.
    if (
      typeof rawBookingId !== 'string' ||
      !/^[1-9]\d*$/.test(rawBookingId) ||
      !Number.isSafeInteger(bookingId)
    ) {
      return res.status(400).json({
        error: {
          code: 'INVALID_BOOKING',
          message: 'A valid booking ID is required.',
        },
      });
    }

    // Require a session user before attempting cancellation.
    if (!user) {
      return res.status(401).json({
        error: {
          code: 'UNAUTHENTICATED',
          message: 'Login is required.',
        },
      });
    }

    // Restrict cancellation to bookings owned by this hiker.
    const cancelled = await cancelBooking(bookingId, user.id);

    // Use the same response for missing, already cancelled, or unowned bookings.
    if (!cancelled) {
      return res.status(404).json({
        error: {
          code: 'BOOKING_NOT_FOUND',
          message: 'The requested booking was not found.',
        },
      });
    }

    // Return the booking with its updated cancellation status.
    const booking = await getBookingById(bookingId);

    return res.status(200).json({ booking });
  })
);

/* STAFF HIKERS & BOOKINGS */

router.get(
  '/staff/hikers',
  requireStaff,
  asyncRoute(async (req, res) => {
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    let hikers;

    if (search) {
      hikers = await allAsync(
        `SELECT id, full_name, email, role FROM users
         WHERE role = 'hiker' AND (full_name LIKE ? OR email LIKE ?)
         ORDER BY full_name LIMIT 50`,
        [`%${search}%`, `%${search}%`]
      );
    } else {
      hikers = await allAsync(
        `SELECT id, full_name, email, role FROM users
         WHERE role = 'hiker'
         ORDER BY full_name LIMIT 50`
      );
    }

    return res.status(200).json({ hikers });
  })
);

router.post(
  '/staff/hikers',
  requireStaff,
  asyncRoute(async (req, res) => {
    const { full_name, email } = req.body ?? {};

    if (
      typeof full_name !== 'string' ||
      !full_name.trim() ||
      typeof email !== 'string' ||
      !email.trim() ||
      !email.includes('@')
    ) {
      return res.status(400).json({
        error: {
          code: 'INVALID_INPUT',
          message: 'A valid full name and email address are required.',
        },
      });
    }

    const trimmedName = full_name.trim();
    const trimmedEmail = email.trim().toLowerCase();

    const existing = await getAsync('SELECT id FROM users WHERE email = ?', [trimmedEmail]);
    if (existing) {
      return res.status(409).json({
        error: {
          code: 'DUPLICATE_EMAIL',
          message: `A user with email "${trimmedEmail}" already exists.`,
        },
      });
    }

    const tempPassword = randomUUID();
    const passwordHash = await hashPassword(tempPassword);

    const result = await runAsync(
      `INSERT INTO users (full_name, email, password_hash, role)
       VALUES (?, ?, ?, 'hiker')`,
      [trimmedName, trimmedEmail, passwordHash]
    );

    const hiker = {
      id: result.lastID,
      full_name: trimmedName,
      email: trimmedEmail,
      role: 'hiker',
    };

    return res.status(201).json({ hiker });
  })
);

router.post(
  '/staff/bookings',
  requireStaff,
  asyncRoute(async (req, res) => {
    const { hikerId, bookingDate, slotId, partySize, specialRequests } = req.body ?? {};

    if (!Number.isSafeInteger(Number(hikerId)) || Number(hikerId) <= 0) {
      return res.status(400).json({
        error: {
          code: 'INVALID_BOOKING',
          message: 'A valid hiker ID is required.',
        },
      });
    }

    const hiker = await getAsync('SELECT id, full_name, email, role FROM users WHERE id = ? AND role = ?', [Number(hikerId), 'hiker']);
    if (!hiker) {
      return res.status(404).json({
        error: {
          code: 'HIKER_NOT_FOUND',
          message: 'The requested hiker was not found.',
        },
      });
    }

    const booking = await createBookingForHiker({
      hikerId: Number(hikerId),
      bookingDate,
      slotId,
      partySize,
      specialRequests,
    });

    let emailSent = false;
    try {
      const [mealSlots, tables] = await Promise.all([
        getMealSlots(),
        getDiningTables(),
      ]);

      const mealSlot = mealSlots.find((slot) => slot.id === booking.slotId);
      if (!mealSlot) {
        throw new Error(`Meal slot ${booking.slotId} not found.`);
      }

      const allocatedTableIds = new Set(
        booking.allocations.map((allocation) => allocation.tableId)
      );

      const email = buildBookingConfirmationEmail({
        hiker,
        booking,
        mealSlot,
        tables: tables.filter((table) => allocatedTableIds.has(table.id)),
        requirements: booking.specialRequests
          ? [{ hasAllergies: false, description: booking.specialRequests }]
          : [],
      });

      await sendBookingConfirmationEmail(email);
      emailSent = true;
    } catch (emailError) {
      console.error('Staff booking saved, but confirmation email could not be sent:', emailError);
    }

    return res.status(201).json({ booking, emailSent });
  })
);

/* ERROR HANDLING */

/** @type {import('express').ErrorRequestHandler} */
const handleBookingError = (error, _req, res, next) => {
  // Delegate if a response has already started, avoiding a second response.
  if (res.headersSent) {
    return next(error);
  }

  // Translate known booking failures into appropriate HTTP status codes.
  if (error instanceof BookingError) {
    let status;

    switch (error.code) {
      // Invalid request data is reported as a client input error.
      case 'INVALID_BOOKING':
      case 'INVALID_PARTY_SIZE':
        status = 400;
        break;

      // A requested meal slot does not exist.
      case 'SLOT_NOT_FOUND':
        status = 404;
        break;

      // The request conflicts with availability or booking rules.
      case 'SLOT_INACTIVE':
      case 'NO_AVAILABILITY':
      case 'DUPLICATE_BOOKING':
      case 'BOOKING_TOO_LATE':
        status = 409;
        break;

      // Unrecognized booking error codes are treated as server failures.
      default:
        console.error('Unexpected booking error:', error);

        return res.status(500).json({
          error: {
            code: 'INTERNAL_SERVER_ERROR',
            message: 'An unexpected error occurred.',
          },
        });
    }

    // Preserve the known error code and message for the client.
    return res.status(status).json({
      error: {
        code: error.code,
        message: error.message,
      },
    });
  }

  // Report a temporary database lock as a retryable service failure.
  if (error?.code === 'SQLITE_BUSY') {
    return res.status(503).json({
      error: {
        code: 'DATABASE_BUSY',
        message: 'The service is temporarily busy. Please try again later.',
      },
    });
  }

  // Log unexpected failures and return a generic message to the client.
  console.error('Booking API error:', error);

  return res.status(500).json({
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred.',
    },
  });
};

// Register the error handler after all booking routes.
router.use(handleBookingError);

export default router;