import { isValidCalendarDate } from './date-validation.js';

/**
 * Data types returned after validating capacity configuration input.
 *
 * @typedef {import('../models/models.js').MealSlotInputDTO} MealSlotInputDTO
 * @typedef {import('../models/models.js').DiningTableInputDTO} DiningTableInputDTO
 * @typedef {import('../models/models.js').UpdateMealSlotCapacityRequestDTO} UpdateMealSlotCapacityRequestDTO
 */

/**
 * Checks whether a value represents a valid time in HH:mm format.
 *
 * @param {unknown} value
 * @returns {value is string}
 */
function isValidTime(value) {
  // Require two digits for both hours and minutes.
  if (
    typeof value !== 'string' ||
    !/^\d{2}:\d{2}$/.test(value)
  ) {
    return false;
  }

  // Ensure the parsed values fall within a 24-hour clock.
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
 * Checks whether a value is a positive integer without converting its type.
 *
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
 * Requires a non-null object and rejects arrays.
 *
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
 * Allows an omitted active status, but requires a boolean when provided.
 *
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
  // Verify the input structure before accessing its fields.
  requireObject(input, 'Meal slot');

  // Normalize the name and extract the remaining configuration fields.
  const name = typeof input.name === 'string' ? input.name.trim() : '';
  const { slotDate, startTime, endTime, isActive } = input;

  // Require an existing calendar date in the expected format.
  if (!isValidCalendarDate(slotDate)) {
    throw new Error(
      'A valid meal slot date in YYYY-MM-DD format is required.'
    );
  }

  // Reject missing names and names containing only whitespace.
  if (!name) {
    throw new Error('Meal slot name is required.');
  }

  // Validate both times before comparing their numeric values.
  if (!isValidTime(startTime) || !isValidTime(endTime)) {
    throw new Error('Meal slot times must use the HH:mm format.');
  }

  // Require a positive duration within the same calendar day.
  if (toMinutes(startTime) >= toMinutes(endTime)) {
    throw new Error(
      'Meal slot end time must be later than its start time.'
    );
  }

  // Check active status without requiring it for creation.
  validateIsActive(isActive, 'Meal slot');

  // Return only supported fields, preserving omission of active status.
  return {
    slotDate,
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
  // Verify the input structure before reading table details.
  requireObject(input, 'Dining table');

  // Normalize the table name without converting the seat count.
  const name = typeof input.name === 'string' ? input.name.trim() : '';
  const { seatCount, isActive } = input;

  // Require a nonempty table name.
  if (!name) {
    throw new Error('Dining table name is required.');
  }

  // Reject zero, negative, fractional, and nonnumeric seat counts.
  if (!isPositiveInteger(seatCount)) {
    throw new Error(
      'Dining table seat count must be a positive integer.'
    );
  }

  // Check active status when supplied.
  validateIsActive(isActive, 'Dining table');

  // Return normalized table details and the optional active flag.
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
  // Require a positive integer slot ID.
  if (!isPositiveInteger(slotId)) {
    throw new Error('Meal slot ID must be a positive integer.');
  }

  // Require a list of table IDs; an empty array remains valid.
  if (!Array.isArray(tableIds)) {
    throw new TypeError(
      'Dining table IDs must be provided as an array.'
    );
  }

  // Validate every table ID without coercing strings or booleans.
  if (!tableIds.every(isPositiveInteger)) {
    throw new Error('Dining table IDs must be positive integers.');
  }

  // Reject repeated table IDs instead of silently removing duplicates.
  if (new Set(tableIds).size !== tableIds.length) {
    throw new Error('Dining table IDs must not contain duplicates.');
  }

  // Return the validated assignment for database existence and conflict checks.
  return { slotId, tableIds };
}