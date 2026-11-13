/**
 * Data types used to prepare booking confirmation emails.
 *
 * @typedef {import('../models/models.js').BookingDTO} BookingDTO
 * @typedef {import('../models/models.js').MealSlotDTO} MealSlotDTO
 * @typedef {import('../models/models.js').DiningTableDTO} DiningTableDTO
 */

/**
 * Party requirement shown in the confirmation.
 *
 * @typedef {Object} PartyRequirement
 * @property {boolean} hasAllergies
 * @property {string} description
 */

/**
 * Booking, hiker, and service details needed to build the email.
 *
 * @typedef {Object} BookingConfirmationEmailInput
 * @property {Pick<Express.User, 'full_name' | 'email'>} hiker - Hiker who made the booking.
 * @property {BookingDTO} booking - Booking as returned after persistence.
 * @property {Pick<MealSlotDTO, 'name' | 'startTime' | 'endTime'>} mealSlot - Booked meal service.
 * @property {Pick<DiningTableDTO, 'id' | 'name'>[]} [tables] - Used to show table names instead of IDs.
 * @property {PartyRequirement[]} [requirements] - Listed only when provided.
 * @property {boolean} [isEdit] - Whether the email follows an update to an existing booking.
 */

/**
 * Prepared email content passed to the sending service.
 *
 * @typedef {Object} BookingConfirmationEmail
 * @property {string} to
 * @property {string} subject
 * @property {string} html
 * @property {string} text
 */

/* HELPERS */

/**
 * Checks whether a value is text containing non-whitespace characters.
 *
 * @param {unknown} value
 * @returns {value is string}
 */
function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * Checks whether a value is a positive safe integer.
 *
 * @param {unknown} value
 * @returns {value is number}
 */
function isPositiveInteger(value) {
  return Number.isSafeInteger(value) && Number(value) > 0;
}

/**
 * Checks the date format and verifies that the calendar date exists.
 *
 * @param {unknown} value
 * @returns {value is string}
 */
function isValidBookingDate(value) {
  // Reject values that do not use the expected YYYY-MM-DD format.
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  // Compare the resulting date parts to detect invalid calendar dates.
  const [year, month, day] = value.split("-").map(Number);
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
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/**
 * Formats a YYYY-MM-DD date without shifting it across time zones.
 *
 * @param {string} bookingDate
 * @returns {string} E.g. "Thursday 5 November 2026".
 */
function formatBookingDate(bookingDate) {
  // Use UTC to preserve the calendar date and assemble a consistent layout.
  const parts = new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).formatToParts(new Date(`${bookingDate}T00:00:00Z`));

  /** @param {Intl.DateTimeFormatPartTypes} type */
  const part = (type) => parts.find((item) => item.type === type)?.value;

  return `${part("weekday")} ${part("day")} ${part("month")} ${part("year")}`;
}

/**
 * Rejects missing or invalid data before building the confirmation.
 *
 * @param {BookingConfirmationEmailInput} input
 */
function validateInput({ hiker, booking, mealSlot, tables, requirements }) {
  // Require both the recipient address and the booking hiker's name.
  if (!isNonEmptyString(hiker?.email) || !isNonEmptyString(hiker.full_name)) {
    throw new Error("Hiker name and email are required.");
  }

  // Require valid booking details and positive table allocations.
  // The allocated seats must add up to the party size.
  if (
    !isPositiveInteger(booking?.id) ||
    !isValidBookingDate(booking?.bookingDate) ||
    !isPositiveInteger(booking.partySize) ||
    !Array.isArray(booking.allocations) ||
    booking.allocations.length === 0 ||
    !booking.allocations.every(
      (allocation) =>
        isPositiveInteger(allocation?.tableId) &&
        isPositiveInteger(allocation?.seatsReserved),
    ) ||
    booking.allocations.reduce(
      (total, allocation) => total + allocation.seatsReserved,
      0,
    ) !== booking.partySize
  ) {
    throw new Error(
      "Booking ID, date, party size, and table allocations are required.",
    );
  }

  // Require the meal service name and its displayed time range.
  if (
    !isNonEmptyString(mealSlot?.name) ||
    !isNonEmptyString(mealSlot.startTime) ||
    !isNonEmptyString(mealSlot.endTime)
  ) {
    throw new Error("Meal service name and times are required.");
  }

  // Validate optional table records used to display names instead of IDs.
  if (
    tables !== undefined &&
    (!Array.isArray(tables) ||
      !tables.every(
        (table) =>
          isPositiveInteger(table?.id) && isNonEmptyString(table?.name),
      ))
  ) {
    throw new TypeError(
      "Dining tables must be an array of valid table records.",
    );
  }

  // Require each optional requirement to have a boolean flag and description.
  if (
    requirements !== undefined &&
    (!Array.isArray(requirements) ||
      !requirements.every(
        (requirement) =>
          typeof requirement?.hasAllergies === "boolean" &&
          isNonEmptyString(requirement.description),
      ))
  ) {
    throw new TypeError(
      "Party requirements must be an array of items with a description.",
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
  // Validate all required content before generating either email format.
  validateInput(input);

  // Default optional table names and party requirements to empty lists.
  const { hiker, booking, mealSlot, tables = [], requirements = [] } = input;

  // Prepare the values shared by the subject, text body, and HTML body.
  const hikerName = hiker.full_name.trim();
  const reference = `#${booking.id}`;
  const date = formatBookingDate(booking.bookingDate);
  const service = `${mealSlot.name.trim()}, ${mealSlot.startTime}-${mealSlot.endTime}`;

  // Define the booking details displayed in the summary.
  /** @type {[string, string | number][]} */
  const details = [
    ["Booking reference", reference],
    ["Name", hikerName],
    ["Date", date],
    ["Meal service", service],
    ["Party size", booking.partySize],
  ];

  // Resolve table names, falling back to IDs when names are unavailable.
  const tableNames = new Map(tables.map((table) => [table.id, table.name]));

  const allocations = booking.allocations.map((allocation) => {
    const tableName =
      tableNames.get(allocation.tableId) ?? `Table #${allocation.tableId}`;

    const seats = allocation.seatsReserved === 1 ? "seat" : "seats";

    return `${tableName}: ${allocation.seatsReserved} ${seats}`;
  });

  // Use the same wording in the subject, HTML, and plain-text versions of the email.
  const greeting = `Hello ${hikerName},`;
  const action = input.isEdit ? "updated" : "confirmed";
  const intro = `Your table booking at the Mountain Hut is ${action}.`;
  const closing = `Please quote booking reference ${reference} if you need to contact the hut.`;

  // Build the plain-text summary for email clients that do not display HTML.
  const textLines = [
    greeting,
    "",
    intro,
    "",
    ...details.map(([label, value]) => `${label}: ${value}`),
    "",
    "Table allocation:",
    ...allocations.map((allocation) => `- ${allocation}`),
  ];

  // Build escaped HTML rows for the booking summary table.
  const detailRows = details
    .map(
      ([label, value]) => `
      <tr>
        <th style="padding:14px 18px;text-align:left;vertical-align:top;width:40%;font-size:14px;font-weight:400;color:#596873;border-bottom:1px solid #e3e3de;">
          ${escapeHtml(label)}
        </th>
        <td style="padding:14px 18px;text-align:left;vertical-align:top;font-size:14px;font-weight:600;border-bottom:1px solid #e3e3de;overflow-wrap:anywhere;">
          ${escapeHtml(value)}
        </td>
      </tr>
    `,
    )
    .join("");

  // Build escaped list items for the table allocation row.
  const allocationRows = allocations
    .map((allocation) => `<li>${escapeHtml(allocation)}</li>`)
    .join("");

  // Omit the requirements row when no requirements were provided.
  let requirementsHtml = "";

  if (requirements.length > 0) {
    // Include complete requirement descriptions in the plain-text message.
    textLines.push(
      "",
      "Party requirements:",
      ...requirements.map(
        (requirement) =>
          `- ${requirement.hasAllergies ? "[ALLERGIES] " : ""}${requirement.description.trim()}`,
      ),
    );

    // Escape user-provided text before preserving line breaks in HTML.
    // Display an allergy marker only when the requirement is flagged.
    const requirementsContent = requirements
      .map((requirement) => {
        const description = escapeHtml(requirement.description.trim()).replace(
          /\r\n|\r|\n/g,
          "<br>",
        );

        return `
          <div style="margin:0 0 8px;">
            ${requirement.hasAllergies ? "<strong>[ALLERGIES]</strong> " : ""}
            ${description}
          </div>
        `;
      })
      .join("");

    // Place requirements in the final summary row, spanning both columns.
    // Keep the full text below its label without truncation.
    requirementsHtml = `
      <tr>
        <td colspan="2"
          style="padding:14px 18px;border-top:1px solid #e3e3de;text-align:left;vertical-align:top;">

          <div style="margin:0 0 8px;font-size:14px;font-weight:400;color:#596873;">
            Party requirements:
          </div>

          <div style="font-size:14px;line-height:1.65;font-weight:400;color:#172c38;overflow-wrap:anywhere;word-wrap:break-word;word-break:break-word;">
            ${requirementsContent}
          </div>

        </td>
      </tr>
    `;
  }

  // Finish the plain-text message with the contact instruction and signature.
  textLines.push("", closing, "", "See you soon,", "The Mountain Hut team");

  // Assemble the HTML email with inline styles and presentation tables.
  // The hidden opening text provides an inbox preview.
  // Requirements remain inside the summary table as its final row.
  // The logo uses the content ID attached by the sending service.
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Your booking is ${action}</title>
</head>
<body style="margin:0;padding:0;background:#f3f1ec;color:#172c38;font-family:Arial,Helvetica,sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">
    Your Mountain Hut booking ${escapeHtml(reference)} is ${action}.
  </div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td align="center" style="padding:32px 12px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0"
          style="width:100%;max-width:600px;border-spacing:0;">

          <tr>
            <td bgcolor="#102b3a"
              style="padding:30px 28px 32px;border-radius:20px 20px 0 0;background:#102b3a;">
              <p style="margin:0 0 22px;color:#ffffff;font-size:12px;font-weight:700;letter-spacing:2px;">
                MOUNTAIN HUT
              </p>
              <p style="margin:0 0 10px;color:#f49461;font-size:12px;letter-spacing:1.4px;font-weight:bold;">
                RESERVATION ${action.toUpperCase()}
              </p>
              <h1 style="margin:0;color:#ffffff;font-size:28px;line-height:1.25;font-weight:600;">
                Your booking is ${action}
              </h1>
            </td>
          </tr>

          <tr>
            <td bgcolor="#ffffff"
              style="background:#ffffff;padding:28px;border-radius:0 0 20px 20px;font-size:15px;line-height:1.65;">
              <p style="margin:0 0 12px;">
                ${escapeHtml(greeting)}
              </p>
              <p style="margin:0 0 24px;color:#596873;">
                ${escapeHtml(intro)}<br>
                We look forward to welcoming you.
              </p>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
                style="table-layout:fixed;background:#f5f3ef;border-radius:12px;border-spacing:0;">
                ${detailRows}
                <tr>
                  <th style="padding:14px 18px;text-align:left;vertical-align:top;font-size:14px;font-weight:400;color:#596873;">
                    Table allocation
                  </th>
                  <td style="padding:14px 18px;vertical-align:top;font-size:14px;line-height:1.8;font-weight:600;overflow-wrap:anywhere;">
                    <ul style="list-style:none;margin:0;padding:0;">
                      ${allocationRows}
                    </ul>
                  </td>
                </tr>
                ${requirementsHtml}
              </table>

              <p style="margin:24px 0;color:#596873;font-size:14px;">
                ${escapeHtml(closing)}
              </p>
              <p style="margin:0;">
                See you soon,<br>
                <strong>The Mountain Hut team</strong>
              </p>

              <img src="cid:mountain-hut-logo"
                width="84" height="49" alt="Mountain Hut"
                style="display:block;width:84px;height:49px;margin-top:14px;border:0;">
            </td>
          </tr>
        </table>

        <p style="margin:18px 0 0;color:#6b7479;font-size:12px;">
          Good food, higher horizons.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`;

  // Return the recipient, subject, and both message formats.
  // Sending the email is handled separately by the email service.
  return {
    to: hiker.email.trim(),
    subject: `Booking ${action} ${reference} - ${mealSlot.name.trim()}, ${date}`,
    html,
    text: textLines.join("\n"),
  };
}
