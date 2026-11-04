/**
 * @typedef {import('../models/models.js').MealSlotDTO} MealSlotDTO
 * @typedef {import('../models/models.js').DiningTableDTO} DiningTableDTO
 * @typedef {import('../models/models.js').MealSlotInputDTO} MealSlotInputDTO
 * @typedef {import('../models/models.js').DiningTableInputDTO} DiningTableInputDTO
 * @typedef {import('../models/models.js').MealSlotCapacityDTO} MealSlotCapacityDTO
 */

/**
 * Client-side slot configuration enriched with assigned table IDs.
 *
 * @typedef {MealSlotDTO & {
 *   tableIds: number[]
 * }} ConfiguredMealSlot
 */

/**
 * @typedef {Object} CapacityConfiguration
 * @property {ConfiguredMealSlot[]} mealSlots
 * @property {DiningTableDTO[]} diningTables
 */

const API_URL = (
  import.meta.env.VITE_API_BASE_URL ?? '/api'
).replace(/\/$/, '');

class CapacityApiError extends Error {
  /**
   * @param {string} message
   * @param {number} status
   */
  constructor(message, status) {
    super(message);

    this.name = 'CapacityApiError';
    this.status = status;
  }
}

/**
 * Includes the session cookie in every request.
 *
 * @param {string} path
 * @param {RequestInit} [options]
 * @returns {Promise<any>}
 */
async function request(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
  });

  const data =
    response.status === 204
      ? null
      : await response.json().catch(() => null);

  if (!response.ok) {
    throw new CapacityApiError(
      data?.error?.message ?? 'The capacity request could not be completed.',
      response.status,
    );
  }

  return data;
}

/**
 * Loads slots and tables, then retrieves each slot's assignments.
 *
 * @returns {Promise<CapacityConfiguration>}
 */
async function getConfiguration() {
  /** @type {{ mealSlots: MealSlotDTO[], diningTables: DiningTableDTO[] }} */
  const { mealSlots, diningTables } = await request('/capacity');

  const mealSlotsWithTables = await Promise.all(
    mealSlots.map(async (mealSlot) => {
      /** @type {{ capacity: MealSlotCapacityDTO }} */
      const { capacity } = await request(
        `/capacity/meal-slots/${mealSlot.id}`,
      );

      return {
        ...mealSlot,
        tableIds: capacity.tables.map((table) => table.id),
      };
    }),
  );

  return {
    mealSlots: mealSlotsWithTables,
    diningTables,
  };
}

/**
 * @param {MealSlotInputDTO} mealSlot
 * @returns {Promise<MealSlotDTO>}
 */
async function createMealSlot(mealSlot) {
  /** @type {{ mealSlot: MealSlotDTO }} */
  const data = await request('/capacity/meal-slots', {
    method: 'POST',
    body: JSON.stringify(mealSlot),
  });

  return data.mealSlot;
}

/**
 * @param {number} slotId
 * @param {MealSlotInputDTO & { isActive: boolean }} mealSlot
 * @returns {Promise<MealSlotDTO>}
 */
async function updateMealSlot(slotId, mealSlot) {
  /** @type {{ mealSlot: MealSlotDTO }} */
  const data = await request(`/capacity/meal-slots/${slotId}`, {
    method: 'PUT',
    body: JSON.stringify(mealSlot),
  });

  return data.mealSlot;
}

/**
 * @param {DiningTableInputDTO} diningTable
 * @returns {Promise<DiningTableDTO>}
 */
async function createDiningTable(diningTable) {
  /** @type {{ diningTable: DiningTableDTO }} */
  const data = await request('/capacity/dining-tables', {
    method: 'POST',
    body: JSON.stringify(diningTable),
  });

  return data.diningTable;
}

/**
 * @param {number} tableId
 * @param {DiningTableInputDTO & { isActive: boolean }} diningTable
 * @returns {Promise<DiningTableDTO>}
 */
async function updateDiningTable(tableId, diningTable) {
  /** @type {{ diningTable: DiningTableDTO }} */
  const data = await request(`/capacity/dining-tables/${tableId}`, {
    method: 'PUT',
    body: JSON.stringify(diningTable),
  });

  return data.diningTable;
}

/**
 * Replaces all table assignments for the slot.
 *
 * @param {number} slotId
 * @param {number[]} tableIds
 * @returns {Promise<MealSlotCapacityDTO>}
 */
async function saveMealSlotTables(slotId, tableIds) {
  const data = await request(
    `/capacity/meal-slots/${slotId}/tables`,
    {
      method: 'PUT',
      body: JSON.stringify({ tableIds }),
    },
  );

  return data.capacity;
}

const CapacityAPI = {
  getConfiguration,
  createMealSlot,
  updateMealSlot,
  createDiningTable,
  updateDiningTable,
  saveMealSlotTables,
};

export { CapacityApiError };
export default CapacityAPI;