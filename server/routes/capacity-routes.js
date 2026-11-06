import express from 'express';

import {
  createDiningTable,
  createMealSlot,
  DiningTablesNotFoundError,
  DuplicateNameError,
  getDiningTables,
  getMealSlotCapacity,
  getMealSlots,
  setMealSlotTables,
  updateDiningTable,
  updateMealSlot,
  CapacityConflictError,
  TableSlotConflictError,
  DuplicateMealSlotError,
} from '../dao/capacity-dao.js';
import { requireStaff } from '../middleware/require-role.js';
import {
  validateDiningTable,
  validateMealSlot,
  validateSlotTableAssignment,
} from '../services/capacity-validation.js';
import { getBookingDeadline } from '../services/booking-time.js';

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
      code: 'INVALID_INPUT',
      message:
        error instanceof Error ? error.message : 'Invalid input.',
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
  if (typeof value !== 'string') {
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
  '/capacity/meal-slots',
  requireStaff,
  asyncRoute(async (req, res) => {
    /** @type {MealSlotInputDTO} */
    let mealSlotData;

    // Validate and normalize input before calling the DAO.
    try {
      mealSlotData = validateMealSlot(req.body);
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
  '/capacity/dining-tables',
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
  '/meal-slots',
  asyncRoute(async (_req, res) => {
    const mealSlots = await getMealSlots();

    // Exclude inactive slots and expose deadlines as ISO timestamps.
    return res.json({
      mealSlots: mealSlots
        .filter((mealSlot) => mealSlot.isActive)
        .map((mealSlot) => ({
          ...mealSlot,
          bookingClosesAt: new Date(
            getBookingDeadline(
              mealSlot.slotDate,
              mealSlot.startTime,
            )
          ).toISOString(),
        })),
    });
  }),
);

// Return the full configuration to staff, including inactive records.
router.get(
  '/capacity',
  requireStaff,
  asyncRoute(async (_req, res) => {
    // Request slots and reusable table definitions together.
    const [mealSlots, diningTables] = await Promise.all([
      getMealSlots(),
      getDiningTables(),
    ]);

    return res.json({
      mealSlots,
      diningTables,
    });
  }),
);

// Return the tables assigned to a slot and its configured capacity.
router.get(
  '/capacity/meal-slots/:slotId',
  requireStaff,
  asyncRoute(async (req, res) => {
    // Validate the route parameter before querying the database.
    const slotId = parsePositiveId(req.params.slotId);

    if (!slotId) {
      return res.status(400).json({
        error: {
          code: 'INVALID_INPUT',
          message: 'Meal slot ID must be a positive integer.',
        },
      });
    }

    const capacity = await getMealSlotCapacity(slotId);

    // Distinguish a missing slot from one with no assigned tables.
    if (!capacity) {
      return res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Meal slot was not found.',
        },
      });
    }

    return res.json({ capacity });
  }),
);

/* UPDATE */

// Allow staff to update a meal slot's date, name, times, and active status.
router.put(
  '/capacity/meal-slots/:slotId',
  requireStaff,
  asyncRoute(async (req, res) => {
    // Reject an invalid slot ID before validating the request body.
    const slotId = parsePositiveId(req.params.slotId);

    if (!slotId) {
      return res.status(400).json({
        error: {
          code: 'INVALID_INPUT',
          message: 'Meal slot ID must be a positive integer.',
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
        new Error('Meal slot active status is required for updates.'),
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
          code: 'NOT_FOUND',
          message: 'Meal slot was not found.',
        },
      });
    }

    return res.json({ mealSlot });
  }),
);

// Allow staff to update a reusable table's name, seats, and active status.
router.put(
  '/capacity/dining-tables/:tableId',
  requireStaff,
  asyncRoute(async (req, res) => {
    // Validate the table ID before processing the proposed changes.
    const tableId = parsePositiveId(req.params.tableId);

    if (!tableId) {
      return res.status(400).json({
        error: {
          code: 'INVALID_INPUT',
          message: 'Dining table ID must be a positive integer.',
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
        new Error('Dining table active status is required for updates.'),
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
          code: 'NOT_FOUND',
          message: 'Dining table was not found.',
        },
      });
    }

    return res.json({ diningTable });
  }),
);

// Replace the complete set of tables assigned to a meal slot.
router.put(
  '/capacity/meal-slots/:slotId/tables',
  requireStaff,
  asyncRoute(async (req, res) => {
    const slotId = parsePositiveId(req.params.slotId);

    /** @type {UpdateMealSlotCapacityRequestDTO & { slotId: number }} */
    let assignment;

    // Validate the slot ID and requested table IDs before saving.
    try {
      assignment = validateSlotTableAssignment(
        slotId,
        req.body?.tableIds,
      );
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
            code: 'NOT_FOUND',
            message: 'Meal slot was not found.',
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
            code: 'INVALID_INPUT',
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
    error instanceof DuplicateMealSlotError
  ) {
    return res.status(409).json({
      error: {
        code: error.code,
        message: error.message,
      },
    });
  }

  // Log unexpected failures while returning a generic message to the client.
  console.error('Capacity API error:', error);

  return res.status(500).json({
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred.',
    },
  });
};

// Register the error handler after all capacity routes.
router.use(handleCapacityError);

export default router;