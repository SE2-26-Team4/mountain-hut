import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

// Keep database mocks available to the hoisted module factory.
const mocks = vi.hoisted(() => ({
  runAsync: vi.fn(),
  getAsync: vi.fn(),
  allAsync: vi.fn(),
  withTransaction: vi.fn(),
}));

// Replace database queries and transaction handling with controlled mocks.
vi.mock('../../db.js', () => ({
  runAsync: mocks.runAsync,
  getAsync: mocks.getAsync,
  allAsync: mocks.allAsync,
  withTransaction: mocks.withTransaction,
}));

import {
  createMealSlot,
  createDiningTable,
  DuplicateNameError,
  DuplicateMealSlotError,
} from '../../dao/capacity-dao.js';

// Reset mocks and simulate a successful insert followed by a missing record.
beforeEach(() => {
  vi.resetAllMocks();

  mocks.runAsync.mockResolvedValue({ lastID: 1 });
  mocks.getAsync.mockResolvedValue(undefined);

  // Execute transaction callbacks with the mocked query helpers.
  mocks.withTransaction.mockImplementation(async (callback) =>
    callback({
      runAsync: mocks.runAsync,
      getAsync: mocks.getAsync,
      allAsync: mocks.allAsync,
    }),
  );
});

describe('capacity DAO missing records after insertion', () => {
  // A meal slot that cannot be read after insertion must return null.
  it('returns null when the inserted meal slot cannot be read', async () => {
    const result = await createMealSlot({
      slotDate: '2099-12-30',
      name: 'Dinner',
      startTime: '18:00',
      endTime: '20:00',
    });

    expect(result).toBeNull();

    // Verify that the read uses the ID returned by the insert.
    expect(mocks.getAsync).toHaveBeenCalledWith(
      expect.stringContaining('FROM meal_slots'),
      [1],
    );
  });

  // A dining table that cannot be read after insertion must return null.
  it('returns null when the inserted dining table cannot be read', async () => {
    const result = await createDiningTable({
      name: 'Table 1',
      seatCount: 4,
    });

    expect(result).toBeNull();

    // Verify that the read uses the ID returned by the insert.
    expect(mocks.getAsync).toHaveBeenCalledWith(
      expect.stringContaining('FROM dining_tables'),
      [1],
    );
  });
});

describe('capacity DAO duplicate names', () => {
  // An existing meal slot with matching date, name, and times must prevent insertion.
  it('does not insert a meal slot with the same name and times', async () => {
    mocks.getAsync.mockResolvedValueOnce({ id: 7 });

    await expect(
      createMealSlot({
        slotDate: '2099-12-30',
        name: 'Dinner',
        startTime: '18:00',
        endTime: '20:00',
      }),
    ).rejects.toBeInstanceOf(DuplicateMealSlotError);

    // The duplicate lookup must compare names without regard to letter case.
    expect(mocks.getAsync).toHaveBeenCalledWith(
      expect.stringContaining('COLLATE NOCASE'),
      ['2099-12-30', 'Dinner', '18:00', '20:00', 0],
    );

    expect(mocks.runAsync).not.toHaveBeenCalled();
  });

  // An existing dining-table name must prevent insertion.
  it('does not insert a dining table whose name is already used', async () => {
    mocks.getAsync.mockResolvedValueOnce({ id: 3 });

    await expect(
      createDiningTable({
        name: 'Table 1',
        seatCount: 4,
      }),
    ).rejects.toThrow(
      'A dining table named "Table 1" already exists.',
    );

    expect(mocks.runAsync).not.toHaveBeenCalled();
  });
});