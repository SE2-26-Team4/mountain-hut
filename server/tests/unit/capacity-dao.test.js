import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  runAsync: vi.fn(),
  getAsync: vi.fn(),
  allAsync: vi.fn(),
  withTransaction: vi.fn(),
}));

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

beforeEach(() => {
  vi.resetAllMocks();

  mocks.runAsync.mockResolvedValue({ lastID: 1 });
  mocks.getAsync.mockResolvedValue(undefined);

  // callback with the transaction's query helpers.
  mocks.withTransaction.mockImplementation(async (callback) =>
    callback({
      runAsync: mocks.runAsync,
      getAsync: mocks.getAsync,
      allAsync: mocks.allAsync,
    })
  );
});

describe('capacity DAO missing records after insertion', () => {
  it('returns null when the inserted meal slot cannot be read', async () => {
    const result = await createMealSlot({
      slotDate: '2099-12-30',
      name: 'Dinner',
      startTime: '18:00',
      endTime: '20:00',
    });

    expect(result).toBeNull();

    expect(mocks.getAsync).toHaveBeenCalledWith(
      expect.stringContaining('FROM meal_slots'),
      [1],
    );
  });

  it('returns null when the inserted dining table cannot be read', async () => {
    const result = await createDiningTable({
      name: 'Table 1',
      seatCount: 4,
    });

    expect(result).toBeNull();

    expect(mocks.getAsync).toHaveBeenCalledWith(
      expect.stringContaining('FROM dining_tables'),
      [1],
    );
  });
});

describe('capacity DAO duplicate names', () => {
  it('does not insert a meal slot with the same name and times', async () => {
    mocks.getAsync.mockResolvedValueOnce({ id: 7 });

    await expect(createMealSlot({
      slotDate: '2099-12-30',
      name: 'Dinner',
      startTime: '18:00',
      endTime: '20:00',
    })).rejects.toBeInstanceOf(DuplicateMealSlotError);

    expect(mocks.getAsync).toHaveBeenCalledWith(
      expect.stringContaining('COLLATE NOCASE'),
      ['2099-12-30', 'Dinner', '18:00', '20:00', 0],
    );

    expect(mocks.runAsync).not.toHaveBeenCalled();
  });

  it('does not insert a dining table whose name is already used', async () => {
    mocks.getAsync.mockResolvedValueOnce({ id: 3 });

    await expect(createDiningTable({
      name: 'Table 1',
      seatCount: 4,
    })).rejects.toThrow('A dining table named "Table 1" already exists.');

    expect(mocks.runAsync).not.toHaveBeenCalled();
  });
});
