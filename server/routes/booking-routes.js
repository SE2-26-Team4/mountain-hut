import express from "express";

import {
  BookingError,
  cancelBooking,
  getBookingById,
  getBookingsByHiker,
} from "../dao/booking-dao.js";
import { requireRole, requireStaff } from "../middleware/require-role.js";
import { getDiningTables, getMealSlots } from "../dao/capacity-dao.js";
import { buildBookingConfirmationEmail } from "../services/booking-confirmation-content.js";
import { sendBookingConfirmationEmail } from "../services/booking-confirmation-service.js";
import {
  createBookingByStaff,
  createBookingForHiker,
  findHikers,
  getMealSlotAvailability,
  registerHikerByStaff,
} from "../services/booking-service.js";

/**
 * @typedef {import('../models/models.js').BookingDTO} BookingDTO
 */

/** @param {string} [saved] */
function dietaryRequirementsForEmail(saved = "") {
  if (!saved) return [];

  try {
    const entries = JSON.parse(saved);

    if (
      Array.isArray(entries) &&
      entries.every(
        (entry) =>
          typeof entry?.description === "string" &&
          typeof entry?.hasAllergies === "boolean",
      )
    ) {
      return entries.map(({ description, hasAllergies }, index) => ({
        description,
        hasAllergies,
        label: `Dietary requirement · Guest ${index + 1}`,
      }));
    }
  } catch {
    // Fall back to the stored text if the list cannot be parsed.
  }

  return [
    {
      hasAllergies: false,
      description: `Dietary requirements:\n${saved}`,
    },
  ];
}

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

/**
 * Sends the confirmation email for a booking that has already been saved.
 * Delivery failures are logged and never undo a valid booking or
 * encourage the client to submit it again.
 * Hikers without an email (temporary hikers) receive no confirmation.
 *
 * @param {{ full_name: string, email: string | null }} hiker
 * @param {BookingDTO} booking
 * @param {boolean} [isEdit]
 * @returns {Promise<boolean>} True when the sending service accepted the email.
 */
async function sendBookingConfirmation(hiker, booking, isEdit = false) {
  const recipient = hiker.email;

  if (!recipient) {
    return false;
  }

  try {
    // Load slot details and table names for the confirmation message.
    const [mealSlots, tables] = await Promise.all([
      getMealSlots(),
      getDiningTables(),
    ]);

    const mealSlot = mealSlots.find((slot) => slot.id === booking.slotId);

    if (!mealSlot) {
      throw new Error(`Meal slot ${booking.slotId} not found.`);
    }

    // Include only tables allocated to this booking.
    const allocatedTableIds = new Set(
      booking.allocations.map((allocation) => allocation.tableId),
    );

    // Build the confirmation using saved booking details.
    // Include optional requests without automatically classifying them
    // as allergies; their full description remains in the message.
    const email = buildBookingConfirmationEmail({
      isEdit,
      hiker: { full_name: hiker.full_name, email: recipient },
      booking,
      mealSlot,
      tables: tables.filter((table) => allocatedTableIds.has(table.id)),
      requirements: [
        ...dietaryRequirementsForEmail(booking.dietaryRequirements),
        ...(booking.specialRequests
          ? [
              {
                hasAllergies: false,
                description: `Special requests:\n${booking.specialRequests}`,
              },
            ]
          : []),
      ],
    });

    // Report success when the sending service completes.
    // This does not confirm that it has reached the recipient's inbox.
    await sendBookingConfirmationEmail(email);

    return true;
  } catch (emailError) {
    // Log email failures while preserving the successfully saved booking.
    console.error(
      "Booking saved, but confirmation email could not be sent:",
      emailError,
    );

    return false;
  }
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

  const {
    bookingDate,
    slotId,
    partySize,
    dietaryRequirements,
    specialRequests,
  } = req.body ?? {};

  const bookingData = {
    hikerId: user.id,
    bookingDate,
    slotId,
    partySize,
    dietaryRequirements,
    specialRequests,
  };

  const booking = isEdit
    ? await createBookingForHiker(bookingData, bookingId)
    : await createBookingForHiker(bookingData);

  // [REQUIREMENT] MH-06: When a change has been done the change to the reservation should be notified by email.
  const emailSent = await sendBookingConfirmation(user, booking, isEdit);

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

/* STAFF BOOKINGS */

// Find hikers, including temporary ones, by name, email or phone.
// [REQUIREMENT] MH-07: The hiker can be already present in the system
// (can be matched by name, phone or email).
router.get(
  "/staff/hikers",
  requireStaff,
  asyncRoute(async (req, res) => {
    // The service rejects missing, too short or too long search terms,
    // so the whole list of hikers is never returned at once.
    const hikers = await findHikers(req.query.search);

    return res.status(200).json({ hikers });
  }),
);

// Register a new full or temporary hiker without creating a booking.
// [REQUIREMENT] MH-07: If the hiker is missing, it is possible to enter the full details
// and create a regular hiker profile that can later use the system web interface,
// or quickly provide minimal info (name + optional phone), leading to a temporary
// hiker that is not entitled to login and operate via web.
router.post(
  "/staff/hikers",
  requireStaff,
  asyncRoute(async (req, res) => {
    // The service validates the hiker type and fields.
    // [REQUIREMENT] MH-07: If a full hiker account is created, the password is randomly
    // generated, it can be communicated to the hiker e.g. verbally.
    // It is returned only in this response, so that staff can communicate it.
    const registration = await registerHikerByStaff(req.body);

    return res.status(201).json(registration);
  }),
);

// Create a booking entered by staff for an existing, new or temporary hiker.
// [REQUIREMENT] MH-07: As an employee I want to enter a reservation for a hiker,
// so that I can accept reservations via other channels than web.
// [REQUIREMENT] MH-07: The procedure must allow to either quickly enter name and possibly
// phone or enter the full details of the hiker, in addition to the reservation details.
router.post(
  "/staff/bookings",
  requireStaff,
  asyncRoute(async (req, res) => {
    const {
      hiker,
      confirmationEmail,
      bookingDate,
      slotId,
      partySize,
      dietaryRequirements,
      specialRequests,
    } = req.body ?? {};

    let temporaryRecipient = null;

    if (confirmationEmail !== undefined) {
      const email =
        typeof confirmationEmail === "string" ? confirmationEmail.trim() : "";

      if (
        hiker?.type !== "temporary" ||
        email.length > 254 ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
      ) {
        throw new BookingError(
          "INVALID_HIKER",
          "Enter a valid confirmation email for the temporary hiker.",
        );
      }

      temporaryRecipient = email;
    }

    // The service validates the request; the DAO creates the hiker (if new)
    // and the booking in one transaction, reusing the availability checks
    // and table allocation.
    // [REQUIREMENT] MH-07: There is only one time constraint for employee-made
    // reservations: they cannot be made after the beginning of the time slot.
    const result = await createBookingByStaff({
      hiker: temporaryRecipient
        ? { ...hiker, email: temporaryRecipient }
        : hiker,
      bookingDate,
      slotId,
      partySize,
      dietaryRequirements,
      specialRequests,
    });

    // Send the booking confirmation when the hiker has an email address.
    const emailRecipient = result.hiker.email;

    const emailSent = await sendBookingConfirmation(
      { full_name: result.hiker.fullName, email: emailRecipient },
      result.booking,
    );

    return res.status(201).json({ ...result, emailSent, emailRecipient });
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
      case "INVALID_HIKER":
        status = 400;
        break;

      // A requested meal slot or hiker does not exist.
      case "SLOT_NOT_FOUND":
      case "BOOKING_NOT_FOUND":
      case "HIKER_NOT_FOUND":
        status = 404;
        break;

      // The request conflicts with availability, booking or account rules.
      case "SLOT_INACTIVE":
      case "NO_AVAILABILITY":
      case "DUPLICATE_BOOKING":
      case "BOOKING_EDIT_TOO_LATE":
      case "BOOKING_TOO_LATE":
      case "EMAIL_ALREADY_REGISTERED":
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
