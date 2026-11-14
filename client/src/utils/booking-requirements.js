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
 * @typedef {{ description: string, hasAllergies: boolean }} DietaryRequirement
 * @typedef {{
 *   dietaryAnswer: "yes" | "no" | null,
 *   dietaryRequirements: DietaryRequirement[],
 *   special: string,
 * }} BookingRequests
 */

const DIETARY_HEADING = "Dietary requirements:";
const SPECIAL_HEADING = "Special requests:";

/** @returns {BookingRequests} */
export function emptyBookingRequests() {
  return { dietaryAnswer: null, dietaryRequirements: [], special: "" };
}

/** @param {BookingRequests} requests */
export function formatBookingRequests(requests) {
  const { dietaryRequirements, specialRequests } =
    toBookingRequestFields(requests);

  return [
    dietaryRequirements ? `${DIETARY_HEADING}\n${dietaryRequirements}` : "",
    specialRequests ? `${SPECIAL_HEADING}\n${specialRequests}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

/**
 * @param {string} [savedSpecial]
 * @param {string} [savedDietary]
 * @returns {BookingRequests}
 */
export function readBookingRequests(savedSpecial = "", savedDietary = "") {
  if (savedDietary) {
    try {
      const entries = JSON.parse(savedDietary);
      if (
        Array.isArray(entries) &&
        entries.every(
          (entry) =>
            typeof entry?.description === "string" &&
            typeof entry?.hasAllergies === "boolean",
        )
      ) {
        return {
          dietaryAnswer: entries.length > 0 ? "yes" : "no",
          dietaryRequirements: entries,
          special: savedSpecial,
        };
      }
    } catch {
      // Keep the original text editable if the saved list cannot be read.
    }
  }

  if (savedDietary) {
    return {
      dietaryAnswer: "yes",
      dietaryRequirements: [{ description: savedDietary, hasAllergies: false }],
      special: savedSpecial,
    };
  }

  const [firstLine, ...remainingLines] = savedSpecial.split("\n");
  const hasAllergies = firstLine === FOOD_ALLERGY_REQUEST;
  const text = hasAllergies
    ? remainingLines.join("\n").trimStart()
    : savedSpecial;

  let description = "";
  let special = "";

  if (text.startsWith(`${DIETARY_HEADING}\n`)) {
    const body = text.slice(DIETARY_HEADING.length + 1);
    const separator = `\n\n${SPECIAL_HEADING}\n`;
    const splitAt = body.indexOf(separator);

    description = splitAt < 0 ? body : body.slice(0, splitAt);
    special = splitAt < 0 ? "" : body.slice(splitAt + separator.length);
  } else if (text.startsWith(`${SPECIAL_HEADING}\n`)) {
    special = text.slice(SPECIAL_HEADING.length + 1);
  } else if (hasAllergies) {
    description = text;
  } else {
    special = text;
  }

  return {
    dietaryAnswer: description || hasAllergies ? "yes" : "no",
    dietaryRequirements:
      description || hasAllergies ? [{ description, hasAllergies }] : [],
    special,
  };
}

/** @param {BookingRequests} requests */
export function toBookingRequestFields(requests) {
  const entries = (
    requests.dietaryAnswer === "yes" ? requests.dietaryRequirements : []
  )
    .map(({ description, hasAllergies }) => ({
      description: description.trim(),
      hasAllergies,
    }))
    .filter(({ description, hasAllergies }) => description || hasAllergies);

  return {
    dietaryRequirements: entries.length ? JSON.stringify(entries) : "",
    specialRequests: requests.special.trim(),
  };
}

/** @param {BookingRequests} requests */
export function hasUndescribedAllergy(requests) {
  return requests.dietaryRequirements.some(
    ({ description, hasAllergies }) => hasAllergies && !description.trim(),
  );
}

/**
 * @param {BookingRequests} requests
 * @param {number} partySize
 */
export function dietaryRequirementsIncomplete(requests, partySize) {
  if (requests.dietaryAnswer === null) return true;
  if (requests.dietaryAnswer === "no") return false;

  return (
    requests.dietaryRequirements.length > partySize ||
    !requests.dietaryRequirements.some(({ description }) =>
      description.trim(),
    ) ||
    hasUndescribedAllergy(requests)
  );
}

/** @param {BookingRequests} requests */
export function bookingRequestsTooLong(requests) {
  return (
    requests.special.length > MAX_SPECIAL_REQUEST_LENGTH ||
    (requests.dietaryAnswer === "yes" &&
      requests.dietaryRequirements.some(
        ({ description }) => description.length > MAX_SPECIAL_REQUEST_LENGTH,
      ))
  );
}
