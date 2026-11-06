import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

// Keep DAO and service mocks available to the hoisted module factories.
const mocks = vi.hoisted(() => ({
  cancelBooking: vi.fn(),
  getBookingById: vi.fn(),
  getBookingsByHiker: vi.fn(),
  createBookingForHiker: vi.fn(),
  getMealSlotAvailability: vi.fn(),
}));

// Preserve the DAO's original exports while replacing booking operations.
vi.mock('../../dao/booking-dao.js', async (importOriginal) => ({
  ...await importOriginal(),
  cancelBooking: mocks.cancelBooking,
  getBookingById: mocks.getBookingById,
  getBookingsByHiker: mocks.getBookingsByHiker,
}));

// Replace booking service operations used by the route handlers.
vi.mock('../../services/booking-service.js', () => ({
  createBookingForHiker: mocks.createBookingForHiker,
  getMealSlotAvailability: mocks.getMealSlotAvailability,
}));

import router from '../../routes/booking-routes.js';
import { BookingError } from '../../dao/booking-dao.js';

// Reset mock implementations and call history before each test.
beforeEach(() => vi.resetAllMocks());

/**
 * Invokes a route's final handler directly to exercise defensive checks.
 * Existing integration tests verify authentication through HTTP.
 */
async function invoke(method, path, properties) {
  const layer = router.stack.find((item) =>
    item.route?.path === path && item.route.methods[method],
  );

  const handler = layer.route.stack.at(-1).handle;

  // Support chained response calls and track forwarded errors.
  const res = {
    status: vi.fn(),
    json: vi.fn(),
  };

  res.status.mockReturnValue(res);
  res.json.mockReturnValue(res);

  const next = vi.fn();

  handler(
    { params: {}, query: {}, ...properties },
    res,
    next,
  );

  // Wait until the handler sends a JSON response or calls the next middleware.
  await vi.waitFor(() => {
    expect(
      res.json.mock.calls.length + next.mock.calls.length,
    ).toBe(1);
  });

  return { res, next };
}

describe('booking route defensive cases', () => {
  // Protected handlers must reject missing users before calling booking operations.
  it.each([
    ['get', '/bookings'],
    ['post', '/bookings'],
    ['delete', '/bookings/:id'],
  ])(
    'requires a user in the %s %s handler',
    async (method, path) => {
      const { res } = await invoke(method, path, {
        params: { id: '1' },
      });

      expect(res.status).toHaveBeenCalledWith(401);

      expect(res.json).toHaveBeenCalledWith({
        error: {
          code: 'UNAUTHENTICATED',
          message: 'Login is required.',
        },
      });

      expect(mocks.createBookingForHiker).not.toHaveBeenCalled();
      expect(mocks.cancelBooking).not.toHaveBeenCalled();
      expect(mocks.getBookingsByHiker).not.toHaveBeenCalled();
    },
  );

  // Cancellation IDs must be valid strings representing positive safe integers.
  it.each([
    undefined,
    1,
    'abc',
    '0',
    '9007199254740992',
  ])('rejects invalid cancellation ID %s', async (id) => {
    const { res } = await invoke('delete', '/bookings/:id', {
      user: { id: 7 },
      params: { id },
    });

    expect(res.status).toHaveBeenCalledWith(400);

    expect(res.json).toHaveBeenCalledWith({
      error: {
        code: 'INVALID_BOOKING',
        message: 'A valid booking ID is required.',
      },
    });

    expect(mocks.cancelBooking).not.toHaveBeenCalled();
  });

  // Missing or unowned bookings must return 404 without fetching booking details.
  it('returns 404 when cancellation finds no owned booking', async () => {
    mocks.cancelBooking.mockResolvedValue(false);

    const { res } = await invoke('delete', '/bookings/:id', {
      user: { id: 7 },
      params: { id: '42' },
    });

    expect(mocks.cancelBooking).toHaveBeenCalledWith(42, 7);
    expect(res.status).toHaveBeenCalledWith(404);

    expect(res.json).toHaveBeenCalledWith({
      error: {
        code: 'BOOKING_NOT_FOUND',
        message: 'The requested booking was not found.',
      },
    });

    expect(mocks.getBookingById).not.toHaveBeenCalled();
  });

  // A missing request body must reach service validation without crashing the handler.
  it('handles a missing body and forwards the validation error', async () => {
    const failure = new BookingError(
      'INVALID_BOOKING',
      'Missing booking data',
    );

    mocks.createBookingForHiker.mockRejectedValue(failure);

    const { next } = await invoke('post', '/bookings', {
      user: { id: 7 },
    });

    expect(mocks.createBookingForHiker).toHaveBeenCalledWith({
      hikerId: 7,
      bookingDate: undefined,
      slotId: undefined,
      partySize: undefined,
    });

    expect(next).toHaveBeenCalledWith(failure);
  });

  // Errors after headers are sent must be forwarded without another response.
  it('forwards errors after headers were sent without sending another response', () => {
    const handler = router.stack.find((layer) =>
      !layer.route && layer.handle.length === 4,
    ).handle;

    const error = new Error('Connection interrupted');

    const res = {
      headersSent: true,
      status: vi.fn(),
      json: vi.fn(),
    };

    const next = vi.fn();

    handler(error, {}, res, next);

    expect(next).toHaveBeenCalledExactlyOnceWith(error);
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });
});