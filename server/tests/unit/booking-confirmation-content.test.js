import { describe, expect, it } from 'vitest';

import { buildBookingConfirmationEmail } from '../../services/booking-confirmation-content.js';

function createInput() {
  return {
    hiker: { full_name: 'Mario Rossi', email: 'mario.rossi@example.com' },
    booking: {
      id: 42,
      hikerId: 7,
      bookingDate: '2026-11-05',
      slotId: 1,
      partySize: 5,
      status: /** @type {const} */ ('confirmed'),
      allocations: [
        { tableId: 1, seatsReserved: 4 },
        { tableId: 3, seatsReserved: 1 },
      ],
    },
    mealSlot: { name: 'Lunch', startTime: '12:00', endTime: '14:00' },
    tables: [{ id: 1, name: 'Table 1' }],
  };
}

describe('booking confirmation email content', () => {
  it('addresses the hiker and contains the booking details', () => {
    const email = buildBookingConfirmationEmail(createInput());

    expect(email.to).toBe('mario.rossi@example.com');
    expect(email.subject).toBe(
      'Booking confirmed #42 - Lunch, Thursday 5 November 2026'
    );
    expect(email.text).toContain('Booking reference: #42');
    expect(email.text).toContain('Name: Mario Rossi');
    expect(email.text).toContain('Date: Thursday 5 November 2026');
    expect(email.text).toContain('Meal service: Lunch, 12:00-14:00');
    expect(email.text).toContain('Party size: 5');
    expect(email.text).toContain('- Table 1: 4 seats');
    expect(email.text).toContain('- Table #3: 1 seat');
    expect(email.text).not.toContain('Party requirements');
  });

  it('lists party requirements and marks allergies', () => {
    const email = buildBookingConfirmationEmail({
      ...createInput(),
      requirements: [
        { hasAllergies: true, description: '1 vegan, peanut allergy' },
        { hasAllergies: false, description: '2 vegetarians' },
      ],
    });

    expect(email.text).toContain('Party requirements:');
    expect(email.text).toContain('- [ALLERGIES] 1 vegan, peanut allergy');
    expect(email.text).toContain('- 2 vegetarians');
  });

  it('rejects missing recipient or booking data', () => {
    const input = createInput();

    expect(() =>
      buildBookingConfirmationEmail({
        ...input,
        hiker: { ...input.hiker, email: ' ' },
      })
    ).toThrow('Hiker name and email are required.');

    expect(() =>
      buildBookingConfirmationEmail({
        ...input,
        booking: { ...input.booking, allocations: [] },
      })
    ).toThrow(
      'Booking ID, date, party size, and table allocations are required.'
    );

    expect(() =>
      buildBookingConfirmationEmail({
        ...input,
        mealSlot: { ...input.mealSlot, startTime: '' },
      })
    ).toThrow('Meal service name and times are required.');
  });
});
