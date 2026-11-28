import { ApiError, createRequest } from "./api-request.js";

/**
 * @typedef {import('../models/models.js').MealSlotMenuDTO} MealSlotMenuDTO
 * @typedef {import('../models/models.js').SaveMealSlotMenuRequestDTO} SaveMealSlotMenuRequestDTO
 */

class MenuApiError extends ApiError {
  name = "MenuApiError";
}

const request = createRequest(
  MenuApiError,
  "The menu request could not be completed.",
);

/**
 * Creates or replaces the menu of a meal slot. Staff only.
 * Rejects with a MenuApiError carrying the server's status and error code:
 * 400 (INVALID_MENU) for blank text or an invalid slot ID,
 * 404 (MEAL_SLOT_NOT_FOUND) for a missing slot.
 *
 * @param {number} slotId
 * @param {string} content
 * @returns {Promise<MealSlotMenuDTO>}
 */
async function saveMealSlotMenu(slotId, content) {
  /** @type {SaveMealSlotMenuRequestDTO} */
  const payload = { content };

  /** @type {{ menu: MealSlotMenuDTO }} */
  const data = await request(`/capacity/meal-slots/${slotId}/menu`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });

  return data.menu;
}

const MenuAPI = {
  saveMealSlotMenu,
};

export { MenuApiError };
export default MenuAPI;
