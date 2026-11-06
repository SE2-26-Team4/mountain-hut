/**
 * Checks both the format and existence of a calendar date.
 *
 * @param {unknown} value
 * @returns {value is string}
 */
export function isValidCalendarDate(value) {
  // Require a string in YYYY-MM-DD format.
  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value)
  ) {
    return false;
  }

  // Extract the numeric year, month, and day.
  const [year, month, day] = value.split('-').map(Number);

  // Exclude year zero.
  if (year < 1) return false;

  // Build the date in UTC, preserving years below 100.
  const date = new Date(0);
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCFullYear(year, month - 1, day);

  // Reject invalid dates that JavaScript would normalize to another date.
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}