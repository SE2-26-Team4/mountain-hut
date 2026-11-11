/**
 * Converts a meal date and time in Europe/Rome to a timestamp.
 *
 * @param {string} bookingDate
 * @param {string} startTime
 * @returns {number}
 */
export function getMealStartTimestamp(bookingDate, startTime) {
  // Treat the requested local clock values as UTC to create a comparison target.
  // This is a starting reference, not yet the actual meal timestamp.
  const localTime = `${bookingDate}T${startTime}:00`;
  const wallClockTimestamp = Date.parse(`${localTime}Z`);

  // Format candidate timestamps in the hut's time zone.
  // Europe/Rome accounts for standard time and daylight saving time.
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

  // Start with the reference timestamp and adjust it to match the local clock.
  let timestamp = wallClockTimestamp;

  // Allow up to three corrections to find a matching instant.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const parts = formatter.formatToParts(new Date(timestamp));

    /** @param {Intl.DateTimeFormatPartTypes} type */
    const value = (type) =>
      parts.find((part) => part.type === type)?.value;

    // Represent the candidate's Rome clock values as UTC for comparison.
    const displayedTimestamp = Date.parse(
      `${value('year')}-${value('month')}-${value('day')}` +
      `T${value('hour')}:${value('minute')}:${value('second')}Z`
    );

    // Measure the difference between the requested and displayed local times.
    const correction = wallClockTimestamp - displayedTimestamp;

    // A zero difference means the candidate matches the requested local time.
    if (correction === 0) {
      return timestamp;
    }

    // Shift the candidate by the difference and check it again.
    timestamp += correction;
  }

  // Reject a local time that could not be matched, such as a skipped DST time.
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
  // Subtract two elapsed hours, expressed in milliseconds, from the meal start.
  return (
    getMealStartTimestamp(bookingDate, startTime) -
    2 * 60 * 60 * 1000
  );
}