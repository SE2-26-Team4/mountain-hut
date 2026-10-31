import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  class BookingError extends Error {
    constructor(code, message) {
      super(message);
      this.name = 'BookingError';
      this.code = code;
    }
  }

  return {
    BookingError,
    createBooking: vi.fn(),
    getBookingsByDateAndSlot: vi.fn(),
    getMealSlotCapacity: vi.fn(),
    getMealSlots: vi.fn(),
  };
});

vi.mock('../../dao/booking-dao.js', () => ({
  BookingError: mocks.BookingError,
  createBooking: mocks.createBooking,
  getBookingsByDateAndSlot: mocks.getBookingsByDateAndSlot,
}));

vi.mock('../../dao/capacity-dao.js', () => ({
  getMealSlotCapacity: mocks.getMealSlotCapacity,
  getMealSlots: mocks.getMealSlots,
}));

import {
  createBookingForHiker,
  getMealSlotAvailability,
} from '../../services/booking-service.js';

const testMealSlot = {
  id: 1,
  name: 'Dinner',
  startTime: '18:00',
  endTime: '20:00',
  isActive: true,
};

const testTables = [
  {
    id: 10,
    name: 'Table 10',
    seatCount: 4,
    isActive: true,
  },
  {
    id: 11,
    name: 'Table 11',
    seatCount: 2,
    isActive: false,
  },
];

function booking(overrides = {}) {
  return {
    id: 100,
    hikerId: 7,
    bookingDate: '2099-12-30',
    slotId: 1,
    partySize: 1,
    status: 'confirmed',
    allocations: [{ tableId: 10, seatsReserved: 1 }],
    ...overrides,
  };
}

beforeEach(() => {
  vi.resetAllMocks();

  mocks.getMealSlots.mockResolvedValue([{ ...testMealSlot }]);

  mocks.getMealSlotCapacity.mockResolvedValue({
    slotId: testMealSlot.id,
    slotName: testMealSlot.name,
    tables: testTables.map((table) => ({ ...table })),
    totalSeatCapacity: 4,
  });

  mocks.getBookingsByDateAndSlot.mockResolvedValue([]);
});

describe('booking availability', () => {
  it('makes empty active tables available', async () => {
    const availability = await getMealSlotAvailability(
      '2099-12-30',
      1
    );

    expect(availability).toMatchObject({
      bookingDate: '2099-12-30',
      slotId: 1,
      slotName: 'Dinner',
      startTime: '18:00',
      endTime: '20:00',
      totalAvailableSeats: 4,
      tables: [
        { id: 10, reservedSeats: 0, availableSeats: 4 },
        { id: 11, reservedSeats: 0, availableSeats: 0 },
      ],
    });
  });

  it('makes an occupied table completely unavailable', async () => {
    mocks.getBookingsByDateAndSlot.mockResolvedValue([
      booking(),
    ]);

    const availability = await getMealSlotAvailability(
      '2099-12-30',
      1
    );

    expect(availability).toMatchObject({
      totalAvailableSeats: 0,
      tables: [
        { id: 10, reservedSeats: 1, availableSeats: 0 },
        { id: 11, reservedSeats: 0, availableSeats: 0 },
      ],
    });

    expect(mocks.getBookingsByDateAndSlot).toHaveBeenCalledWith(
      '2099-12-30',
      1
    );
  });

  it('does not count unused seats of an occupied table', async () => {
    mocks.getMealSlotCapacity.mockResolvedValue({
      slotId: 1,
      slotName: 'Dinner',
      tables: [
        { id: 10, name: 'A', seatCount: 3, isActive: true },
        { id: 11, name: 'B', seatCount: 6, isActive: true },
      ],
      totalSeatCapacity: 9,
    });

    mocks.getBookingsByDateAndSlot.mockResolvedValue([
      booking({
        partySize: 3,
        allocations: [{ tableId: 11, seatsReserved: 3 }],
      }),
    ]);

    const availability = await getMealSlotAvailability(
      '2099-12-30',
      1
    );

    expect(availability).toMatchObject({
      totalAvailableSeats: 3,
      tables: [
        { id: 10, reservedSeats: 0, availableSeats: 3 },
        { id: 11, reservedSeats: 3, availableSeats: 0 },
      ],
    });
  });

  it('ignores cancelled bookings', async () => {
    mocks.getBookingsByDateAndSlot.mockResolvedValue([
      booking({ status: 'cancelled' }),
    ]);

    const availability = await getMealSlotAvailability(
      '2099-12-30',
      1
    );

    expect(availability).toMatchObject({
      totalAvailableSeats: 4,
      tables: [
        { id: 10, reservedSeats: 0, availableSeats: 4 },
        { id: 11, reservedSeats: 0, availableSeats: 0 },
      ],
    });
  });

  it('handles an empty allocations array', async () => {
    mocks.getBookingsByDateAndSlot.mockResolvedValue([
      booking({ allocations: [] }),
    ]);

    const availability = await getMealSlotAvailability(
      '2099-12-30',
      1
    );

    expect(availability?.totalAvailableSeats).toBe(4);
  });

  it('returns null for a missing slot', async () => {
    mocks.getMealSlots.mockResolvedValue([]);

    await expect(
      getMealSlotAvailability('2099-12-30', 999)
    ).resolves.toBeNull();

    expect(mocks.getMealSlotCapacity).not.toHaveBeenCalled();
    expect(mocks.getBookingsByDateAndSlot).not.toHaveBeenCalled();
  });

  it('returns null for an inactive slot', async () => {
    mocks.getMealSlots.mockResolvedValue([
      { ...testMealSlot, isActive: false },
    ]);

    await expect(
      getMealSlotAvailability('2099-12-30', 1)
    ).resolves.toBeNull();

    expect(mocks.getBookingsByDateAndSlot).not.toHaveBeenCalled();
  });

  it('returns null when slot capacity is missing', async () => {
    mocks.getMealSlotCapacity.mockResolvedValue(null);

    await expect(
      getMealSlotAvailability('2099-12-30', 1)
    ).resolves.toBeNull();

    expect(mocks.getBookingsByDateAndSlot).not.toHaveBeenCalled();
  });

  it.each([
    ['2099-02-30', 1],
    ['30-12-2099', 1],
    ['2099-12-30', 0],
    ['2099-12-30', '1'],
    ['2099-12-30', 1.5],
  ])('rejects invalid date/slot: %s, %s', async (date, slotId) => {
    await expect(
      getMealSlotAvailability(date, slotId)
    ).rejects.toMatchObject({ code: 'INVALID_BOOKING' });

    expect(mocks.getMealSlots).not.toHaveBeenCalled();
    expect(mocks.getBookingsByDateAndSlot).not.toHaveBeenCalled();
  });
});

describe('booking creation', () => {
  const input = {
    hikerId: 7,
    bookingDate: '2099-12-30',
    slotId: 1,
    partySize: 3,
  };

  it('delegates valid creation to the DAO', async () => {
    const savedBooking = booking({
      ...input,
      allocations: [{ tableId: 10, seatsReserved: 3 }],
    });

    mocks.createBooking.mockResolvedValue(savedBooking);

    await expect(
      createBookingForHiker(input)
    ).resolves.toEqual(savedBooking);

    expect(mocks.createBooking).toHaveBeenCalledTimes(1);
    expect(mocks.createBooking).toHaveBeenCalledWith(input);

    // Creation must use the DAO's atomic availability check.
    expect(mocks.getMealSlots).not.toHaveBeenCalled();
    expect(mocks.getMealSlotCapacity).not.toHaveBeenCalled();
    expect(mocks.getBookingsByDateAndSlot).not.toHaveBeenCalled();
  });

  it.each([
    ['impossible date', { bookingDate: '2099-02-30' }, 'INVALID_BOOKING'],
    ['invalid slot', { slotId: 0 }, 'INVALID_BOOKING'],
    ['string slot', { slotId: '1' }, 'INVALID_BOOKING'],
    ['invalid hiker', { hikerId: 0 }, 'INVALID_BOOKING'],
    ['zero party size', { partySize: 0 }, 'INVALID_PARTY_SIZE'],
    ['negative party size', { partySize: -1 }, 'INVALID_PARTY_SIZE'],
    ['fractional party size', { partySize: 2.5 }, 'INVALID_PARTY_SIZE'],
    ['string party size', { partySize: '3' }, 'INVALID_PARTY_SIZE'],
  ])('rejects %s', async (_label, changes, code) => {
    await expect(
      createBookingForHiker({ ...input, ...changes })
    ).rejects.toMatchObject({ code });

    expect(mocks.createBooking).not.toHaveBeenCalled();
  });

  it('propagates availability errors from the DAO', async () => {
    const error = new mocks.BookingError(
      'NO_AVAILABILITY',
      'There are not enough available seats.'
    );

    mocks.createBooking.mockRejectedValue(error);

    await expect(
      createBookingForHiker(input)
    ).rejects.toBe(error);
  });

  it('propagates unexpected DAO errors', async () => {
    const error = new Error('Unexpected database failure');
    mocks.createBooking.mockRejectedValue(error);

    await expect(
      createBookingForHiker(input)
    ).rejects.toBe(error);
  });
});