import {
  BookingError,
  createBooking,
  getBookingsByDateAndSlot,
} from '../dao/booking-dao.js';

import {
  getMealSlotCapacity,
  getMealSlots,
} from '../dao/capacity-dao.js';

/**
 * @typedef {import('../models/models.js').CreateBookingRequestDTO} CreateBookingRequestDTO
 * @typedef {import('../models/models.js').BookingDTO} BookingDTO
 * @typedef {import('../models/models.js').DiningTableDTO} DiningTableDTO
 * @typedef {import('../models/models.js').DiningTableAvailabilityDTO} DiningTableAvailabilityDTO
 * @typedef {import('../models/models.js').MealSlotAvailabilityDTO} MealSlotAvailabilityDTO
 */

/* VALIDATION */

/**
 * Checks the format and existence of a calendar date.
 *
 * @param {unknown} value
 * @returns {value is string}
 */
function isValidDate(value) {
  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value)
  ) {
    return false;
  }

  const [year, month, day] = value.split('-').map(Number);

  if (year < 1) {
    return false;
  }

  const date = new Date(0);
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCFullYear(year, month - 1, day);

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

/**
 * Validates the booking date and meal-slot ID.
 *
 * @param {unknown} bookingDate
 * @param {unknown} slotId
 */
function validateBookingSelection(bookingDate, slotId) {
  if (
    !isValidDate(bookingDate) ||
    typeof slotId !== 'number' ||
    !Number.isSafeInteger(slotId) ||
    slotId <= 0
  ) {
    throw new BookingError(
      'INVALID_BOOKING',
      'A valid booking date and meal-slot ID are required.'
    );
  }
}

/* HELPERS */

/**
 * Calculates remaining seats from confirmed bookings.
 * Different parties may share a table.
 * Inactive tables have no bookable seats.
 *
 * @param {DiningTableDTO[]} tables
 * @param {BookingDTO[]} bookings
 * @returns {DiningTableAvailabilityDTO[]}
 */
function calculateAvailableTables(tables, bookings) {
  /** @type {Map<number, number>} */
  const reservedSeatsByTable = new Map();

  for (const booking of bookings) {
    if (booking.status !== 'confirmed') {
      continue;
    }

    for (const allocation of booking.allocations) {
      const currentReservedSeats =
        reservedSeatsByTable.get(allocation.tableId) ?? 0;

      reservedSeatsByTable.set(
        allocation.tableId,
        currentReservedSeats + allocation.seatsReserved
      );
    }
  }

  return tables.map((table) => {
    const reservedSeats = reservedSeatsByTable.get(table.id) ?? 0;

    return {
      ...table,
      reservedSeats,
      availableSeats: table.isActive
        ? Math.max(0, table.seatCount - reservedSeats)
        : 0,
    };
  });
}

/* READ */

/**
 * Returns availability for a date and slot.
 * Returns null if the slot is missing or inactive.
 * Availability is informative and does not reserve tables.
 *
 * @param {string} bookingDate - Format: YYYY-MM-DD.
 * @param {number} slotId
 * @returns {Promise<MealSlotAvailabilityDTO | null>}
 */
export async function getMealSlotAvailability(bookingDate, slotId) {
  validateBookingSelection(bookingDate, slotId);

  const mealSlots = await getMealSlots();
  const mealSlot = mealSlots.find((slot) => slot.id === slotId);

  if (!mealSlot || !mealSlot.isActive) {
    return null;
  }

  const slotCapacity = await getMealSlotCapacity(slotId);

  if (!slotCapacity) {
    return null;
  }

  const bookings = await getBookingsByDateAndSlot(
    bookingDate,
    slotId
  );

  const tables = calculateAvailableTables(
    slotCapacity.tables,
    bookings
  );

  return {
    bookingDate,
    slotId: mealSlot.id,
    slotName: mealSlot.name,
    startTime: mealSlot.startTime,
    endTime: mealSlot.endTime,
    tables,
    totalAvailableSeats: tables.reduce(
      (total, table) => total + table.availableSeats,
      0
    ),
  };
}

/**
 * Returns today's date in the hut's time zone.
 *
 * @returns {string}
 */
function getTodayInHutTimeZone() {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Rome',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());

  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;

  if (!year || !month || !day) {
    throw new Error('Unable to determine the current date.');
  }

  return `${year}-${month}-${day}`;
}

/* CREATE */

/**
 * Validates the input and delegates atomic booking creation to the DAO.
 *
 * @param {CreateBookingRequestDTO & { hikerId: number }} bookingData
 * @returns {Promise<BookingDTO>}
 */
export async function createBookingForHiker({
  hikerId,
  bookingDate,
  slotId,
  partySize,
}) {
  validateBookingSelection(bookingDate, slotId);

  if (bookingDate < getTodayInHutTimeZone()) {
    throw new BookingError(
      'INVALID_BOOKING',
      'Booking date must be today or a future date.'
    );
  }

  if (!Number.isSafeInteger(hikerId) || hikerId <= 0) {
    throw new BookingError(
      'INVALID_BOOKING',
      'A valid hiker ID is required.'
    );
  }

  if (!Number.isSafeInteger(partySize) || partySize <= 0) {
    throw new BookingError(
      'INVALID_PARTY_SIZE',
      'Party size must be a positive integer.'
    );
  }

  // Calls createBooking imported from the DAO.
  return createBooking({
    hikerId,
    bookingDate,
    slotId,
    partySize,
  });
}