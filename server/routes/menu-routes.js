import express from "express";

import { MealSlotNotFoundError, saveMealSlotMenu } from "../dao/menu-dao.js";
import { requireStaff } from "../middleware/require-role.js";

/**
 * Data types used by the menu endpoints.
 *
 * @typedef {import('../models/models.js').SaveMealSlotMenuRequestDTO} SaveMealSlotMenuRequestDTO
 */

// Group menu endpoints and their error handler in a dedicated router.
const router = express.Router();

/* HELPERS */

/**
 * Converts a route parameter to a positive integer.
 * Returns null when the value cannot be accepted as an ID.
 *
 * @param {unknown} value
 * @returns {number | null}
 */
function parsePositiveId(value) {
  const text = String(value);

  return /^[1-9]\d*$/.test(text) ? Number(text) : null;
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

/* UPDATE */

// [REQUIREMENT] MH-10: Employees specify the menu of a defined slot.
// Creates the slot's menu or replaces it; only staff can do either.
router.put(
  "/capacity/meal-slots/:slotId/menu",
  requireStaff,
  asyncRoute(async (req, res) => {
    const slotId = parsePositiveId(req.params.slotId);

    if (!slotId) {
      return res.status(400).json({
        error: {
          code: "INVALID_INPUT",
          message: "Meal slot ID must be a positive integer.",
        },
      });
    }

    /** @type {Partial<SaveMealSlotMenuRequestDTO> | undefined} */
    const body = req.body;

    // TODO(menu-service): replace this direct DAO call with the save function
    // of server/services/menu-service.js ("Backend Menu Validation and Reuse").
    // The service validates the menu text and blocks slots that have started
    // (MH-10: a menu can be modified only before its slot).
    const menu = await saveMealSlotMenu(
      slotId,
      /** @type {string} */ (body?.content),
    );

    return res.json({ menu });
  }),
);

/* ERROR-HANDLING MIDDLEWARE */

/** @type {import('express').ErrorRequestHandler} */
const handleMenuError = (error, _req, res, _next) => {
  // TODO(menu-service): answer the service's validation errors with 400
  // and its locked-slot error with 409, using the error's code and message.

  // Distinguish a missing slot from a slot without a menu.
  if (error instanceof MealSlotNotFoundError) {
    return res.status(404).json({
      error: {
        code: error.code,
        message: error.message,
      },
    });
  }

  // Log unexpected failures while returning a generic message to the client.
  console.error("Menu API error:", error);

  return res.status(500).json({
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message: "An unexpected error occurred.",
    },
  });
};

// Register the error handler after all menu routes.
router.use(handleMenuError);

export default router;
