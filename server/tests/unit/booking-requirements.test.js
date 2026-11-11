import { describe, expect, it } from 'vitest';

import {
  buildSpecialRequests,
  FOOD_ALLERGY_REQUEST,
  MAX_SPECIAL_REQUEST_LENGTH,
} from '../../../client/src/utils/booking-requirements.js';

describe('booking special requests', () => {
  it('trims dietary requirements when no allergy is selected', () => {
    expect(buildSpecialRequests('  Vegetarian meal  ', false)).toBe(
      'Vegetarian meal',
    );
  });

  it('includes the allergy selection with the existing requirements', () => {
    expect(
      buildSpecialRequests('Nut-free meal, please.', true),
    ).toBe(`${FOOD_ALLERGY_REQUEST}\nNut-free meal, please.`);
  });

  it('includes the allergy selection when no other request is provided', () => {
    expect(buildSpecialRequests('  ', true)).toBe(
      FOOD_ALLERGY_REQUEST,
    );
  });

  it('keeps the combined request within the existing API limit', () => {
    const result = buildSpecialRequests(
      'x'.repeat(MAX_SPECIAL_REQUEST_LENGTH),
      true,
    );

    expect(result).toHaveLength(MAX_SPECIAL_REQUEST_LENGTH);
    expect(result.startsWith(FOOD_ALLERGY_REQUEST)).toBe(true);
  });
});
