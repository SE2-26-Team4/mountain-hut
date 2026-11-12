import express from "express";

import {
  BookingError,
  cancelBooking,
  getBookingById,
  getBookingsByHiker,
} from "../dao/booking-dao.js";
import { requireRole } from "../middleware/require-role.js";
import { getDiningTables, getMealSlots } from "../dao/capacity-dao.js";
import { buildBookingConfirmationEmail } from "../services/booking-confirmation-content.js";
import { sendBookingConfirmationEmail } from "../services/booking-confirmation-service.js";
import {
  createBookingForHiker,
  getMealSlotAvailability,
} from "../services/booking-service.js";

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

/* CREATE AND UPDATE */

// Use the same booking validation and persistence flow for creation and edits.
const saveBooking = asyncRoute(async (req, res) => {
  const user = req.user;
  const isEdit = req.method === "PUT";
  const rawBookingId = req.params.id;
  const bookingId = Number(rawBookingId);

  if (
    isEdit &&
    (typeof rawBookingId !== "string" ||
      !/^[1-9]\d*$/.test(rawBookingId) ||
      !Number.isSafeInteger(bookingId))
  ) {
    throw new BookingError(
      "INVALID_BOOKING",
      "A valid booking ID is required.",
    );
  }

  if (!user) {
    return res.status(401).json({
      error: {
        code: "UNAUTHENTICATED",
        message: "Login is required.",
      },
    });
  }

  const { bookingDate, slotId, partySize, specialRequests } = req.body ?? {};

  const bookingData = {
    hikerId: user.id,
    bookingDate,
    slotId,
    partySize,
    specialRequests,
  };

  const booking = isEdit
    ? await createBookingForHiker(bookingData, bookingId)
    : await createBookingForHiker(bookingData);

  // [REQUIREMENT] When a change has been done the change to the reservation should be notified by email.
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
      booking.allocations.map((allocation) => allocation.tableId),
    );

    const email = buildBookingConfirmationEmail({
      isEdit,
      hiker: user,
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
    console.error(
      "Booking saved, but confirmation email could not be sent:",
      emailError,
    );
  }

  return res.status(isEdit ? 200 : 201).json({ booking, emailSent });
});

router.post("/bookings", requireRole("hiker"), saveBooking);
router.put("/bookings/:id", requireRole("hiker"), saveBooking);

/* READ */

// Return bookings belonging to the authenticated hiker.
router.get(
  "/bookings",
  requireRole("hiker"),
  asyncRoute(async (req, res) => {
    const user = req.user;

    // Ensure an authenticated user is available before reading their bookings.
    if (!user) {
      return res.status(401).json({
        error: {
          code: "UNAUTHENTICATED",
          message: "Login is required.",
        },
      });
    }

    // Use the session user's ID rather than an ID supplied by the client.
    const bookings = await getBookingsByHiker(user.id);

    return res.status(200).json({ bookings });
  }),
);

// Expose seat availability for a date and meal slot without requiring login.
router.get(
  "/bookings/availability",
  asyncRoute(async (req, res) => {
    const { bookingDate } = req.query;
    const rawSlotId = req.query.slotId;

    // Require a date string and a slot ID written as a positive integer.
    if (
      typeof bookingDate !== "string" ||
      typeof rawSlotId !== "string" ||
      !/^[1-9]\d*$/.test(rawSlotId)
    ) {
      return res.status(400).json({
        error: {
          code: "INVALID_BOOKING",
          message: "A valid booking date and meal-slot ID are required.",
        },
      });
    }

    // The service validates the calendar date and numeric slot ID,
    // then calculates the remaining seats.
    const availability = await getMealSlotAvailability(
      bookingDate,
      Number(rawSlotId),
    );

    // Report a slot that does not exist, is inactive, or does not match the date.
    if (!availability) {
      return res.status(404).json({
        error: {
          code: "MEAL_SLOT_NOT_FOUND",
          message: "The requested active meal slot was not found.",
        },
      });
    }

    // Availability is informative; this endpoint does not reserve seats.
    return res.status(200).json({ availability });
  }),
);

/* DELETE */

// Cancel a confirmed booking owned by the authenticated hiker.
router.delete(
  "/bookings/:id",
  requireRole("hiker"),
  asyncRoute(async (req, res) => {
    const user = req.user;
    const rawBookingId = req.params.id;
    const bookingId = Number(rawBookingId);

    // Reject malformed IDs and numbers outside the safe integer range.
    if (
      typeof rawBookingId !== "string" ||
      !/^[1-9]\d*$/.test(rawBookingId) ||
      !Number.isSafeInteger(bookingId)
    ) {
      return res.status(400).json({
        error: {
          code: "INVALID_BOOKING",
          message: "A valid booking ID is required.",
        },
      });
    }

    // Require a session user before attempting cancellation.
    if (!user) {
      return res.status(401).json({
        error: {
          code: "UNAUTHENTICATED",
          message: "Login is required.",
        },
      });
    }

    // Restrict cancellation to bookings owned by this hiker.
    const cancelled = await cancelBooking(bookingId, user.id);

    // Use the same response for missing, already cancelled, or unowned bookings.
    if (!cancelled) {
      return res.status(404).json({
        error: {
          code: "BOOKING_NOT_FOUND",
          message: "The requested booking was not found.",
        },
      });
    }

    // Return the booking with its updated cancellation status.
    const booking = await getBookingById(bookingId);

    return res.status(200).json({ booking });
  }),
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
      case "INVALID_BOOKING":
      case "INVALID_PARTY_SIZE":
        status = 400;
        break;

      // Return 404 when the booking or meal slot is unavailable to the hiker.
      case "BOOKING_NOT_FOUND":
      case "SLOT_NOT_FOUND":
        status = 404;
        break;

      // Return 409 when availability or a booking rule prevents the request.
      case "SLOT_INACTIVE":
      case "NO_AVAILABILITY":
      case "DUPLICATE_BOOKING":
      case "BOOKING_EDIT_TOO_LATE":
      case "BOOKING_TOO_LATE":
        status = 409;
        break;

      // Unrecognized booking error codes are treated as server failures.
      default:
        console.error("Unexpected booking error:", error);

        return res.status(500).json({
          error: {
            code: "INTERNAL_SERVER_ERROR",
            message: "An unexpected error occurred.",
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
  if (error?.code === "SQLITE_BUSY") {
    return res.status(503).json({
      error: {
        code: "DATABASE_BUSY",
        message: "The service is temporarily busy. Please try again later.",
      },
    });
  }

  // Log unexpected failures and return a generic message to the client.
  console.error("Booking API error:", error);

  return res.status(500).json({
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message: "An unexpected error occurred.",
    },
  });
};

// Register the error handler after all booking routes.
router.use(handleBookingError);

export default router;
