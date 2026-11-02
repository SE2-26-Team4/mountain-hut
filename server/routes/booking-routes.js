import express from 'express';

import { BookingError } from '../dao/booking-dao.js';
import { requireRole } from '../middleware/require-role.js';
import {
  createBookingForHiker,
  getMealSlotAvailability,
} from '../services/booking-service.js';

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

/* READ */

router.get(
  '/bookings/availability',
  asyncRoute(async (req, res) => {
    const { bookingDate } = req.query;
    const rawSlotId = req.query.slotId;

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

    // The service validates the calendar date and numeric slot ID.
    const availability = await getMealSlotAvailability(
      bookingDate,
      Number(rawSlotId)
    );

    if (!availability) {
      return res.status(404).json({
        error: {
          code: 'MEAL_SLOT_NOT_FOUND',
          message: 'The requested active meal slot was not found.',
        },
      });
    }

    return res.status(200).json({ availability });
  })
);

/* CREATE */

router.post(
  '/bookings',
  requireRole('hiker'),
  asyncRoute(async (req, res) => {
    const user = req.user;

    if (!user) {
      return res.status(401).json({
        error: {
          code: 'UNAUTHENTICATED',
          message: 'Login is required.',
        },
      });
    }

    const { bookingDate, slotId, partySize } = req.body ?? {};

    // Availability and allocations are checked inside the DAO transaction.
    const booking = await createBookingForHiker({
      hikerId: user.id,
      bookingDate,
      slotId,
      partySize,
    });

    return res.status(201).json({ booking });
  })
);

/* ERROR HANDLING */

/** @type {import('express').ErrorRequestHandler} */
const handleBookingError = (error, _req, res, next) => {
  if (res.headersSent) {
    return next(error);
  }

  if (error instanceof BookingError) {
    let status;

    switch (error.code) {
      case 'INVALID_BOOKING':
      case 'INVALID_PARTY_SIZE':
        status = 400;
        break;

      case 'SLOT_NOT_FOUND':
        status = 404;
        break;

      case 'SLOT_INACTIVE':
      case 'NO_AVAILABILITY':
        status = 409;
        break;

      default:
        console.error('Unexpected booking error:', error);

        return res.status(500).json({
          error: {
            code: 'INTERNAL_SERVER_ERROR',
            message: 'An unexpected error occurred.',
          },
        });
    }

    return res.status(status).json({
      error: {
        code: error.code,
        message: error.message,
      },
    });
  }

  if (error?.code === 'SQLITE_BUSY') {
    return res.status(503).json({
      error: {
        code: 'DATABASE_BUSY',
        message: 'The service is temporarily busy. Please try again later.',
      },
    });
  }

  console.error('Booking API error:', error);

  return res.status(500).json({
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred.',
    },
  });
};

router.use(handleBookingError);

export default router;