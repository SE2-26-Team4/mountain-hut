import { describe, expect, it } from 'vitest';

import {
  validateDiningTable,
  validateMealSlot,
  validateSlotTableAssignment,
} from '../../services/capacity-validation.js';

describe('meal-slot validation', () => {
  it('trims the name and accepts valid times', () => {
    expect(
      validateMealSlot({
        slotDate: '2099-12-30',
        name: ' Dinner ',
        startTime: '18:00',
        endTime: '20:00',
        isActive: true,
      }),
    ).toEqual({
      slotDate: '2099-12-30',
      name: 'Dinner',
      startTime: '18:00',
      endTime: '20:00',
      isActive: true,
    });
  });

  it('rejects an empty name', () => {
    expect(() =>
      validateMealSlot({
        slotDate: '2099-12-30',
        name: '  ',
        startTime: '18:00',
        endTime: '20:00',
      }),
    ).toThrow('Meal slot name is required.');
  });

  it('rejects invalid time formats and times', () => {
    expect(() =>
      validateMealSlot({
        slotDate: '2099-12-30',
        name: 'Dinner',
        startTime: '6pm',
        endTime: '20:00',
      }),
    ).toThrow('Meal slot times must use the HH:mm format.');

    expect(() =>
      validateMealSlot({
        slotDate: '2099-12-30',
        name: 'Dinner',
        startTime: '18:60',
        endTime: '20:00',
      }),
    ).toThrow('Meal slot times must use the HH:mm format.');
  });

  it('requires the end time to be later than the start time', () => {
    expect(() =>
      validateMealSlot({
        slotDate: '2099-12-30',
        name: 'Dinner',
        startTime: '20:00',
        endTime: '18:00',
      }),
    ).toThrow('Meal slot end time must be later than its start time.');
  });

  it('rejects a non-boolean active status', () => {
    expect(() =>
      validateMealSlot({
        slotDate: '2099-12-30',
        name: 'Dinner',
        startTime: '18:00',
        endTime: '20:00',
        isActive: 1,
      }),
    ).toThrow('Meal slot active status must be a boolean.');
  });

  it.each([null, undefined, 'Dinner', 1, []])(
    'rejects non-object input: %j',
    (input) => {
      expect(() => validateMealSlot(input)).toThrow(
        'Meal slot data must be an object.',
      );
    },
  );

  it('rejects a non-string name', () => {
    expect(() =>
      validateMealSlot({
        slotDate: '2099-12-30',
        name: 123,
        startTime: '18:00',
        endTime: '20:00',
      }),
    ).toThrow('Meal slot name is required.');
  });

  it('rejects a non-string start time', () => {
    expect(() =>
      validateMealSlot({
        slotDate: '2099-12-30',
        name: 'Dinner',
        startTime: 1800,
        endTime: '20:00',
      }),
    ).toThrow('Meal slot times must use the HH:mm format.');
  });

  it('rejects an invalid end time', () => {
    expect(() =>
      validateMealSlot({
        slotDate: '2099-12-30',
        name: 'Dinner',
        startTime: '18:00',
        endTime: '24:00',
      }),
    ).toThrow('Meal slot times must use the HH:mm format.');
  });

  it('accepts valid input without active status', () => {
    const result = validateMealSlot({
      slotDate: '2099-12-30',
      name: 'Dinner',
      startTime: '18:00',
      endTime: '20:00',
    });

    expect(result).toEqual({
      slotDate: '2099-12-30',
      name: 'Dinner',
      startTime: '18:00',
      endTime: '20:00',
    });

    expect(result).not.toHaveProperty('isActive');
  });
});

describe('dining-table validation', () => {
  it('trims the name and accepts a positive integer seat count', () => {
    expect(
      validateDiningTable({
        name: ' Table 1 ',
        seatCount: 4,
        isActive: true,
      }),
    ).toEqual({
      name: 'Table 1',
      seatCount: 4,
      isActive: true,
    });
  });

  it('rejects an empty name', () => {
    expect(() =>
      validateDiningTable({ name: '  ', seatCount: 4 }),
    ).toThrow('Dining table name is required.');
  });

  it('rejects zero, negative, and non-integer seat counts', () => {
    for (const seatCount of [0, -1, 2.5]) {
      expect(() =>
        validateDiningTable({ name: 'Table 1', seatCount }),
      ).toThrow('Dining table seat count must be a positive integer.');
    }
  });

  it('rejects a non-string name', () => {
    expect(() =>
      validateDiningTable({
        name: 123,
        seatCount: 4,
      }),
    ).toThrow('Dining table name is required.');
  });

  it('accepts valid input without active status', () => {
    const result = validateDiningTable({
      name: 'Table 1',
      seatCount: 4,
    });

    expect(result).toEqual({
      name: 'Table 1',
      seatCount: 4,
    });

    expect(result).not.toHaveProperty('isActive');
  });

  it('rejects a non-boolean active status', () => {
    expect(() =>
      validateDiningTable({
        name: 'Table 1',
        seatCount: 4,
        isActive: 1,
      }),
    ).toThrow('Dining table active status must be a boolean.');
  });


});

describe('slot-table assignment validation', () => {
  it('accepts valid IDs and an empty list for clearing assignments', () => {
    expect(validateSlotTableAssignment(1, [2, 3])).toEqual({
      slotId: 1,
      tableIds: [2, 3],
    });

    expect(validateSlotTableAssignment(1, [])).toEqual({
      slotId: 1,
      tableIds: [],
    });
  });

  it('rejects invalid slot and table IDs', () => {
    expect(() => validateSlotTableAssignment(0, [2])).toThrow(
      'Meal slot ID must be a positive integer.',
    );

    expect(() => validateSlotTableAssignment(1, [2, -3])).toThrow(
      'Dining table IDs must be positive integers.',
    );
  });

  it('rejects duplicate table IDs', () => {
    expect(() => validateSlotTableAssignment(1, [2, 2])).toThrow(
      'Dining table IDs must not contain duplicates.',
    );
  });

  it('requires the table IDs to be an array', () => {
    expect(() => validateSlotTableAssignment(1, '2')).toThrow(
      'Dining table IDs must be provided as an array.',
    );
  });
});


it('rejects a meal slot missing start or end time', () => {
    expect(() =>
      validateMealSlot({
        slotDate: '2099-12-30',
        name: 'Dinner',
        endTime: '20:00',
      }),
    ).toThrow();

    expect(() =>
      validateMealSlot({
        slotDate: '2099-12-30',
        name: 'Dinner',
        startTime: '18:00',
      }),
    ).toThrow();
  });

  it('rejects a dining table missing seat count', () => {
    expect(() =>
      validateDiningTable({
        name: 'Table 1',
      }),
    ).toThrow('Dining table seat count must be a positive integer.');
  });

  it('rejects a non-boolean active status in dining table', () => {
    expect(() =>
      validateDiningTable({
        name: 'Table 1',
        seatCount: 4,
        isActive: 1,
      }),
    ).toThrow('Dining table active status must be a boolean.');
  });

  describe('meal-slot date validation', () => {
  const validInput = {
    name: 'Lunch',
    startTime: '12:00',
    endTime: '13:00',
  };

  it.each([
    undefined,
    null,
    '',
    '30/12/2099',
    '2099-02-30',
    '2099-13-01',
    '0000-01-01',
    20991230,
  ])('rejects invalid or missing slot date: %j', (slotDate) => {
    expect(() =>
      validateMealSlot({
        ...validInput,
        slotDate,
      }),
    ).toThrow(
      'A valid meal slot date in YYYY-MM-DD format is required.',
    );
  });

  it('accepts February 29 in a leap year', () => {
    expect(
      validateMealSlot({
        ...validInput,
        slotDate: '2032-02-29',
      }),
    ).toMatchObject({
      slotDate: '2032-02-29',
    });
  });

  it('rejects February 29 in a non-leap year', () => {
    expect(() =>
      validateMealSlot({
        ...validInput,
        slotDate: '2030-02-29',
      }),
    ).toThrow(
      'A valid meal slot date in YYYY-MM-DD format is required.',
    );
  });
});