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
 * @property {string} [label]
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
        <td style="padding:14px 18px;text-align:left;vertical-align:top;font-size:14px;font-weight:500;border-bottom:1px solid #e3e3de;overflow-wrap:anywhere;">
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
    textLines.push(
      "",
      "Party requirements:",
      ...requirements.map((requirement) => {
        const label = requirement.label ? `${requirement.label}\n  ` : "";
        const allergy = requirement.hasAllergies ? "[FOOD ALLERGY] " : "";
        return `- ${label}${allergy}${requirement.description.trim()}`;
      }),
    );

    const requirementRows = requirements
      .map((requirement, index) => {
        const description = requirement.description.trim();
        const lineBreak = description.indexOf("\n");
        const firstLine =
          lineBreak < 0 ? description : description.slice(0, lineBreak).trim();

        const hasSectionLabel =
          lineBreak >= 0 &&
          (firstLine === "Dietary requirements:" ||
            firstLine === "Special requests:");

        const label =
          requirement.label ??
          (hasSectionLabel
            ? firstLine
            : index === 0
              ? "Party requirements:"
              : "");

        const value = hasSectionLabel
          ? description.slice(lineBreak + 1).trim()
          : description;

        const safeValue = escapeHtml(value).replace(/\r\n|\r|\n/g, "<br>");
        const divider = index > 0 ? "border-top:1px solid #e3e7eb;" : "";

        return `
          <tr>
            <td style="padding:12px 16px;${divider}text-align:left;vertical-align:top;font-size:14px;line-height:1.6;color:#172c38;overflow-wrap:anywhere;word-wrap:break-word;">
              ${label ? `<div style="margin-bottom:4px;color:#596873;font-weight:400;">${escapeHtml(label)}</div>` : ""}
              ${requirement.hasAllergies ? "<strong>[FOOD ALLERGY]</strong>" : ""}
              ${safeValue}
            </td>
          </tr>
        `;
      })
      .join("");

    requirementsHtml = `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
        style="margin-top:16px;table-layout:fixed;background:#ffffff;border:1px solid #dce2e7;border-radius:12px;border-spacing:0;">
        ${requirementRows}
      </table>
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
<body style="margin:0;padding:0;background:#f7f8fa;color:#172c38;font-family:Arial,Helvetica,sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">
    Your Mountain Hut booking ${escapeHtml(reference)} is ${action}.
  </div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td align="center" style="padding:32px 12px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0"
          style="width:100%;max-width:600px;border-spacing:0;">

          <tr>
            <td align="center" bgcolor="#ffffff"
              style="padding:28px 28px 12px;border-radius:20px 20px 0 0;background:#ffffff;">
              <p style="margin:0 0 20px;color:#172c38;font-size:12px;font-weight:400;letter-spacing:3px;">
                MOUNTAIN HUT
              </p>

              <table role="presentation" align="center" cellpadding="0" cellspacing="0"
                style="margin:0 auto 16px;">
                <tr>
                  <td align="center" valign="middle">
                    <img src="cid:booking-success-check"
                      width="60" height="60" alt=""
                      style="display:block;width:60px;height:60px;border:0;">
                  </td>
                </tr>
              </table>

              <h1 style="margin:0;color:#172c38;font-size:28px;line-height:1.25;font-weight:600;">
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
                style="table-layout:fixed;background:#ffffff;border:1px solid #dce2e7;border-radius:12px;border-spacing:0;">
                ${detailRows}
                <tr>
                  <th style="padding:14px 18px;text-align:left;vertical-align:top;font-size:14px;font-weight:400;color:#596873;">
                    Table allocation
                  </th>
                  <td style="padding:14px 18px;vertical-align:top;font-size:14px;line-height:1.8;font-weight:500;overflow-wrap:anywhere;">
                    <ul style="list-style:none;margin:0;padding:0;">
                      ${allocationRows}
                    </ul>
                  </td>
                </tr>
              </table>

              ${requirementsHtml}

              <p style="margin:24px 0;color:#596873;font-size:14px;">
                ${escapeHtml(closing)}
              </p>
              <p style="margin:0;">
                See you soon,<br>
                <strong>The Mountain Hut team</strong>
              </p>

              <img src="cid:mountain-hut-logo"
                width="84" height="49" alt="Mountain Hut"
                style="display:block;width:84px;height:49px;margin:14px auto 0;border:0;">
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
