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
} from '../../dao/capacity-dao.js';

beforeEach(() => {
  vi.resetAllMocks();

  mocks.runAsync.mockResolvedValue({ lastID: 1 });
  mocks.getAsync.mockResolvedValue(undefined);
});

describe('capacity DAO missing records after insertion', () => {
  it('returns null when the inserted meal slot cannot be read', async () => {
    const result = await createMealSlot({
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