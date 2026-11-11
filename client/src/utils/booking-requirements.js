export const MAX_SPECIAL_REQUEST_LENGTH = 1000;
export const FOOD_ALLERGY_REQUEST = 'Food allergy reported';

/**
 * Combines the allergy selection with optional requests in the existing
 * booking field, preserving the API's current character limit.
 *
 * @param {string} specialRequests
 * @param {boolean} hasFoodAllergies
 * @returns {string}
 */
export function buildSpecialRequests(
  specialRequests,
  hasFoodAllergies,
) {
  const requirements = specialRequests.trim();

  if (!hasFoodAllergies) return requirements;

  const prefix = `${FOOD_ALLERGY_REQUEST}\n`;
  const remainingLength =
    MAX_SPECIAL_REQUEST_LENGTH - prefix.length;

  return `${prefix}${requirements.slice(0, remainingLength)}`.trim();
}
