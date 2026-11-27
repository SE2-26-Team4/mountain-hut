import express from "express";

import {
  createDiningTable,
  createMealSlot,
  DiningTablesNotFoundError,
  DuplicateNameError,
  getDiningTables,
  getMealSlotCapacity,
  getMealSlotOccupancyByDate,
  getMealSlots,
  setMealSlotTables,
  updateDiningTable,
  updateMealSlot,
  CapacityConflictError,
  TableSlotConflictError,
  DuplicateMealSlotError,
  WeeklyScheduleConflictError,
  copyWeeklySchedule,
  copySelectedWeeks,
  getScheduleCopyHistory,
  getScheduleCopyPreview,
  copyScheduleSeries,
  MealSlotOverlapError,
} from "../dao/capacity-dao.js";
import { requireStaff } from "../middleware/require-role.js";
import {
  validateDiningTable,
  validateMealSlot,
  validateSlotTableAssignment,
  validateWeeklyScheduleCopy,
} from "../services/capacity-validation.js";
import {
  getBookingDeadline,
  getMealStartTimestamp,
} from "../services/booking-time.js";
import { isValidCalendarDate } from "../services/date-validation.js";

/**
 * Data types used to validate capacity configuration requests.
 *
 * @typedef {import('../models/models.js').MealSlotInputDTO} MealSlotInputDTO
 * @typedef {import('../models/models.js').DiningTableInputDTO} DiningTableInputDTO
 * @typedef {import('../models/models.js').UpdateMealSlotCapacityRequestDTO} UpdateMealSlotCapacityRequestDTO
 */

// Group capacity endpoints and their error handler in a dedicated router.
const router = express.Router();

/* HELPERS */

/**
 * Returns a consistent response for invalid request data.
 *
 * @param {import('express').Response} res
 * @param {unknown} error
 */
function sendValidationError(res, error) {
  return res.status(400).json({
    error: {
      code: "INVALID_INPUT",
      message: error instanceof Error ? error.message : "Invalid input.",
    },
  });
}

/**
 * Converts a route parameter to a positive integer.
 * Returns null when the value cannot be accepted as an ID.
 *
 * @param {unknown} value
 * @returns {number | null}
 */
function parsePositiveId(value) {
  if (typeof value !== "string") {
    return null;
  }

  const id = Number(value);

  return Number.isInteger(id) && id > 0 ? id : null;
}

/* WRAPPER */

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

// Allow staff to create a meal slot with a date and time range.
router.post(
  "/capacity/meal-slots",
  requireStaff,
  asyncRoute(async (req, res) => {
    /** @type {MealSlotInputDTO} */
    let mealSlotData;

    // Validate and normalize input before calling the DAO.
    try {
      mealSlotData = validateMealSlot(req.body);

      // Reject new meal slots that have already started in the hut's time zone.
      const startsAt = getMealStartTimestamp(
        mealSlotData.slotDate,
        mealSlotData.startTime,
      );

      if (startsAt <= Date.now()) {
        throw new Error("The meal slot must start in the future.");
      }
    } catch (error) {
      return sendValidationError(res, error);
    }

    // Persist the slot and return the created record.
    const mealSlot = await createMealSlot(mealSlotData);

    return res.status(201).json({ mealSlot });
  }),
);

// Allow staff to create a reusable dining table.
router.post(
  "/capacity/dining-tables",
  requireStaff,
  asyncRoute(async (req, res) => {
    /** @type {DiningTableInputDTO} */
    let diningTableData;

    // Require valid table details, including a positive seat count.
    try {
      diningTableData = validateDiningTable(req.body);
    } catch (error) {
      return sendValidationError(res, error);
    }

    // Save the table independently of its meal-slot assignments.
    const diningTable = await createDiningTable(diningTableData);

    return res.status(201).json({ diningTable });
  }),
);

/* READ */

// Provide a public list of active meal slots and their booking deadlines.
router.get(
  "/meal-slots",
  asyncRoute(async (_req, res) => {
    const mealSlots = await getMealSlots({ requireCapacity: true });

    // Exclude inactive slots and expose deadlines as ISO timestamps.
    return res.json({
      mealSlots: mealSlots
        .filter((mealSlot) => mealSlot.isActive)
        .map((mealSlot) => ({
          ...mealSlot,
          bookingClosesAt: new Date(
            getBookingDeadline(mealSlot.slotDate, mealSlot.startTime),
          ).toISOString(),
        })),
    });
  }),
);

/**
 * @param {unknown} value
 * @returns {value is string}
 */
function isPreviewDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00Z`);

  return (
    Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}

router.get(
  "/capacity/schedule-copies/preview",
  requireStaff,
  asyncRoute(async (req, res) => {
    const { from, to } = req.query;

    if (!isPreviewDate(from) || !isPreviewDate(to) || from > to) {
      return sendValidationError(
        res,
        new Error("Choose a valid destination date range."),
      );
    }

    const preview = await getScheduleCopyPreview(from, to);
    return res.json(preview);
  }),
);

// Return saved weekly schedule copies to staff.
router.get(
  "/capacity/schedule-copies",
  requireStaff,
  asyncRoute(async (_req, res) => {
    const copies = await getScheduleCopyHistory();
    return res.json({ copies });
  }),
);

// Replace a destination week with a copy of a source week's schedule.
router.post(
  "/capacity/meal-slots/copy-weeks",
  requireStaff,
  asyncRoute(async (req, res) => {
    const body = req.body ?? {};
    const { sourceWeekStart, destinations } = body;
    const isSeries = body.mode === "series";
    const excludedWeeks = body.excludedWeeks ?? [];
    const previewBookedWeeks = body.previewBookedWeeks ?? [];

    try {
      if (body.mode !== undefined && !isSeries) {
        throw new Error("Unknown schedule copy mode.");
      }

      if (!Array.isArray(destinations) || destinations.length === 0) {
        throw new Error("Select at least one destination week.");
      }

      if (!isPreviewDate(sourceWeekStart) || sourceWeekStart > "9999-12-24") {
        throw new Error("Choose a valid source week.");
      }

      if (
        !isSeries &&
        (body.excludedWeeks !== undefined ||
          body.previewBookedWeeks !== undefined)
      ) {
        throw new Error("Week exclusions require series mode.");
      }

      const candidates = new Set(destinations);

      if (candidates.size !== destinations.length) {
        throw new Error("Destination weeks must be distinct.");
      }

      for (const list of [excludedWeeks, previewBookedWeeks]) {
        if (
          !Array.isArray(list) ||
          new Set(list).size !== list.length ||
          list.some((start) => !candidates.has(start))
        ) {
          throw new Error("Invalid destination week selection.");
        }
      }

      /** @type {Set<string>} */
      const excluded = new Set(excludedWeeks);

      /** @type {Set<string>} */
      const booked = new Set(previewBookedWeeks);

      if ([...excluded].some((start) => booked.has(start))) {
        throw new Error("A booked week cannot also be manually excluded.");
      }

      if (excluded.size + booked.size === destinations.length) {
        throw new Error("Select at least one available destination week.");
      }

      for (const [index, start] of destinations.entries()) {
        if (!isPreviewDate(start) || start > "9999-12-24") {
          throw new Error("Choose a valid destination week.");
        }

        const offsetDays =
          (Date.parse(start) - Date.parse(destinations[0])) / 86_400_000;

        if (isSeries && offsetDays !== index * 7) {
          throw new Error("Send every week of the series in calendar order.");
        }

        if (!isSeries && offsetDays % 7 !== 0) {
          throw new Error("Destination weeks must start on the same weekday.");
        }

        // An excluded week is never written, even if it overlaps the source.
        if (!excluded.has(start) && !booked.has(start)) {
          validateWeeklyScheduleCopy({
            sourceWeekStart,
            destinationWeekStart: start,
          });
        }
      }
    } catch (error) {
      return sendValidationError(res, error);
    }

    if (isSeries) {
      const result = await copyScheduleSeries(
        sourceWeekStart,
        destinations,
        excludedWeeks,
        previewBookedWeeks,
      );

      return res.status(201).json(result);
    }

    const mealSlots = await copySelectedWeeks(sourceWeekStart, destinations);
    return res.status(201).json({ mealSlots });
  }),
);

// Copy a source week's meal slots and table assignments to one destination week.
router.post(
  "/capacity/meal-slots/copy-week",
  requireStaff,
  asyncRoute(async (req, res) => {
    let copyRequest;

    try {
      copyRequest = validateWeeklyScheduleCopy(req.body);
    } catch (error) {
      return sendValidationError(res, error);
    }

    const mealSlots = await copyWeeklySchedule(copyRequest);

    return res.status(201).json({
      sourceWeekStart: copyRequest.sourceWeekStart,
      destinationWeekStart: copyRequest.destinationWeekStart,
      mealSlots,
    });
  }),
);

// Return the full configuration to staff, including inactive records.
// [REQUIREMENT] MH-12: An employee can see the booked and remaining capacity of every time slot.
// With ?date=YYYY-MM-DD the response also carries per-slot occupancy for that day.
router.get(
  "/capacity",
  requireStaff,
  asyncRoute(async (req, res) => {
    const { date } = req.query;

    // Callers that omit the date keep the original response.
    if (date !== undefined && !isValidCalendarDate(date)) {
      return sendValidationError(
        res,
        new Error("Choose a valid date in YYYY-MM-DD format."),
      );
    }

    // Request slots, reusable table definitions and occupancy together.
    const [mealSlots, diningTables, occupancy] = await Promise.all([
      getMealSlots(),
      getDiningTables(),
      date === undefined ? undefined : getMealSlotOccupancyByDate(date),
    ]);

    if (occupancy === undefined) {
      return res.json({ mealSlots, diningTables });
    }

    return res.json({ mealSlots, diningTables, occupancy });
  }),
);

// Return the tables assigned to a slot and its configured capacity.
router.get(
  "/capacity/meal-slots/:slotId",
  requireStaff,
  asyncRoute(async (req, res) => {
    // Validate the route parameter before querying the database.
    const slotId = parsePositiveId(req.params.slotId);

    if (!slotId) {
      return res.status(400).json({
        error: {
          code: "INVALID_INPUT",
          message: "Meal slot ID must be a positive integer.",
        },
      });
    }

    const capacity = await getMealSlotCapacity(slotId);

    // Distinguish a missing slot from one with no assigned tables.
    if (!capacity) {
      return res.status(404).json({
        error: {
          code: "NOT_FOUND",
          message: "Meal slot was not found.",
        },
      });
    }

    return res.json({ capacity });
  }),
);

/* UPDATE */

// Allow staff to update a meal slot's date, name, times, and active status.
router.put(
  "/capacity/meal-slots/:slotId",
  requireStaff,
  asyncRoute(async (req, res) => {
    // Reject an invalid slot ID before validating the request body.
    const slotId = parsePositiveId(req.params.slotId);

    if (!slotId) {
      return res.status(400).json({
        error: {
          code: "INVALID_INPUT",
          message: "Meal slot ID must be a positive integer.",
        },
      });
    }

    /** @type {MealSlotInputDTO} */
    let mealSlotData;

    // Validate and normalize the proposed slot configuration.
    try {
      mealSlotData = validateMealSlot(req.body);
    } catch (error) {
      return sendValidationError(res, error);
    }

    // Unlike creation, updates must explicitly specify active status.
    const { isActive } = mealSlotData;

    if (isActive === undefined) {
      return sendValidationError(
        res,
        new Error("Meal slot active status is required for updates."),
      );
    }

    // The DAO checks duplicates, overlaps, and existing booking conflicts.
    const mealSlot = await updateMealSlot(slotId, {
      ...mealSlotData,
      isActive,
    });

    if (!mealSlot) {
      return res.status(404).json({
        error: {
          code: "NOT_FOUND",
          message: "Meal slot was not found.",
        },
      });
    }

    return res.json({ mealSlot });
  }),
);

// Allow staff to update a reusable table's name, seats, and active status.
router.put(
  "/capacity/dining-tables/:tableId",
  requireStaff,
  asyncRoute(async (req, res) => {
    // Validate the table ID before processing the proposed changes.
    const tableId = parsePositiveId(req.params.tableId);

    if (!tableId) {
      return res.status(400).json({
        error: {
          code: "INVALID_INPUT",
          message: "Dining table ID must be a positive integer.",
        },
      });
    }

    /** @type {DiningTableInputDTO} */
    let diningTableData;

    // Validate and normalize the table name, seat count, and active flag.
    try {
      diningTableData = validateDiningTable(req.body);
    } catch (error) {
      return sendValidationError(res, error);
    }

    // Require an explicit active status when replacing table details.
    const { isActive } = diningTableData;

    if (isActive === undefined) {
      return sendValidationError(
        res,
        new Error("Dining table active status is required for updates."),
      );
    }

    // The DAO prevents changes that would invalidate confirmed bookings.
    const diningTable = await updateDiningTable(tableId, {
      ...diningTableData,
      isActive,
    });

    if (!diningTable) {
      return res.status(404).json({
        error: {
          code: "NOT_FOUND",
          message: "Dining table was not found.",
        },
      });
    }

    return res.json({ diningTable });
  }),
);

// Replace the complete set of tables assigned to a meal slot.
router.put(
  "/capacity/meal-slots/:slotId/tables",
  requireStaff,
  asyncRoute(async (req, res) => {
    const slotId = parsePositiveId(req.params.slotId);

    /** @type {UpdateMealSlotCapacityRequestDTO & { slotId: number }} */
    let assignment;

    // Validate the slot ID and requested table IDs before saving.
    try {
      assignment = validateSlotTableAssignment(slotId, req.body?.tableIds);
    } catch (error) {
      return sendValidationError(res, error);
    }

    try {
      // Replace assignments atomically after checking database constraints.
      const capacity = await setMealSlotTables(
        assignment.slotId,
        assignment.tableIds,
      );

      // A valid ID may still refer to a slot that does not exist.
      if (!capacity) {
        return res.status(404).json({
          error: {
            code: "NOT_FOUND",
            message: "Meal slot was not found.",
          },
        });
      }

      // Return the saved table assignments and recalculated capacity.
      return res.json({ capacity });
    } catch (error) {
      // Report unknown table IDs as invalid input rather than a missing slot.
      if (error instanceof DiningTablesNotFoundError) {
        return res.status(400).json({
          error: {
            code: "INVALID_INPUT",
            message: error.message,
            missingTableIds: error.missingTableIds,
          },
        });
      }

      // Forward other failures to the router's error handler.
      throw error;
    }
  }),
);

/* ERROR-HANDLING MIDDLEWARE */

/** @type {import('express').ErrorRequestHandler} */
const handleCapacityError = (error, _req, res, _next) => {
  // Translate known configuration conflicts into HTTP 409 responses.
  if (
    error instanceof DuplicateNameError ||
    error instanceof CapacityConflictError ||
    error instanceof TableSlotConflictError ||
    error instanceof DuplicateMealSlotError ||
    error instanceof MealSlotOverlapError ||
    error instanceof WeeklyScheduleConflictError
  ) {
    return res.status(409).json({
      error: {
        code: error.code,
        message: error.message,
      },
    });
  }

  // Log unexpected failures while returning a generic message to the client.
  console.error("Capacity API error:", error);

  return res.status(500).json({
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message: "An unexpected error occurred.",
    },
  });
};

// Register the error handler after all capacity routes.
router.use(handleCapacityError);

export default router;
