import {
  beforeEach,
  expect,
  it,
  vi,
} from 'vitest';

// Keep database mocks available to the hoisted module factory.
const db = vi.hoisted(() => ({
  withTransaction: vi.fn(),
  getAsync: vi.fn(),
  runAsync: vi.fn(),
  allAsync: vi.fn(),
}));

// Replace transaction handling so the booking DAO uses the mocked queries.
vi.mock('../../db.js', () => ({
  withTransaction: db.withTransaction,
}));

import { createBooking } from '../../dao/booking-dao.js';

// Reset mocks and execute transaction callbacks with the mocked database.
beforeEach(() => {
  vi.resetAllMocks();

  db.withTransaction.mockImplementation(
    (callback) => callback(db),
  );
});

// Invalid stored meal times must be rejected before any booking is persisted.
it('rejects an invalid stored meal time before persisting a booking', async () => {
  db.getAsync.mockResolvedValue({
    id: 1,
    slotDate: '2099-12-30',
    startTime: 'invalid',
    isActive: true,
  });

  await expect(
    createBooking({
      hikerId: 7,
      bookingDate: '2099-12-30',
      slotId: 1,
      partySize: 2,
    }),
  ).rejects.toMatchObject({
    code: 'INVALID_BOOKING',
    message: 'The selected meal time is not valid in the hut time zone.',
  });

  // Validation must stop after reading the slot, without writes or further queries.
  expect(db.getAsync).toHaveBeenCalledTimes(1);
  expect(db.runAsync).not.toHaveBeenCalled();
  expect(db.allAsync).not.toHaveBeenCalled();
});