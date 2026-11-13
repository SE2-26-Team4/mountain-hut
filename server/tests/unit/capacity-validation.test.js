import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  validateDiningTable,
  validateMealSlot,
  validateSlotTableAssignment,
  validateWeeklyScheduleCopy,
} from '../../services/capacity-validation.js';

describe('meal-slot validation', () => {
  // Valid meal-slot data must preserve its values and trim the name.
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

  // Whitespace-only names must be rejected.
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

  // Times must use the HH:mm format with valid hour and minute values.
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

  // A meal service must end after its start time.
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

  // Explicit active status values must be booleans.
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

  // Input must be a non-null object and must not be an array.
  it.each([null, undefined, 'Dinner', 1, []])(
    'rejects non-object input: %j',
    (input) => {
      expect(() => validateMealSlot(input)).toThrow(
        'Meal slot data must be an object.',
      );
    },
  );

  // Meal-slot names must be strings.
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

  // Numeric start times must not be accepted as formatted time strings.
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

  // End times outside the valid daily range must be rejected.
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

  // Omitting active status must leave it absent from the validated result.
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
  // Valid table data must preserve its values and trim the name.
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

  // Whitespace-only table names must be rejected.
  it('rejects an empty name', () => {
    expect(() =>
      validateDiningTable({
        name: '  ',
        seatCount: 4,
      }),
    ).toThrow('Dining table name is required.');
  });

  // Seat counts must be positive integers.
  it('rejects zero, negative, and non-integer seat counts', () => {
    for (const seatCount of [0, -1, 2.5]) {
      expect(() =>
        validateDiningTable({
          name: 'Table 1',
          seatCount,
        }),
      ).toThrow('Dining table seat count must be a positive integer.');
    }
  });

  // Dining-table names must be strings.
  it('rejects a non-string name', () => {
    expect(() =>
      validateDiningTable({
        name: 123,
        seatCount: 4,
      }),
    ).toThrow('Dining table name is required.');
  });

  // Omitting active status must leave it absent from the validated result.
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

  // Explicit active status values must be booleans.
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
  // Valid assignments and empty lists for clearing assignments must be accepted.
  it('accepts valid IDs and an empty list for clearing assignments', () => {
    expect(
      validateSlotTableAssignment(1, [2, 3]),
    ).toEqual({
      slotId: 1,
      tableIds: [2, 3],
    });

    expect(
      validateSlotTableAssignment(1, []),
    ).toEqual({
      slotId: 1,
      tableIds: [],
    });
  });

  describe('weekly schedule copy validation', () => {
    it('accepts two distinct valid week start dates', () => {
      expect(
        validateWeeklyScheduleCopy({
          sourceWeekStart: '2099-12-27',
          destinationWeekStart: '2100-01-03',
        }),
      ).toEqual({
        sourceWeekStart: '2099-12-27',
        destinationWeekStart: '2100-01-03',
      });
    });

    it('rejects invalid or identical week start dates', () => {
      expect(() =>
        validateWeeklyScheduleCopy({
          sourceWeekStart: '2099-02-30',
          destinationWeekStart: '2099-03-06',
        }),
      ).toThrow(
        'A valid source week start date in YYYY-MM-DD format is required.',
      );

      expect(() =>
        validateWeeklyScheduleCopy({
          sourceWeekStart: '2099-03-06',
          destinationWeekStart: '2099-02-30',
        }),
      ).toThrow(
        'A valid destination week start date in YYYY-MM-DD format is required.',
      );

      expect(() =>
        validateWeeklyScheduleCopy({
          sourceWeekStart: '2099-03-06',
          destinationWeekStart: '2099-03-06',
        }),
      ).toThrow('The source and destination weeks must be different.');
    });

    // Overlapping weeks would let the copy delete slots of the source week.
    it('rejects week start dates less than 7 days apart', () => {
      for (const [sourceWeekStart, destinationWeekStart] of [
        ['2099-03-02', '2099-03-03'],
        ['2099-03-02', '2099-03-08'],
        ['2099-03-08', '2099-03-02'],
        ['2099-12-29', '2100-01-02'],
      ]) {
        expect(() =>
          validateWeeklyScheduleCopy({
            sourceWeekStart,
            destinationWeekStart,
          }),
        ).toThrow(
          'The source and destination week start dates must be at least 7 days apart.',
        );
      }
    });

    it('accepts week start dates exactly 7 days apart in either order', () => {
      expect(
        validateWeeklyScheduleCopy({
          sourceWeekStart: '2099-03-09',
          destinationWeekStart: '2099-03-02',
        }),
      ).toEqual({
        sourceWeekStart: '2099-03-09',
        destinationWeekStart: '2099-03-02',
      });
    });
  });

  // Slot IDs and every requested table ID must be positive integers.
  it('rejects invalid slot and table IDs', () => {
    expect(() =>
      validateSlotTableAssignment(0, [2]),
    ).toThrow('Meal slot ID must be a positive integer.');

    expect(() =>
      validateSlotTableAssignment(1, [2, -3]),
    ).toThrow('Dining table IDs must be positive integers.');
  });

  // Each table ID must appear only once in an assignment.
  it('rejects duplicate table IDs', () => {
    expect(() =>
      validateSlotTableAssignment(1, [2, 2]),
    ).toThrow('Dining table IDs must not contain duplicates.');
  });

  // Table IDs must be provided as an array.
  it('requires the table IDs to be an array', () => {
    expect(() =>
      validateSlotTableAssignment(1, '2'),
    ).toThrow('Dining table IDs must be provided as an array.');
  });
});

// Both service times are required for a valid meal slot.
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

// A dining table must explicitly provide its seat count.
it('rejects a dining table missing seat count', () => {
  expect(() =>
    validateDiningTable({
      name: 'Table 1',
    }),
  ).toThrow('Dining table seat count must be a positive integer.');
});

// Verify boolean active-status validation in the original standalone test.
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
  // Reuse valid service details while varying the slot date.
  const validInput = {
    name: 'Lunch',
    startTime: '12:00',
    endTime: '13:00',
  };

  // Dates must be present, correctly formatted, and valid calendar dates.
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

  // February 29 must be accepted in leap years.
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

  // February 29 must be rejected in non-leap years.
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