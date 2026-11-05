import { describe, expect, it } from 'vitest';

import {
  getBookingDeadline,
} from '../../services/booking-time.js';

describe('booking deadline in Europe/Rome', () => {
  it.each([
    [
      'winter time',
      '2030-01-04',
      '12:00',
      '2030-01-04T09:00:00.000Z',
    ],
    [
      'summer time',
      '2030-07-04',
      '12:00',
      '2030-07-04T08:00:00.000Z',
    ],
    [
      'deadline on the previous day',
      '2030-01-04',
      '01:00',
      '2030-01-03T22:00:00.000Z',
    ],
    [
      'day of the spring clock change',
      '2030-03-31',
      '04:00',
      '2030-03-31T00:00:00.000Z',
    ],
  ])(
    'calculates the deadline for %s',
    (_label, bookingDate, startTime, expected) => {
      const deadline = getBookingDeadline(
        bookingDate,
        startTime,
      );

      expect(new Date(deadline).toISOString()).toBe(expected);
    },
  );
});