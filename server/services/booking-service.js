import {
  BookingError,
  createBooking,
  createStaffBooking,
  getBookingsByDateAndSlot,
  registerHiker,
} from '../dao/booking-dao.js';

import { searchHikers } from '../dao/auth-dao.js';

import {
  getMealSlotCapacity,
  getMealSlots,
} from '../dao/capacity-dao.js';

import { getBookingDeadline } from './booking-time.js';
import {
  generateInitialPassword,
  hashPassword,
} from './password.js';

/**
 * Data types used to validate bookings and calculate availability.
 *
 * @typedef {import('../models/models.js').CreateBookingRequestDTO} CreateBookingRequestDTO
 * @typedef {import('../models/models.js').BookingDTO} BookingDTO
 * @typedef {import('../models/models.js').DiningTableDTO} DiningTableDTO
 * @typedef {import('../models/models.js').DiningTableAvailabilityDTO} DiningTableAvailabilityDTO
 * @typedef {import('../models/models.js').MealSlotAvailabilityDTO} MealSlotAvailabilityDTO
 * @typedef {import('../models/models.js').HikerDTO} HikerDTO
 * @typedef {import('../models/models.js').StaffHikerInputDTO} StaffHikerInputDTO
 * @typedef {import('../models/models.js').CreateStaffBookingRequestDTO} CreateStaffBookingRequestDTO
 * @typedef {import('../models/models.js').StaffHikerRegistrationDTO} StaffHikerRegistrationDTO
 * @typedef {import('../models/models.js').StaffBookingDTO} StaffBookingDTO
 * @typedef {import('../dao/auth-dao.js').NewHikerRecord} NewHikerRecord
 */

/* LIMITS */

const MAX_NAME_LENGTH = 100;
const MAX_EMAIL_LENGTH = 254;
const MAX_TEXT_LENGTH = 500;
const MIN_SEARCH_LENGTH = 2;
const MAX_SEARCH_LENGTH = 100;

/* VALIDATION */

/**
 * Checks the format and existence of a calendar date.
 *
 * @param {unknown} value
 * @returns {value is string}
 */
function isValidDate(value) {
  // Require the YYYY-MM-DD format before extracting date components.
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const [year, month, day] = value.split("-").map(Number);

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
    typeof slotId !== "number" ||
    !Number.isSafeInteger(slotId) ||
    slotId <= 0
  ) {
    throw new BookingError(
      "INVALID_BOOKING",
      "A valid booking date and meal-slot ID are required.",
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
    if (booking.status !== "confirmed") {
      continue;
    }

    // Include every allocation when a party is split across tables.
    for (const allocation of booking.allocations) {
      const currentReservedSeats =
        reservedSeatsByTable.get(allocation.tableId) ?? 0;

      reservedSeatsByTable.set(
        allocation.tableId,
        currentReservedSeats + allocation.seatsReserved,
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
    (slot) => slot.id === slotId && slot.slotDate === bookingDate,
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
  const bookings = await getBookingsByDateAndSlot(bookingDate, slotId);

  // Calculate the free seats remaining at each assigned table.
  const tables = calculateAvailableTables(slotCapacity.tables, bookings);

  // Return slot details, the booking deadline, and total remaining seats.
  // The deadline is included for the client to check the booking window.
  return {
    bookingDate,
    bookingClosesAt: new Date(
      getBookingDeadline(bookingDate, mealSlot.startTime),
    ).toISOString(),
    slotId: mealSlot.id,
    slotName: mealSlot.name,
    startTime: mealSlot.startTime,
    endTime: mealSlot.endTime,
    tables,
    totalAvailableSeats: tables.reduce(
      (total, table) => total + table.availableSeats,
      0,
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
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Rome",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  // Extract the components needed for a sortable YYYY-MM-DD date.
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  // Stop rather than compare booking dates against an incomplete date.
  if (!year || !month || !day) {
    throw new Error("Unable to determine the current date.");
  }

  return `${year}-${month}-${day}`;
}

/* BOOKING VALIDATION */

/**
 * Validates the date and slot ID and rejects past dates.
 * Shared by hiker and staff bookings.
 *
 * @param {string} bookingDate
 * @param {number} slotId
 */
function validateBookingDateAndSlot(bookingDate, slotId) {
  // Validate the date and slot ID before checking other booking fields.
  validateBookingSelection(bookingDate, slotId);

  // Reject past dates using the hut's local calendar date.
  if (bookingDate < getTodayInHutTimeZone()) {
    throw new BookingError(
      "INVALID_BOOKING",
      "Booking date must be today or a future date.",
    );
  }
}

/**
 * Validates the party size and the optional special requests.
 * Shared by hiker and staff bookings.
 *
 * @param {number} partySize
 * @param {string} specialRequests
 */
function validateBookingDetails(partySize, specialRequests) {
  // Require a positive whole number of guests.
  if (!Number.isSafeInteger(partySize) || partySize <= 0) {
    throw new BookingError(
      "INVALID_PARTY_SIZE",
      "Party size must be a positive integer.",
    );
  }

  // Accept optional requests only as text of at most 1,000 characters.
  if (typeof specialRequests !== "string" || specialRequests.length > 1000) {
    throw new BookingError(
      "INVALID_BOOKING",
      "Special requests must be text of at most 1000 characters.",
    );
  }
}

/* HIKER VALIDATION */

/**
 * @param {string} message
 * @returns {BookingError}
 */
function invalidHiker(message) {
  return new BookingError('INVALID_HIKER', message);
}

/**
 * Returns the trimmed text of a required field.
 *
 * @param {unknown} value
 * @param {string} field
 * @param {number} maxLength
 * @returns {string}
 */
function requireText(value, field, maxLength) {
  const text = typeof value === 'string' ? value.trim() : '';

  if (text.length === 0 || text.length > maxLength) {
    throw invalidHiker(
      `${field} is required and must be at most ${maxLength} characters.`
    );
  }

  return text;
}

/**
 * Returns the trimmed text of an optional field, or null when it is empty.
 *
 * @param {unknown} value
 * @param {string} field
 * @param {number} maxLength
 * @returns {string | null}
 */
function optionalText(value, field, maxLength) {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value !== 'string' || value.trim().length > maxLength) {
    throw invalidHiker(
      `${field} must be text of at most ${maxLength} characters.`
    );
  }

  return value.trim() || null;
}

/**
 * Returns the email in lowercase, as stored for every account.
 *
 * @param {unknown} value
 * @returns {string}
 */
function normalizeEmail(value) {
  const email = requireText(value, 'Email', MAX_EMAIL_LENGTH).toLowerCase();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw invalidHiker('A valid email address is required.');
  }

  return email;
}

/**
 * Returns the phone without separators, so that it can be searched
 * regardless of how it was typed (e.g. "+39 333 123-4567").
 *
 * @param {unknown} value
 * @returns {string}
 */
function normalizePhone(value) {
  const phone = requireText(value, 'Phone', 30).replace(/[\s\-().]/g, '');

  if (!/^\+?\d{6,15}$/.test(phone)) {
    throw invalidHiker(
      'A valid phone number is required (6-15 digits, optional leading +).'
    );
  }

  return phone;
}

/**
 * Reads the hiker entered by staff as an object.
 *
 * @param {unknown} hiker
 * @returns {Record<string, unknown>}
 */
function toHikerInput(hiker) {
  if (typeof hiker !== 'object' || hiker === null) {
    throw invalidHiker('Hiker details are required.');
  }

  return /** @type {Record<string, unknown>} */ (hiker);
}

/**
 * Validates a new full or temporary hiker and prepares the record to save.
 * A full account receives a random initial password, hashed here so that
 * the slow hashing does not happen while the database is locked.
 *
 * @param {Record<string, unknown>} input
 * @returns {Promise<{ newHiker: NewHikerRecord, initialPassword?: string }>}
 */
async function prepareNewHiker(input) {
  switch (input.type) {
    case 'new': {
      const fullName = requireText(
        input.fullName,
        'Full name',
        MAX_NAME_LENGTH
      );
      const email = normalizeEmail(input.email);
      const phone = normalizePhone(input.phone);
      const notes = optionalText(input.notes, 'Notes', MAX_TEXT_LENGTH);
      const emergencyContact = optionalText(
        input.emergencyContact,
        'Emergency contact',
        MAX_TEXT_LENGTH
      );

      // The hiker must change this password at the first login.
      const initialPassword = generateInitialPassword();

      return {
        newHiker: {
          fullName,
          email,
          phone,
          notes,
          emergencyContact,
          passwordHash: await hashPassword(initialPassword),
          isTemporary: false,
          mustChangePassword: true,
        },
        initialPassword,
      };
    }

    case 'temporary': {
      // Only a name and an optional phone: no email, no web access.
      const fullName = requireText(
        input.fullName,
        'Full name',
        MAX_NAME_LENGTH
      );
      const phone = optionalText(input.phone, 'Phone', 30);

      return {
        newHiker: {
          fullName,
          email: null,
          phone: phone === null ? null : normalizePhone(phone),
          notes: null,
          emergencyContact: null,
          passwordHash: null,
          isTemporary: true,
          mustChangePassword: false,
        },
      };
    }

    default:
      throw invalidHiker(
        "Hiker type must be 'existing', 'new' or 'temporary'."
      );
  }
}

/* STAFF */

/**
 * Finds hikers by name, email or phone, for staff entering a booking.
 *
 * @param {unknown} term
 * @returns {Promise<HikerDTO[]>}
 */
export async function findHikers(term) {
  const text = typeof term === 'string' ? term.trim() : '';

  if (
    text.length < MIN_SEARCH_LENGTH ||
    text.length > MAX_SEARCH_LENGTH
  ) {
    throw invalidHiker(
      `The search term must be between ${MIN_SEARCH_LENGTH} and ${MAX_SEARCH_LENGTH} characters.`
    );
  }

  return searchHikers(text);
}

/**
 * Registers a new full or temporary hiker on behalf of staff.
 *
 * @param {unknown} hiker - A 'new' or 'temporary' StaffHikerInputDTO.
 * @returns {Promise<StaffHikerRegistrationDTO>}
 */
export async function registerHikerByStaff(hiker) {
  const input = toHikerInput(hiker);

  // An existing hiker is selected, not registered again.
  if (input.type === 'existing') {
    throw invalidHiker('Only new or temporary hikers can be registered.');
  }

  const { newHiker, initialPassword } = await prepareNewHiker(input);

  /** @type {StaffHikerRegistrationDTO} */
  const result = { hiker: await registerHiker(newHiker) };

  if (initialPassword !== undefined) {
    result.initialPassword = initialPassword;
  }

  return result;
}

/**
 * Creates a booking entered by staff for an existing, a new or a temporary
 * hiker. Staff can book until the meal service starts; the other rules
 * (availability, table allocation, one booking per slot) are the same as
 * for hikers. The initial password of a new account is returned once.
 *
 * @param {CreateStaffBookingRequestDTO} bookingData
 * @returns {Promise<StaffBookingDTO>}
 */
export async function createBookingByStaff({
  hiker,
  bookingDate,
  slotId,
  partySize,
  specialRequests = '',
}) {
  validateBookingDateAndSlot(bookingDate, slotId);
  validateBookingDetails(partySize, specialRequests);

  const input = toHikerInput(hiker);

  /** @type {import('../dao/booking-dao.js').StaffBookingHiker} */
  let staffHiker;

  /** @type {string | undefined} */
  let initialPassword;

  if (input.type === 'existing') {
    if (
      !Number.isSafeInteger(input.hikerId) ||
      Number(input.hikerId) <= 0
    ) {
      throw invalidHiker('A valid hiker ID is required.');
    }

    staffHiker = { existingHikerId: Number(input.hikerId) };
  } else {
    const prepared = await prepareNewHiker(input);

    staffHiker = { newHiker: prepared.newHiker };
    initialPassword = prepared.initialPassword;
  }

  // The DAO creates the hiker (if needed) and the booking atomically.
  const { booking, hiker: bookedHiker } = await createStaffBooking({
    hiker: staffHiker,
    bookingDate,
    slotId,
    partySize,
    specialRequests: specialRequests.trim(),
  });

  /** @type {StaffBookingDTO} */
  const result = { booking, hiker: bookedHiker };

  if (initialPassword !== undefined) {
    result.initialPassword = initialPassword;
  }

  return result;
}

/* CREATE AND UPDATE */

/**
 * Validates booking details before delegating creation or updates to the DAO.
 *
 * @param {CreateBookingRequestDTO & { hikerId: number }} bookingData
 * @param {number} [editBookingId]
 * @returns {Promise<BookingDTO>}
 */
export async function createBookingForHiker({
  hikerId,
  bookingDate,
  slotId,
  partySize,
  specialRequests = '',
}, editBookingId) {
  validateBookingDateAndSlot(bookingDate, slotId);

  // Require a valid identifier for the hiker making the booking.
  if (!Number.isSafeInteger(hikerId) || hikerId <= 0) {
    throw new BookingError(
      'INVALID_BOOKING',
      'A valid hiker ID is required.'
    );
  }

  validateBookingDetails(partySize, specialRequests);

  // Pass validated booking details to the DAO, including the booking ID for an edit.
  const bookingData = {
    hikerId,
    bookingDate,
    slotId,
    partySize,
    specialRequests: specialRequests.trim(),
  };

  return editBookingId === undefined
    ? createBooking(bookingData)
    : createBooking(bookingData, editBookingId);
}
