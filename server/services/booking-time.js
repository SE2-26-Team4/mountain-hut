/**
 * Converts a meal date and time in Europe/Rome to a timestamp.
 *
 * @param {string} bookingDate
 * @param {string} startTime
 * @returns {number}
 */
function getMealStartTimestamp(bookingDate, startTime) {
  const localTime = `${bookingDate}T${startTime}:00`;
  const wallClockTimestamp = Date.parse(`${localTime}Z`);

  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Rome',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });

  let timestamp = wallClockTimestamp;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const parts = formatter.formatToParts(new Date(timestamp));

    /** @param {Intl.DateTimeFormatPartTypes} type */
    const value = (type) =>
      parts.find((part) => part.type === type)?.value;

    const displayedTimestamp = Date.parse(
      `${value('year')}-${value('month')}-${value('day')}` +
      `T${value('hour')}:${value('minute')}:${value('second')}Z`
    );

    const correction = wallClockTimestamp - displayedTimestamp;

    if (correction === 0) {
      return timestamp;
    }

    timestamp += correction;
  }

  throw new Error(
    'The selected meal time is not valid in the hut time zone.'
  );
}

/**
 * Returns the booking deadline: two hours before service starts.
 *
 * @param {string} bookingDate
 * @param {string} startTime
 * @returns {number}
 */
export function getBookingDeadline(bookingDate, startTime) {
  return (
    getMealStartTimestamp(bookingDate, startTime) -
    2 * 60 * 60 * 1000
  );
}