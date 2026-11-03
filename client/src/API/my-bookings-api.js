/**
 * @typedef {import('../models/models.js').BookingDTO} BookingDTO
 */

const API_URL = (
  import.meta.env.VITE_API_BASE_URL ?? '/api'
).replace(/\/$/, '');

/**
 * @param {AbortSignal} [signal]
 * @returns {Promise<BookingDTO[]>}
 */
export async function getMyBookings(signal) {
  const response = await fetch(`${API_URL}/bookings/mine`, {
    credentials: 'include',
    signal,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      response.status === 401
        ? 'Your session has expired. Please sign in again.'
        : data?.error?.message ?? 'Could not load your bookings.',
    );
  }

  return data.bookings;
}