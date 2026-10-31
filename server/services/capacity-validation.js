/**
 * @typedef {import('../models/models.js').MealSlotInputDTO} MealSlotInputDTO
 * @typedef {import('../models/models.js').DiningTableInputDTO} DiningTableInputDTO
 * @typedef {import('../models/models.js').UpdateMealSlotCapacityRequestDTO} UpdateMealSlotCapacityRequestDTO
 */

/**
 * @param {unknown} value
 * @returns {value is string}
 */
function isValidTime(value) {
  if (
    typeof value !== 'string' ||
    !/^\d{2}:\d{2}$/.test(value)
  ) {
    return false;
  }

  const [hours, minutes] = value.split(':').map(Number);

  return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59;
}

/**
 * Converts an already validated HH:mm time to minutes since midnight.
 *
 * @param {string} value
 * @returns {number}
 */
function toMinutes(value) {
  const [hours, minutes] = value.split(':').map(Number);

  return hours * 60 + minutes;
}

/**
 * @param {unknown} value
 * @returns {value is number}
 */
function isPositiveInteger(value) {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value > 0
  );
}

/**
 * @param {unknown} value
 * @param {string} label
 * @returns {asserts value is Record<string, unknown>}
 */
function requireObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${label} data must be an object.`);
  }
}

/**
 * @param {unknown} isActive
 * @param {string} label
 * @returns {asserts isActive is boolean | undefined}
 */
function validateIsActive(isActive, label) {
  if (isActive !== undefined && typeof isActive !== 'boolean') {
    throw new TypeError(`${label} active status must be a boolean.`);
  }
}

/**
 * Validates and trims meal-slot input.
 * Active status may be omitted; update routes must require it separately.
 *
 * @param {unknown} input
 * @returns {MealSlotInputDTO}
 * @throws {Error} If the input is invalid.
 */
export function validateMealSlot(input) {
  requireObject(input, 'Meal slot');

  const name = typeof input.name === 'string' ? input.name.trim() : '';
  const { startTime, endTime, isActive } = input;

  if (!name) {
    throw new Error('Meal slot name is required.');
  }

  if (!isValidTime(startTime) || !isValidTime(endTime)) {
    throw new Error('Meal slot times must use the HH:mm format.');
  }

  if (toMinutes(startTime) >= toMinutes(endTime)) {
    throw new Error('Meal slot end time must be later than its start time.');
  }

  validateIsActive(isActive, 'Meal slot');

  return {
    name,
    startTime,
    endTime,
    ...(isActive === undefined ? {} : { isActive }),
  };
}

/**
 * Validates and trims dining-table input.
 * Active status may be omitted; update routes must require it separately.
 *
 * @param {unknown} input
 * @returns {DiningTableInputDTO}
 * @throws {Error} If the input is invalid.
 */
export function validateDiningTable(input) {
  requireObject(input, 'Dining table');

  const name = typeof input.name === 'string' ? input.name.trim() : '';
  const { seatCount, isActive } = input;

  if (!name) {
    throw new Error('Dining table name is required.');
  }

  if (!isPositiveInteger(seatCount)) {
    throw new Error('Dining table seat count must be a positive integer.');
  }

  validateIsActive(isActive, 'Dining table');

  return {
    name,
    seatCount,
    ...(isActive === undefined ? {} : { isActive }),
  };
}

/**
 * Validates assignment IDs without checking their existence in the database.
 * An empty table list is allowed to clear assignments.
 *
 * @param {unknown} slotId
 * @param {unknown} tableIds
 * @returns {UpdateMealSlotCapacityRequestDTO & { slotId: number }}
 * @throws {Error} If an ID is invalid or duplicated.
 * @throws {TypeError} If tableIds is not an array.
 */
export function validateSlotTableAssignment(slotId, tableIds) {
  if (!isPositiveInteger(slotId)) {
    throw new Error('Meal slot ID must be a positive integer.');
  }

  if (!Array.isArray(tableIds)) {
    throw new TypeError('Dining table IDs must be provided as an array.');
  }

  if (!tableIds.every(isPositiveInteger)) {
    throw new Error('Dining table IDs must be positive integers.');
  }

  if (new Set(tableIds).size !== tableIds.length) {
    throw new Error('Dining table IDs must not contain duplicates.');
  }

  return { slotId, tableIds };
}