const DAY_MS = 86_400_000;

// Proposed limits for one custom repeat: up to 52 weeks or 12 calendar months
// from the destination start date. Confirm these limits with the backend team.
export const MAX_REPEAT_WEEKS = 52;
export const MAX_REPEAT_MONTHS = 12;

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

/** @param {string} value */
function parseDate(value) {
  return new Date(`${value}T00:00:00Z`);
}

/** @param {string} value */
export function isCalendarDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const date = parseDate(value);
  return (
    Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}

/** @param {string} value @param {number} days */
export function addCalendarDays(value, days) {
  const date = parseDate(value);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** @param {string} value @param {number} months */
export function addCalendarMonths(value, months) {
  const date = parseDate(value);
  const day = date.getUTCDate();

  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + months);

  const monthEnd = new Date(date);
  monthEnd.setUTCMonth(monthEnd.getUTCMonth() + 1, 0);
  date.setUTCDate(Math.min(day, monthEnd.getUTCDate()));

  return date.toISOString().slice(0, 10);
}

/** @param {string} value */
export function startOfWeek(value) {
  const weekday = parseDate(value).getUTCDay();
  return addCalendarDays(value, -((weekday + 6) % 7));
}

/** @param {string} first @param {string} second */
export function weeksOverlap(first, second) {
  return (
    Math.abs(parseDate(first).getTime() - parseDate(second).getTime()) <
    7 * DAY_MS
  );
}

/** @param {string} value */
export function formatScheduleDate(value) {
  return dateFormatter.format(parseDate(value));
}

/** @param {string} start @param {string} end */
export function formatScheduleRange(start, end) {
  return dateFormatter.formatRange(parseDate(start), parseDate(end));
}
