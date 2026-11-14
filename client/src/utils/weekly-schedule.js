const DAY_MS = 86_400_000;

// Proposed frontend preview limit. Confirm it with the backend team.
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

/**
 * @param {string} destination
 * @param {{ repeat: string, interval: string, end: string,
 *   endDate: string, copies: string, months: string }} rule
 */
export function previewScheduleCopies(destination, rule) {
  if (!isCalendarDate(destination)) return null;

  if (rule.repeat === "once") {
    return {
      weeks: [
        formatScheduleRange(destination, addCalendarDays(destination, 6)),
      ],
      total: 1,
    };
  }

  const interval =
    rule.repeat === "custom"
      ? Number(rule.interval)
      : rule.repeat === "biweekly"
        ? 2
        : 1;

  const daysBetween = interval * 7;
  if (!Number.isSafeInteger(daysBetween) || daysBetween < 7) return null;

  let total = Infinity;

  if (rule.end === "copies") {
    total = Number(rule.copies);
    if (!Number.isSafeInteger(total) || total < 1) return null;
  } else if (rule.end === "date" || rule.end === "months") {
    let lastStart = rule.endDate;

    if (rule.end === "months") {
      const months = Number(rule.months);
      if (
        !Number.isInteger(months) ||
        months < 1 ||
        months > MAX_REPEAT_MONTHS
      ) {
        return null;
      }

      lastStart = addCalendarDays(addCalendarMonths(destination, months), -1);
    }

    if (!isCalendarDate(lastStart) || lastStart < destination) return null;

    const days =
      (parseDate(lastStart).getTime() - parseDate(destination).getTime()) /
      DAY_MS;
    total = Math.floor(days / daysBetween) + 1;
  }

  const weeks = [];
  const firstStart = parseDate(destination).getTime();

  for (let index = 0; index < Math.min(total, 4); index += 1) {
    const start = new Date(firstStart + index * daysBetween * DAY_MS);
    const end = new Date(start.getTime() + 6 * DAY_MS);
    if (!Number.isFinite(end.getTime()) || end.getUTCFullYear() > 9999) {
      return null;
    }

    weeks.push(dateFormatter.formatRange(start, end));
  }

  return { weeks, total };
}
