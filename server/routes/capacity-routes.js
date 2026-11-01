import express from 'express';

import {
  createDiningTable,
  createMealSlot,
  DiningTablesNotFoundError,
  getDiningTables,
  getMealSlotCapacity,
  getMealSlots,
  setMealSlotTables,
  updateDiningTable,
  updateMealSlot,
} from '../dao/capacity-dao.js';
import { requireStaff } from '../middleware/require-role.js';
import {
  validateDiningTable,
  validateMealSlot,
  validateSlotTableAssignment,
} from '../services/capacity-validation.js';

/**
 * @typedef {import('../models/models.js').MealSlotInputDTO} MealSlotInputDTO
 * @typedef {import('../models/models.js').DiningTableInputDTO} DiningTableInputDTO
 * @typedef {import('../models/models.js').UpdateMealSlotCapacityRequestDTO} UpdateMealSlotCapacityRequestDTO
 */

const router = express.Router();

/* HELPERS */

/**
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

/* READ */

// Public listing excludes inactive meal slots.
router.get(
  '/meal-slots',
  asyncRoute(async (_req, res) => {
    const mealSlots = await getMealSlots();

    return res.json({
      mealSlots: mealSlots.filter((mealSlot) => mealSlot.isActive),
    });
  }),
);

// Staff configuration includes inactive meal slots and tables.
router.get(
  '/capacity',
  requireStaff,
  asyncRoute(async (_req, res) => {
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

router.get(
  '/capacity/meal-slots/:slotId',
  requireStaff,
  asyncRoute(async (req, res) => {
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


/* CREATE */

router.post(
  '/capacity/meal-slots',
  requireStaff,
  asyncRoute(async (req, res) => {
    /** @type {MealSlotInputDTO} */
    let mealSlotData;

    try {
      mealSlotData = validateMealSlot(req.body);
    } catch (error) {
      return sendValidationError(res, error);
    }

    const mealSlot = await createMealSlot(mealSlotData);

    return res.status(201).json({ mealSlot });
  }),
);

router.post(
  '/capacity/dining-tables',
  requireStaff,
  asyncRoute(async (req, res) => {
    /** @type {DiningTableInputDTO} */
    let diningTableData;

    try {
      diningTableData = validateDiningTable(req.body);
    } catch (error) {
      return sendValidationError(res, error);
    }

    const diningTable = await createDiningTable(diningTableData);

    return res.status(201).json({ diningTable });
  }),
);

/* UPDATE */

router.put(
  '/capacity/meal-slots/:slotId',
  requireStaff,
  asyncRoute(async (req, res) => {
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

    try {
      mealSlotData = validateMealSlot(req.body);
    } catch (error) {
      return sendValidationError(res, error);
    }

    const { isActive } = mealSlotData;

    if (isActive === undefined) {
      return sendValidationError(
        res,
        new Error('Meal slot active status is required for updates.'),
      );
    }

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

router.put(
  '/capacity/dining-tables/:tableId',
  requireStaff,
  asyncRoute(async (req, res) => {
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

    try {
      diningTableData = validateDiningTable(req.body);
    } catch (error) {
      return sendValidationError(res, error);
    }

    const { isActive } = diningTableData;

    if (isActive === undefined) {
      return sendValidationError(
        res,
        new Error('Dining table active status is required for updates.'),
      );
    }

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

router.put(
  '/capacity/meal-slots/:slotId/tables',
  requireStaff,
  asyncRoute(async (req, res) => {
    const slotId = parsePositiveId(req.params.slotId);

    /** @type {UpdateMealSlotCapacityRequestDTO & { slotId: number }} */
    let assignment;

    try {
      assignment = validateSlotTableAssignment(
        slotId,
        req.body?.tableIds,
      );
    } catch (error) {
      return sendValidationError(res, error);
    }

    try {
      const capacity = await setMealSlotTables(
        assignment.slotId,
        assignment.tableIds,
      );

      if (!capacity) {
        return res.status(404).json({
          error: {
            code: 'NOT_FOUND',
            message: 'Meal slot was not found.',
          },
        });
      }

      return res.json({ capacity });
    } catch (error) {
      // The slot exists, so unknown tables are invalid input rather than 404.
      if (error instanceof DiningTablesNotFoundError) {
        return res.status(400).json({
          error: {
            code: 'INVALID_INPUT',
            message: error.message,
            missingTableIds: error.missingTableIds,
          },
        });
      }

      throw error;
    }
  }),
);

/* ERROR-HANDLING MIDDLEWARE */

/** @type {import('express').ErrorRequestHandler} */
const handleCapacityError = (error, _req, res, _next) => {
  console.error('Capacity API error:', error);

  return res.status(500).json({
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred.',
    },
  });
};

router.use(handleCapacityError);

export default router;