import {
  BookingError,
  createBooking,
  getBookingsByDateAndSlot,
} from '../dao/booking-dao.js';

import {
  getMealSlotCapacity,
  getMealSlots,
} from '../dao/capacity-dao.js';

import { getBookingDeadline } from './booking-time.js';

/**
 * Data types used to validate bookings and calculate availability.
 *
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
  // Require the YYYY-MM-DD format before extracting date components.
  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value)
  ) {
    return false;
  }

  const [year, month, day] = value.split('-').map(Number);

  // Exclude year zero.
  if (year < 1) {
    return false;
  }

  // Build the date in UTC, preserving years below 100.
  const date = new Date(0);
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCFullYear(year, month - 1, day);

  // Detect invalid dates that JavaScript would otherwise normalize.
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
  // Require a real calendar date and a positive safe integer slot ID.
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
  // Accumulate reserved seats by table across all confirmed bookings.
  /** @type {Map<number, number>} */
  const reservedSeatsByTable = new Map();

  for (const booking of bookings) {
    // Cancelled bookings do not occupy seats.
    if (booking.status !== 'confirmed') {
      continue;
    }

    // Include every allocation when a party is split across tables.
    for (const allocation of booking.allocations) {
      const currentReservedSeats =
        reservedSeatsByTable.get(allocation.tableId) ?? 0;

      reservedSeatsByTable.set(
        allocation.tableId,
        currentReservedSeats + allocation.seatsReserved
      );
    }
  }

  // Attach reserved and available seat counts to each configured table.
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
  // Reject malformed dates and slot IDs before querying configuration.
  validateBookingSelection(bookingDate, slotId);

  // Find a slot that matches both the requested ID and booking date.
  const mealSlots = await getMealSlots();

  const mealSlot = mealSlots.find(
    (slot) =>
      slot.id === slotId &&
      slot.slotDate === bookingDate
  );

  // Missing, mismatched, and inactive slots are not available.
  if (!mealSlot || !mealSlot.isActive) {
    return null;
  }

  // Load the tables assigned to the selected slot.
  const slotCapacity = await getMealSlotCapacity(slotId);

  if (!slotCapacity) {
    return null;
  }

  // Read existing bookings to determine which seats are already occupied.
  const bookings = await getBookingsByDateAndSlot(
    bookingDate,
    slotId
  );

  // Calculate the free seats remaining at each assigned table.
  const tables = calculateAvailableTables(
    slotCapacity.tables,
    bookings
  );

  // Return slot details, the booking deadline, and total remaining seats.
  // The deadline is included for the client to check the booking window.
  return {
    bookingDate,
    bookingClosesAt: new Date(
      getBookingDeadline(bookingDate, mealSlot.startTime)
    ).toISOString(),
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
  // Determine the Rome calendar date independently of the server's time zone.
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Rome',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());

  // Extract the components needed for a sortable YYYY-MM-DD date.
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;

  // Stop rather than compare booking dates against an incomplete date.
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
  specialRequests = '',
}) {
  // Validate the date and slot ID before checking other booking fields.
  validateBookingSelection(bookingDate, slotId);

  // Reject past dates using the hut's local calendar date.
  if (bookingDate < getTodayInHutTimeZone()) {
    throw new BookingError(
      'INVALID_BOOKING',
      'Booking date must be today or a future date.'
    );
  }

  // Require a valid identifier for the hiker making the booking.
  if (!Number.isSafeInteger(hikerId) || hikerId <= 0) {
    throw new BookingError(
      'INVALID_BOOKING',
      'A valid hiker ID is required.'
    );
  }

  // Require a positive whole number of guests.
  if (!Number.isSafeInteger(partySize) || partySize <= 0) {
    throw new BookingError(
      'INVALID_PARTY_SIZE',
      'Party size must be a positive integer.'
    );
  }

  // Accept optional requests only as text of at most 1,000 characters.
  if (
    typeof specialRequests !== 'string' ||
    specialRequests.length > 1000
  ) {
    throw new BookingError(
      'INVALID_BOOKING',
      'Special requests must be text of at most 1000 characters.'
    );
  }

  // Normalize requests and delegate persistence to the DAO.
  // The DAO checks the slot, deadline, duplicates, and available seats
  // within the same transaction used to save the booking.
  return createBooking({
    hikerId,
    bookingDate,
    slotId,
    partySize,
    specialRequests: specialRequests.trim(),
  });
}