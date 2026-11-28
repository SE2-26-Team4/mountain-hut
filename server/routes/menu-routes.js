import express from "express";

import { MealSlotNotFoundError } from "../dao/menu-dao.js";
import { requireStaff } from "../middleware/require-role.js";
import {
  MenuServiceError,
  saveMenuForSlot,
} from "../services/menu-service.js";

/**
 * Data types used by the menu endpoints.
 *
 * @typedef {import('../models/models.js').SaveMealSlotMenuRequestDTO} SaveMealSlotMenuRequestDTO
 */

// Group menu endpoints and their error handler in a dedicated router.
const router = express.Router();

/* HELPERS */

/**
 * Converts a route parameter made only of digits to a number.
 * Anything else becomes NaN, which the menu service rejects as an ID.
 *
 * @param {unknown} value
 * @returns {number}
 */
function toSlotId(value) {
  const text = String(value);

  return /^\d+$/.test(text) ? Number(text) : Number.NaN;
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
    /** @type {Partial<SaveMealSlotMenuRequestDTO> | undefined} */
    const body = req.body;

    // The service validates the slot ID and menu text before saving.
    // TODO(MH-10): no task enforces that a menu changes only before its slot;
    // neither this route nor the menu service checks the slot's start time.
    const menu = await saveMenuForSlot(
      toSlotId(req.params.slotId),
      body?.content,
    );

    return res.json({ menu });
  }),
);

/* ERROR-HANDLING MIDDLEWARE */

/** @type {import('express').ErrorRequestHandler} */
const handleMenuError = (error, _req, res, _next) => {
  // Report invalid slot IDs and menu text with the service's code.
  if (error instanceof MenuServiceError) {
    return res.status(400).json({
      error: {
        code: error.code,
        message: error.message,
      },
    });
  }

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
