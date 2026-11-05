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
 * @property {string} html
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
 * @param {unknown} value
 * @returns {value is string}
 */
function isValidBookingDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

/**
 * Escapes values before inserting them into the HTML body.
 *
 * @param {string | number} value
 * @returns {string}
 */
function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
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
    !isValidBookingDate(booking?.bookingDate) ||
    !isPositiveInteger(booking.partySize) ||
    !Array.isArray(booking.allocations) ||
    booking.allocations.length === 0 ||
    !booking.allocations.every(
      (allocation) =>
        isPositiveInteger(allocation?.tableId) &&
        isPositiveInteger(allocation?.seatsReserved)
    ) ||
    booking.allocations.reduce(
      (total, allocation) => total + allocation.seatsReserved,
      0
    ) !== booking.partySize
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

  if (
    tables !== undefined &&
    (!Array.isArray(tables) ||
      !tables.every(
        (table) =>
          isPositiveInteger(table?.id) && isNonEmptyString(table?.name)
      ))
  ) {
    throw new TypeError(
      'Dining tables must be an array of valid table records.'
    );
  }

  if (
    requirements !== undefined &&
    (!Array.isArray(requirements) ||
      !requirements.every((requirement) =>
        typeof requirement?.hasAllergies === 'boolean' &&
        isNonEmptyString(requirement.description)
      ))
  ) {
    throw new TypeError(
      'Party requirements must be an array of items with a description.'
    );
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

  /** @type {[string, string | number][]} */
  const details = [
    ['Booking reference', reference],
    ['Name', hikerName],
    ['Date', date],
    ['Meal service', service],
    ['Party size', booking.partySize],
  ];

  const tableNames = new Map(tables.map((table) => [table.id, table.name]));
  const allocations = booking.allocations.map((allocation) => {
    const tableName =
      tableNames.get(allocation.tableId) ?? `Table #${allocation.tableId}`;
    const seats = allocation.seatsReserved === 1 ? 'seat' : 'seats';

    return `${tableName}: ${allocation.seatsReserved} ${seats}`;
  });

  const greeting = `Hello ${hikerName},`;
  const intro = 'Your table booking at the Mountain Hut is confirmed.';
  const closing = `Please quote booking reference ${reference} if you need to contact the hut.`;

  // Text and HTML bodies show the same content.
  const textLines = [
    greeting,
    '',
    intro,
    '',
    ...details.map(([label, value]) => `${label}: ${value}`),
    '',
    'Table allocation:',
    ...allocations.map((allocation) => `- ${allocation}`),
  ];

  const htmlLines = [
    `<p>${escapeHtml(greeting)}</p>`,
    `<p>${intro}</p>`,
    '<ul>',
    ...details.map(
      ([label, value]) =>
        `  <li><strong>${label}:</strong> ${escapeHtml(value)}</li>`
    ),
    '</ul>',
    '<p><strong>Table allocation:</strong></p>',
    '<ul>',
    ...allocations.map((allocation) => `  <li>${escapeHtml(allocation)}</li>`),
    '</ul>',
  ];

  if (requirements.length > 0) {
    textLines.push(
      '',
      'Party requirements:',
      ...requirements.map(
        (requirement) =>
          `- ${requirement.hasAllergies ? '[ALLERGIES] ' : ''}${requirement.description.trim()}`
      )
    );

    htmlLines.push(
      '<p><strong>Party requirements:</strong></p>',
      '<ul>',
      ...requirements.map(
        (requirement) =>
          `  <li>${requirement.hasAllergies ? '<strong>[ALLERGIES]</strong> ' : ''}${escapeHtml(requirement.description.trim())}</li>`
      ),
      '</ul>'
    );
  }

  textLines.push('', closing, '', 'See you soon,', 'The Mountain Hut team');
  htmlLines.push(
    `<p>${escapeHtml(closing)}</p>`,
    '<p>See you soon,<br>The Mountain Hut team</p>'
  );

  return {
    to: hiker.email.trim(),
    subject: `Booking confirmed ${reference} - ${mealSlot.name.trim()}, ${date}`,
    html: htmlLines.join('\n'),
    text: textLines.join('\n'),
  };
}
