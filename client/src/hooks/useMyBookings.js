import { useEffect, useState } from 'react';

import {
  MyBookingsApiError,
  cancelMyBooking,
  getMyBookings,
} from '../API/my-bookings-api.js';

/**
 * Booking data returned by the server.
 *
 * @typedef {import('../models/models.js').BookingDTO} BookingDTO
 */

/**
 * Loads the authenticated hiker's bookings and provides retry and
 * cancellation actions.
 *
 * @param {number | undefined} hikerId
 */
export default function useMyBookings(hikerId) {
  // Store the bookings returned by the latest successful request.
  const [bookings, setBookings] = useState(
    /** @type {BookingDTO[]} */ ([]),
  );

  // Track loading, request errors, and reload requests.
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [attempt, setAttempt] = useState(0);

  // Load bookings when the hiker changes or a reload is requested.
  useEffect(() => {
    // Wait until a hiker ID is available before sending a request.
    if (hikerId === undefined) return;

    // Allow the request to be cancelled when the effect is cleaned up.
    const controller = new AbortController();

    getMyBookings(controller.signal)
      .then((items) => {
        // Ignore results from a cancelled request.
        if (!controller.signal.aborted) {
          setBookings(items);
        }
      })
      .catch((error) => {
        // Report request failures, but ignore cancellation errors.
        if (!controller.signal.aborted) {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : 'Could not load your bookings.',
          );
        }
      })
      .finally(() => {
        // Only the active request can clear the loading state.
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      });

    // Cancel the request on unmount or before the effect runs again.
    return () => controller.abort();
  }, [hikerId, attempt]);

  // Reload in the background, keeping the current list on screen.
  const refresh = () => {
    setAttempt((current) => current + 1);
  };

  // Clear the error and trigger another request through the effect.
  const retry = () => {
    setErrorMessage('');
    setIsLoading(true);
    refresh();
  };

  /**
   * Cancels a booking, then reloads the list from the server.
   *
   * @param {number} bookingId
   * @returns {Promise<BookingDTO>}
   */
  const cancelBooking = async (bookingId) => {
    try {
      const cancelled = await cancelMyBooking(bookingId);

      // Show the new status at once; the reload confirms it.
      setBookings((current) =>
        current.map((booking) =>
          booking.id === cancelled.id ? cancelled : booking,
        ),
      );

      refresh();

      return cancelled;
    } catch (error) {
      // A 404 means the list is stale, for example after a cancellation
      // made in another tab, so reload it to show the real status.
      if (
        error instanceof MyBookingsApiError &&
        error.status === 404
      ) {
        refresh();
      }

      throw error;
    }
  };

  // Expose bookings, request status, and actions to components.
  return {
    bookings,
    isLoading,
    errorMessage,
    retry,
    cancelBooking,
  };
}
