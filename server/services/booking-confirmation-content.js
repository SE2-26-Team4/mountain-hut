/**
 * @typedef {import('../models/models.js').BookingDTO} BookingDTO
 * @typedef {import('../models/models.js').MealSlotDTO} MealSlotDTO
 * @typedef {import('../models/models.js').DiningTableDTO} DiningTableDTO
 */

/**
 * Party requirement shown in the confirmation (MH-05).
 *
 * @typedef {Object} PartyRequirement
 * @property {boolean} hasAllergies
 * @property {string} description
 */

/**
 * @typedef {Object} BookingConfirmationEmailInput
 * @property {Pick<Express.User, 'full_name' | 'email'>} hiker - Hiker who made the booking.
 * @property {BookingDTO} booking - Booking as returned after persistence.
 * @property {Pick<MealSlotDTO, 'name' | 'startTime' | 'endTime'>} mealSlot - Booked meal service.
 * @property {Pick<DiningTableDTO, 'id' | 'name'>[]} [tables] - Used to show table names instead of IDs.
 * @property {PartyRequirement[]} [requirements] - Listed only when provided.
 */

/**
 * @typedef {Object} BookingConfirmationEmail
 * @property {string} to
 * @property {string} subject
 * @property {string} text
 */

/* HELPERS */

/**
 * @param {unknown} value
 * @returns {value is string}
 */
function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * @param {unknown} value
 * @returns {value is number}
 */
function isPositiveInteger(value) {
  return Number.isSafeInteger(value) && Number(value) > 0;
}

/**
 * Formats a YYYY-MM-DD date without shifting it across time zones.
 *
 * @param {string} bookingDate
 * @returns {string} E.g. "Thursday 5 November 2026".
 */
function formatBookingDate(bookingDate) {
  // Built from parts so the output does not depend on the ICU version.
  const parts = new Intl.DateTimeFormat('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).formatToParts(new Date(`${bookingDate}T00:00:00Z`));

  /** @param {Intl.DateTimeFormatPartTypes} type */
  const part = (type) => parts.find((item) => item.type === type)?.value;

  return `${part('weekday')} ${part('day')} ${part('month')} ${part('year')}`;
}

/**
 * Throws if any data needed for the confirmation is missing.
 *
 * @param {BookingConfirmationEmailInput} input
 */
function validateInput({ hiker, booking, mealSlot, tables, requirements }) {
  if (!isNonEmptyString(hiker?.email) || !isNonEmptyString(hiker.full_name)) {
    throw new Error('Hiker name and email are required.');
  }

  if (
    !isPositiveInteger(booking?.id) ||
    typeof booking.bookingDate !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(booking.bookingDate) ||
    !isPositiveInteger(booking.partySize) ||
    !Array.isArray(booking.allocations) ||
    booking.allocations.length === 0
  ) {
    throw new Error(
      'Booking ID, date, party size, and table allocations are required.'
    );
  }

  if (
    !isNonEmptyString(mealSlot?.name) ||
    !isNonEmptyString(mealSlot.startTime) ||
    !isNonEmptyString(mealSlot.endTime)
  ) {
    throw new Error('Meal service name and times are required.');
  }

  if (tables !== undefined && !Array.isArray(tables)) {
    throw new TypeError('Dining tables must be provided as an array.');
  }

  if (requirements !== undefined && !Array.isArray(requirements)) {
    throw new TypeError('Party requirements must be provided as an array.');
  }
}

/* BUILD */

/**
 * Prepares the confirmation email sent to the hiker after a booking
 * is saved. The sender is configured by the email service.
 *
 * @param {BookingConfirmationEmailInput} input
 * @returns {BookingConfirmationEmail}
 */
export function buildBookingConfirmationEmail(input) {
  validateInput(input);

  const { hiker, booking, mealSlot, tables = [], requirements = [] } = input;

  const hikerName = hiker.full_name.trim();
  const reference = `#${booking.id}`;
  const date = formatBookingDate(booking.bookingDate);
  const service = `${mealSlot.name.trim()}, ${mealSlot.startTime}-${mealSlot.endTime}`;

  const tableNames = new Map(tables.map((table) => [table.id, table.name]));
  const allocations = booking.allocations.map((allocation) => {
    const tableName =
      tableNames.get(allocation.tableId) ?? `Table #${allocation.tableId}`;
    const seats = allocation.seatsReserved === 1 ? 'seat' : 'seats';

    return `- ${tableName}: ${allocation.seatsReserved} ${seats}`;
  });

  const lines = [
    `Hello ${hikerName},`,
    '',
    'Your table booking at the Mountain Hut is confirmed.',
    '',
    `Booking reference: ${reference}`,
    `Name: ${hikerName}`,
    `Date: ${date}`,
    `Meal service: ${service}`,
    `Party size: ${booking.partySize}`,
    '',
    'Table allocation:',
    ...allocations,
  ];

  if (requirements.length > 0) {
    lines.push(
      '',
      'Party requirements:',
      ...requirements.map(
        (requirement) =>
          `- ${requirement.hasAllergies ? '[ALLERGIES] ' : ''}${requirement.description.trim()}`
      )
    );
  }

  lines.push(
    '',
    `Please quote booking reference ${reference} if you need to contact the hut.`,
    '',
    'See you soon,',
    'The Mountain Hut team'
  );

  return {
    to: hiker.email.trim(),
    subject: `Booking confirmed ${reference} - ${mealSlot.name.trim()}, ${date}`,
    text: lines.join('\n'),
  };
}
