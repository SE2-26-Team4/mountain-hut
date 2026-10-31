import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getBookingsByDateAndSlot: vi.fn(),
  getMealSlotCapacity: vi.fn(),
  getMealSlots: vi.fn(),
}));

vi.mock('../../dao/booking-dao.js', () => ({
  getBookingsByDateAndSlot: mocks.getBookingsByDateAndSlot,
}));

vi.mock('../../dao/capacity-dao.js', () => ({
  getMealSlotCapacity: mocks.getMealSlotCapacity,
  getMealSlots: mocks.getMealSlots,
}));

import {
  allocateTablesForParty,
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

beforeEach(() => {
  vi.resetAllMocks();

  mocks.getMealSlots.mockResolvedValue([testMealSlot]);

  mocks.getMealSlotCapacity.mockResolvedValue({
    slotId: testMealSlot.id,
    slotName: testMealSlot.name,
    tables: testTables,
    totalSeatCapacity: 4,
  });

  mocks.getBookingsByDateAndSlot.mockResolvedValue([]);
});

describe('booking availability', () => {
  it('makes all seats of empty active tables available', async () => {
    const availability = await getMealSlotAvailability(
      '2099-12-30',
      testMealSlot.id,
    );

    expect(availability).toMatchObject({
      totalAvailableSeats: 4,
      tables: [
        {
          id: 10,
          reservedSeats: 0,
          availableSeats: 4,
        },
        {
          id: 11,
          reservedSeats: 0,
          availableSeats: 0,
        },
      ],
    });
  });

  it('excludes occupied and inactive tables from availability', async () => {
    mocks.getBookingsByDateAndSlot.mockResolvedValue([
      {
        allocations: [{ tableId: 10, seatsReserved: 1 }],
      },
    ]);

    const availability = await getMealSlotAvailability(
      '2099-12-30',
      testMealSlot.id,
    );

    expect(availability).toMatchObject({
      bookingDate: '2099-12-30',
      slotId: testMealSlot.id,
      slotName: 'Dinner',
      totalAvailableSeats: 0,
      tables: [
        {
          id: 10,
          reservedSeats: 1,
          availableSeats: 0,
        },
        {
          id: 11,
          reservedSeats: 0,
          availableSeats: 0,
        },
      ],
    });

    expect(mocks.getBookingsByDateAndSlot).toHaveBeenCalledWith(
      '2099-12-30',
      testMealSlot.id,
    );
  });

  it('does not split a party across an empty and an occupied table', async () => {
    mocks.getMealSlotCapacity.mockResolvedValue({
      slotId: testMealSlot.id,
      slotName: testMealSlot.name,
      tables: [
        {
          id: 10,
          name: 'Table 10',
          seatCount: 3,
          isActive: true,
        },
        {
          id: 11,
          name: 'Table 11',
          seatCount: 6,
          isActive: true,
        },
      ],
      totalSeatCapacity: 9,
    });

    mocks.getBookingsByDateAndSlot.mockResolvedValue([
      {
        allocations: [{ tableId: 11, seatsReserved: 3 }],
      },
    ]);

    const availability = await getMealSlotAvailability(
      '2099-12-30',
      testMealSlot.id,
    );

    expect(availability).not.toBeNull();

    if (!availability) {
      throw new Error('Expected availability for the active meal slot.');
    }

    expect(availability).toMatchObject({
      totalAvailableSeats: 3,
      tables: [
        {
          id: 10,
          reservedSeats: 0,
          availableSeats: 3,
        },
        {
          id: 11,
          reservedSeats: 3,
          availableSeats: 0,
        },
      ],
    });

    const allocations = allocateTablesForParty(
      5,
      availability.tables,
    );

    expect(allocations).toBeNull();
  });

  it('returns null when the meal slot does not exist', async () => {
    mocks.getMealSlots.mockResolvedValue([]);

    await expect(
      getMealSlotAvailability('2099-12-30', 999),
    ).resolves.toBeNull();

    expect(mocks.getBookingsByDateAndSlot).not.toHaveBeenCalled();
  });

  it('returns null when the meal slot is inactive', async () => {
    mocks.getMealSlots.mockResolvedValue([
      { ...testMealSlot, isActive: false },
    ]);

    await expect(
      getMealSlotAvailability('2099-12-30', testMealSlot.id),
    ).resolves.toBeNull();

    expect(mocks.getBookingsByDateAndSlot).not.toHaveBeenCalled();
  });

  it('returns null when meal-slot capacity is missing', async () => {
    mocks.getMealSlotCapacity.mockResolvedValue(null);

    await expect(
      getMealSlotAvailability('2099-12-30', testMealSlot.id),
    ).resolves.toBeNull();

    expect(mocks.getBookingsByDateAndSlot).not.toHaveBeenCalled();
  });

  it('handles bookings without allocations', async () => {
    mocks.getBookingsByDateAndSlot.mockResolvedValue([
      {},
    ]);

    const availability = await getMealSlotAvailability(
      '2099-12-30',
      testMealSlot.id,
    );

    expect(availability).toMatchObject({
      totalAvailableSeats: 4,
      tables: [
        {
          id: 10,
          reservedSeats: 0,
          availableSeats: 4,
        },
        {
          id: 11,
          reservedSeats: 0,
          availableSeats: 0,
        },
      ],
    });
  });
});

describe('table allocation', () => {
  it('assigns a party to one table when that table has enough available seats', () => {
    const allocations = allocateTablesForParty(3, [
      { id: 10, isActive: true, availableSeats: 4 },
      { id: 11, isActive: true, availableSeats: 2 },
    ]);

    expect(allocations).toEqual([
      { tableId: 10, seatsReserved: 3 },
    ]);
  });

  it('splits a party across tables when one table is not large enough', () => {
    const allocations = allocateTablesForParty(5, [
      { id: 10, isActive: true, availableSeats: 3 },
      { id: 11, isActive: true, availableSeats: 2 },
      { id: 12, isActive: true, availableSeats: 1 },
    ]);

    expect(allocations).toEqual([
      { tableId: 10, seatsReserved: 3 },
      { tableId: 11, seatsReserved: 2 },
    ]);
  });

  it('ignores inactive tables and tables with no available seats', () => {
    const allocations = allocateTablesForParty(2, [
      { id: 10, isActive: false, availableSeats: 6 },
      { id: 11, isActive: true, availableSeats: 0 },
      { id: 12, isActive: true, availableSeats: 2 },
    ]);

    expect(allocations).toEqual([
      { tableId: 12, seatsReserved: 2 },
    ]);
  });

  it('returns null when the available seats cannot fit the party', () => {
    const allocations = allocateTablesForParty(5, [
      { id: 10, isActive: true, availableSeats: 3 },
      { id: 11, isActive: true, availableSeats: 1 },
    ]);

    expect(allocations).toBeNull();
  });

  it('rejects a party size that is not a positive integer', () => {
    expect(() => allocateTablesForParty(0, [])).toThrow(
      'Party size must be a positive integer.',
    );
  });

  it('rejects availableTables when it is not an array', () => {
  expect(() => allocateTablesForParty(2, null)).toThrow(
    'Available tables must be provided as an array.',
  );
});

it('uses the lowest table ID when available seats are equal', () => {
    const allocations = allocateTablesForParty(2, [
      { id: 20, isActive: true, availableSeats: 4 },
      { id: 10, isActive: true, availableSeats: 4 },
    ]);

    expect(allocations).toEqual([
      { tableId: 10, seatsReserved: 2 },
    ]);
  });
});