export const MAX_SPECIAL_REQUEST_LENGTH = 1000;
export const FOOD_ALLERGY_REQUEST = "Food allergy reported";

/**
 * Combines the allergy selection with optional requests in the existing
 * booking field, preserving the API's current character limit.
 *
 * @param {string} specialRequests
 * @param {boolean} hasFoodAllergies
 * @returns {string}
 */
export function buildSpecialRequests(specialRequests, hasFoodAllergies) {
  const requirements = specialRequests.trim();

  if (!hasFoodAllergies) return requirements;

  const prefix = `${FOOD_ALLERGY_REQUEST}\n`;
  const remainingLength = MAX_SPECIAL_REQUEST_LENGTH - prefix.length;

  return `${prefix}${requirements.slice(0, remainingLength)}`.trim();
}

/**
 * @typedef {{
 *   showDietary: boolean,
 *   dietary: string,
 *   hasAllergies: boolean,
 *   special: string,
 * }} BookingRequests
 */

const DIETARY_HEADING = "Dietary requirements:";
const SPECIAL_HEADING = "Special requests:";

/** @returns {BookingRequests} */
export function emptyBookingRequests() {
  return { showDietary: false, dietary: "", hasAllergies: false, special: "" };
}

/** @param {BookingRequests} requests */
export function formatBookingRequests(requests) {
  const dietary = requests.showDietary ? requests.dietary.trim() : "";
  const allergies = requests.showDietary && requests.hasAllergies;
  const special = requests.special.trim();

  return [
    allergies ? FOOD_ALLERGY_REQUEST : "",
    dietary ? `${DIETARY_HEADING}\n${dietary}` : "",
    special ? `${SPECIAL_HEADING}\n${special}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

/** @param {string} [saved] */
export function readBookingRequests(saved = "") {
  const [firstLine, ...remainingLines] = saved.split("\n");
  const hasAllergies = firstLine === FOOD_ALLERGY_REQUEST;
  const text = hasAllergies ? remainingLines.join("\n").trimStart() : saved;
  const requests = { ...emptyBookingRequests(), hasAllergies };

  if (text.startsWith(`${DIETARY_HEADING}\n`)) {
    const body = text.slice(DIETARY_HEADING.length + 1);
    const separator = `\n\n${SPECIAL_HEADING}\n`;
    const splitAt = body.indexOf(separator);

    requests.dietary = splitAt < 0 ? body : body.slice(0, splitAt);
    requests.special =
      splitAt < 0 ? "" : body.slice(splitAt + separator.length);
  } else if (text.startsWith(`${SPECIAL_HEADING}\n`)) {
    requests.special = text.slice(SPECIAL_HEADING.length + 1);
  } else if (hasAllergies) {
    requests.dietary = text;
  } else {
    requests.special = text;
  }

  requests.showDietary = hasAllergies || Boolean(requests.dietary);
  return requests;
}

/** @param {BookingRequests} requests */
export function toBookingRequestFields(requests) {
  return {
    dietaryRequirements: requests.showDietary ? requests.dietary.trim() : "",
    specialRequests: requests.special.trim(),
  };
}

/** @param {BookingRequests} requests */
export function bookingRequestsTooLong(requests) {
  const { dietaryRequirements, specialRequests } =
    toBookingRequestFields(requests);

  return (
    dietaryRequirements.length > MAX_SPECIAL_REQUEST_LENGTH ||
    specialRequests.length > MAX_SPECIAL_REQUEST_LENGTH
  );
}
