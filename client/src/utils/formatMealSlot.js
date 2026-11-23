// Show meal times in 24-hour format, e.g. "19:00".
// UTC keeps the stored hut wall-clock time unchanged in every time zone.
const timeFormatter = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: "UTC",
});

/**
 * Formats a stored meal time in 24-hour HH:mm format, e.g. "19:00".
 *
 * @param {string} time
 * @returns {string} The original value when it is not a valid HH:mm time.
 */
export function formatMealTime(time) {
  const date = new Date(`1970-01-01T${time}:00Z`);

  return Number.isNaN(date.getTime()) ? time : timeFormatter.format(date);
}

/**
 * Formats a meal time range, e.g. "19:00 - 21:00".
 *
 * @param {string} startTime - HH:mm.
 * @param {string} endTime - HH:mm.
 */
export function formatMealTimeRange(startTime, endTime) {
  return `${formatMealTime(startTime)} - ${formatMealTime(endTime)}`;
}

/**
 * Formats the meal slot of a booking, e.g. "Dinner, 19:00 - 21:00".
 *
 * @param {Pick<
 *   import('../models/models.js').BookingDTO,
 *   'slotName' | 'slotStartTime' | 'slotEndTime'
 * >} booking
 * @returns {string | null} Null when the meal details are unavailable.
 */
export function formatMealSlot({ slotName, slotStartTime, slotEndTime }) {
  if (!slotName || !slotStartTime || !slotEndTime) return null;

  return `${slotName}, ${formatMealTimeRange(slotStartTime, slotEndTime)}`;
}
