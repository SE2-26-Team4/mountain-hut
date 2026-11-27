/**
 * @typedef {import('../models/models.js').MealSlotMenuDTO} MealSlotMenuDTO
 * @typedef {import('../models/models.js').SaveMealSlotMenuRequestDTO} SaveMealSlotMenuRequestDTO
 */

const API_URL = (import.meta.env.VITE_API_BASE_URL ?? "/api").replace(
  /\/$/,
  "",
);

class MenuApiError extends Error {
  /**
   * @param {string} message
   * @param {number} status
   * @param {string} [code]
   */
  constructor(message, status, code) {
    super(message);

    this.name = "MenuApiError";
    this.status = status;
    this.code = code;
  }
}

/**
 * Includes the session cookie and reports unsuccessful HTTP responses.
 *
 * @param {string} path
 * @param {RequestInit} [options]
 * @returns {Promise<any>}
 */
async function request(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });

  const data =
    response.status === 204 ? null : await response.json().catch(() => null);

  if (!response.ok) {
    throw new MenuApiError(
      data?.error?.message ?? "The menu request could not be completed.",
      response.status,
      data?.error?.code,
    );
  }

  return data;
}

/**
 * Creates or replaces the menu of a meal slot. Staff only.
 * Rejects with a MenuApiError carrying the server's status and error code,
 * for example 404 for a missing slot.
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
