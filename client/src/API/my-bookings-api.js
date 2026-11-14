/**
 * @typedef {import('../models/models.js').BookingDTO} BookingDTO
 */

const API_URL = (
  import.meta.env.VITE_API_BASE_URL ?? '/api'
).replace(/\/$/, '');

/**
 * Request failure that keeps the HTTP status for the caller.
 */
export class MyBookingsApiError extends Error {
  /**
   * @param {string} message
   * @param {number} status
   */
  constructor(message, status) {
    super(message);

    this.name = 'MyBookingsApiError';
    this.status = status;
  }
}

/**
 * @param {AbortSignal} [signal]
 * @returns {Promise<BookingDTO[]>}
 */
export async function getMyBookings(signal) {
  // The server reads the hiker from the session, so no ID is sent.
  const response = await fetch(`${API_URL}/bookings`, {
    credentials: 'include',
    signal,
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new MyBookingsApiError(
      response.status === 401
        ? 'Your session has expired. Please sign in again.'
        : data?.error?.message ?? 'Could not load your bookings.',
      response.status,
    );
  }

  return data.bookings;
}

/**
 * Cancels a booking owned by the authenticated hiker.
 *
 * @param {number} bookingId
 * @returns {Promise<BookingDTO>} The booking with its updated status.
 */
export async function cancelMyBooking(bookingId) {
  const response = await fetch(`${API_URL}/bookings/${bookingId}`, {
    method: 'DELETE',
    credentials: 'include',
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    // The server answers 404 for missing, unowned, or already cancelled
    // bookings, so the message covers all three cases.
    let message;

    switch (response.status) {
      case 401:
        message = 'Your session has expired. Please sign in again.';
        break;

      case 404:
        message =
          'This booking was not found or has already been cancelled.';
        break;

      default:
        message =
          data?.error?.message ?? 'Could not cancel your booking.';
    }

    throw new MyBookingsApiError(message, response.status);
  }

  return data.booking;
}
