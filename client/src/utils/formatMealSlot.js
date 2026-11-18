// Show meal times with the AM/PM convention, e.g. "7:00 PM".
// UTC keeps the stored hut wall-clock time unchanged in every time zone.
const timeFormatter = new Intl.DateTimeFormat('en-US', {
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
  timeZone: 'UTC',
});

/**
 * Formats a stored HH:mm meal time, e.g. "19:00" as "7:00 PM".
 *
 * @param {string} time
 * @returns {string} The original value when it is not a valid HH:mm time.
 */
export function formatMealTime(time) {
  const date = new Date(`1970-01-01T${time}:00Z`);

  return Number.isNaN(date.getTime()) ? time : timeFormatter.format(date);
}

/**
 * Formats a meal time range, e.g. "7:00 PM - 9:00 PM".
 *
 * @param {string} startTime - HH:mm.
 * @param {string} endTime - HH:mm.
 */
export function formatMealTimeRange(startTime, endTime) {
  return `${formatMealTime(startTime)} - ${formatMealTime(endTime)}`;
}

/**
 * Formats the meal slot of a booking, e.g. "Dinner, 7:00 PM - 9:00 PM".
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
