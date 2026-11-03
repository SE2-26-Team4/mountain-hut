import { useEffect, useState } from 'react';

import { getMyBookings } from '../API/my-bookings-api.js';

/**
 * @typedef {import('../models/models.js').BookingDTO} BookingDTO
 */

/**
 * @param {number | undefined} hikerId
 */
export default function useMyBookings(hikerId) {
  const [bookings, setBookings] = useState(
    /** @type {BookingDTO[]} */ ([]),
  );

  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (hikerId === undefined) return;

    const controller = new AbortController();

    getMyBookings(controller.signal)
      .then((items) => {
        if (!controller.signal.aborted) {
          setBookings(items);
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : 'Could not load your bookings.',
          );
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      });

    return () => controller.abort();
  }, [hikerId, attempt]);

  const retry = () => {
    setErrorMessage('');
    setIsLoading(true);
    setAttempt((current) => current + 1);
  };

  return {
    bookings,
    isLoading,
    errorMessage,
    retry,
  };
}