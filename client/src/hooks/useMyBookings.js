import { useEffect, useState } from 'react';

import { getMyBookings } from '../API/my-bookings-api.js';

/**
 * Booking data returned by the server.
 *
 * @typedef {import('../models/models.js').BookingDTO} BookingDTO
 */

/**
 * Loads the authenticated hiker's bookings and provides a retry action.
 *
 * @param {number | undefined} hikerId
 */
export default function useMyBookings(hikerId) {
  // Store the bookings returned by the latest successful request.
  const [bookings, setBookings] = useState(
    /** @type {BookingDTO[]} */ ([]),
  );

  // Track loading, request errors, and retry attempts.
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [attempt, setAttempt] = useState(0);

  // Load bookings when the hiker changes or a retry is requested.
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

  // Clear the error and trigger another request through the effect.
  const retry = () => {
    setErrorMessage('');
    setIsLoading(true);
    setAttempt((current) => current + 1);
  };

  // Expose bookings, request status, and the retry action to components.
  return {
    bookings,
    isLoading,
    errorMessage,
    retry,
  };
}