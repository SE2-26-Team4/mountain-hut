import {
  getMealSlotMenu,
  getPreviousMealSlotMenus,
  saveMealSlotMenu,
} from "../dao/menu-dao.js";

export class MenuServiceError extends Error {
  /**
   * @param {string} code
   * @param {string} message
   */
  constructor(code, message) {
    super(message);
    this.name = "MenuServiceError";
    this.code = code;
  }
}

/**
 * @param {unknown} value
 * @param {string} label
 * @returns {asserts value is number}
 */
function validateSlotId(value, label) {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0) {
    throw new MenuServiceError(
      "INVALID_MENU",
      `${label} slot ID must be a positive safe integer.`,
    );
  }
}

/**
 * Returns previous menu text for editing without saving it to the target slot.
 * The source must have a reusable menu and start before the target.
 *
 * @param {unknown} sourceSlotId
 * @param {unknown} targetSlotId
 * @returns {Promise<string>}
 * @throws {import('../dao/menu-dao.js').MealSlotNotFoundError}
 * @throws {MenuServiceError}
 */
export async function getMenuReuseDraft(sourceSlotId, targetSlotId) {
  validateSlotId(sourceSlotId, "Source");
  validateSlotId(targetSlotId, "Target");

  // Check source existence separately: an existing slot may have no menu.
  await getMealSlotMenu(sourceSlotId);
  const previousMenus = await getPreviousMealSlotMenus(targetSlotId);
  const sourceMenu = previousMenus.find((menu) => menu.slotId === sourceSlotId);

  if (!sourceMenu || !sourceMenu.content.trim()) {
    throw new MenuServiceError(
      "MENU_NOT_REUSABLE",
      "The source slot must have a nonempty menu and start before the target slot.",
    );
  }

  return sourceMenu.content;
}

/**
 * Saves final menu text for the target slot, preserving its formatting.
 *
 * @param {unknown} targetSlotId
 * @param {unknown} content
 * @returns {Promise<import('../models/models.js').MealSlotMenuDTO>}
 * @throws {import('../dao/menu-dao.js').MealSlotNotFoundError}
 * @throws {MenuServiceError}
 */
export async function saveMenuForSlot(targetSlotId, content) {
  validateSlotId(targetSlotId, "Target");

  if (typeof content !== "string" || content.trim().length === 0) {
    throw new MenuServiceError("INVALID_MENU", "Menu text must not be empty.");
  }

  return saveMealSlotMenu(targetSlotId, content);
}
