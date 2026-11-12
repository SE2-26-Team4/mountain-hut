/**
 * Formats a YYYY-MM-DD booking date, e.g. "31 December 2099".
 *
 * Midday is used so the calendar date stays the same in every time zone.
 *
 * @param {string} bookingDate
 */
export function formatBookingDate(bookingDate) {
  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'long',
  }).format(new Date(`${bookingDate}T12:00:00`));
}
