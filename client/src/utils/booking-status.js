const hutClock = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Rome",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/**
 * @param {import('../models/models.js').BookingDTO} booking
 * @param {Date} [now]
 * @returns {'Upcoming' | 'Past' | 'Cancelled'}
 */
export function getBookingStatus(booking, now = new Date()) {
  if (booking.status === "cancelled") return "Cancelled";

  const parts = hutClock.formatToParts(now);

  /** @param {Intl.DateTimeFormatPartTypes} type */
  const value = (type) => parts.find((part) => part.type === type)?.value;

  const today = `${value("year")}-${value("month")}-${value("day")}`;
  const time = `${value("hour")}:${value("minute")}`;

  const hasEnded =
    booking.bookingDate < today ||
    (booking.bookingDate === today &&
      booking.slotEndTime !== undefined &&
      booking.slotEndTime <= time);

  return hasEnded ? "Past" : "Upcoming";
}
