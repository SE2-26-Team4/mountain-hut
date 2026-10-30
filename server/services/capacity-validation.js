/**
 * Validation service for capacity management (meal slots and dining tables).
 */

/**
 * Validates a meal slot object.
 * @param {Object} slot
 * @returns {Object} { isValid: boolean, errors: string[] }
 */
export function validateMealSlot(slot) {
  const errors = [];

  if (!slot) {
    return { isValid: false, errors: ['Meal slot object is required.'] };
  }

  if (slot.id !== undefined && (typeof slot.id !== 'number' || slot.id <= 0)) {
    errors.push('Meal slot ID must be a positive number.');
  }

  if (!slot.mealType || typeof slot.mealType !== 'string' || slot.mealType.trim() === '') {
    errors.push('Meal slot name/type is required and must be a non-empty string.');
  }

  if (!slot.date || typeof slot.date !== 'string' || isNaN(Date.parse(slot.date))) {
    errors.push('Meal slot date/time must be a valid date string.');
  }



  if (slot.maxCapacity === undefined || typeof slot.maxCapacity !== 'number' || slot.maxCapacity <= 0) {
    errors.push('Max capacity must be a positive number.');
  }


  if (slot.active !== undefined && slot.active !== 0 && slot.active !== 1 && typeof slot.active !== 'boolean') {
    errors.push('Active status must be a boolean or 0/1.');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Validates a dining table object.
 * @param {Object} table
 * @returns {Object} { isValid: boolean, errors: string[] }
 */
export function validateDiningTable(table) {
  const errors = [];

  if (!table) {
    return { isValid: false, errors: ['Dining table object is required.'] };
  }

  if (table.id !== undefined && (typeof table.id !== 'number' || table.id <= 0)) {
    errors.push('Table ID must be a positive number.');
  }

  if (table.tableNumber === undefined || (typeof table.tableNumber !== 'number' && typeof table.tableNumber !== 'string')) {
    errors.push('Dining table number or name is required.');
  }



  if (table.seatCount === undefined || typeof table.seatCount !== 'number' || table.seatCount <= 0) {
    errors.push('Seat count must be a positive integer greater than zero.');
  }




  if (table.active !== undefined && table.active !== 0 && table.active !== 1 && typeof table.active !== 'boolean') {
    errors.push('Active status must be a boolean or 0/1.');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}