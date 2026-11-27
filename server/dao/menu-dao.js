import { withTransaction } from "../db.js";

/**
 * API data types used to store the menu of each meal slot.
 *
 * @typedef {import('../models/models.js').MealSlotMenuDTO} MealSlotMenuDTO
 * @typedef {import('../models/models.js').PreviousMealSlotMenuDTO} PreviousMealSlotMenuDTO
 *
 * @typedef {import('../db.js').TransactionQueries} TransactionQueries
 */

/* ERRORS */

/**
 * Reports a meal slot that does not exist.
 * Lets the API tell a missing slot apart from a slot without a menu.
 */
export class MealSlotNotFoundError extends Error {
  /**
   * @param {number} slotId
   */
  constructor(slotId) {
    super("The meal slot was not found.");

    this.name = "MealSlotNotFoundError";
    this.code = "MEAL_SLOT_NOT_FOUND";
    this.slotId = slotId;
  }
}

/* HELPERS */

/**
 * Rejects a slot ID that does not exist.
 * Runs inside the caller's transaction.
 *
 * @param {TransactionQueries['getAsync']} getAsync
 * @param {number} slotId
 * @returns {Promise<{ slotDate: string, startTime: string }>}
 * @throws {MealSlotNotFoundError} If the slot does not exist.
 */
async function readExistingSlot(getAsync, slotId) {
  /** @type {{ slotDate: string, startTime: string } | undefined} */
  const slot = await getAsync(
    `SELECT slot_date AS slotDate, start_time AS startTime
     FROM meal_slots
     WHERE id = ?`,
    [slotId],
  );

  if (!slot) {
    throw new MealSlotNotFoundError(slotId);
  }

  return slot;
}

/**
 * Reads a slot's menu using an already open transaction.
 * Returns null when the slot has no menu.
 *
 * @param {TransactionQueries['getAsync']} getAsync
 * @param {number} slotId
 * @returns {Promise<MealSlotMenuDTO | null>}
 */
async function readMealSlotMenu(getAsync, slotId) {
  /** @type {MealSlotMenuDTO | undefined} */
  const menu = await getAsync(
    `SELECT
       id,
       slot_id AS slotId,
       content,
       updated_at AS updatedAt
     FROM meal_slot_menus
     WHERE slot_id = ?`,
    [slotId],
  );

  return menu ?? null;
}

/* READ */

/**
 * Returns the menu saved for a meal slot, or null if the slot has no menu.
 *
 * @param {number} slotId
 * @returns {Promise<MealSlotMenuDTO | null>}
 * @throws {MealSlotNotFoundError} If the slot does not exist.
 */
export async function getMealSlotMenu(slotId) {
  return withTransaction(async ({ getAsync }) => {
    await readExistingSlot(getAsync, slotId);

    return readMealSlotMenu(getAsync, slotId);
  });
}

/**
 * Returns the menus of slots that start before the given slot,
 * most recent first. Same-day slots count when they start earlier.
 * Slot ID breaks ties, so slots sharing a date and start time
 * are always returned in the same order. Blank menus are skipped
 * because they have nothing to reuse.
 *
 * @param {number} slotId
 * @returns {Promise<PreviousMealSlotMenuDTO[]>}
 * @throws {MealSlotNotFoundError} If the slot does not exist.
 */
export async function getPreviousMealSlotMenus(slotId) {
  return withTransaction(async ({ getAsync, allAsync }) => {
    const slot = await readExistingSlot(getAsync, slotId);

    // [REQUIREMENT] MH-10: Employees can reuse (and change) previous menus.
    // HH:mm times compare correctly as text.
    /** @type {PreviousMealSlotMenuDTO[]} */
    const menus = await allAsync(
      `SELECT
         m.id,
         m.slot_id AS slotId,
         m.content,
         m.updated_at AS updatedAt,
         s.name AS slotName,
         s.slot_date AS slotDate,
         s.start_time AS startTime,
         s.end_time AS endTime
       FROM meal_slot_menus AS m
       JOIN meal_slots AS s ON s.id = m.slot_id
       WHERE (
           s.slot_date < ?
           OR (s.slot_date = ? AND s.start_time < ?)
         )
         AND trim(m.content, char(32, 9, 10, 13)) <> ''
       ORDER BY s.slot_date DESC, s.start_time DESC, s.id DESC`,
      [slot.slotDate, slot.slotDate, slot.startTime],
    );

    return menus;
  });
}

/* CREATE / UPDATE */

/**
 * Creates or replaces the menu of a meal slot and returns the saved menu.
 * Updating keeps the menu's ID. Other slots' menus are unchanged.
 *
 * @param {number} slotId
 * @param {string} content
 * @returns {Promise<MealSlotMenuDTO>}
 * @throws {MealSlotNotFoundError} If the slot does not exist.
 */
export async function saveMealSlotMenu(slotId, content) {
  return withTransaction(async ({ runAsync, getAsync }) => {
    await readExistingSlot(getAsync, slotId);

    // [REQUIREMENT] MH-10: Modifying a menu affects only the menu of that specific slot.
    // Reused text is stored as a separate copy, so the source menu stays intact.
    await runAsync(
      `INSERT INTO meal_slot_menus (slot_id, content)
       VALUES (?, ?)
       ON CONFLICT (slot_id) DO UPDATE SET
         content = excluded.content,
         updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`,
      [slotId, content],
    );

    // The row was written above, so it is always found.
    return /** @type {MealSlotMenuDTO} */ (
      await readMealSlotMenu(getAsync, slotId)
    );
  });
}
