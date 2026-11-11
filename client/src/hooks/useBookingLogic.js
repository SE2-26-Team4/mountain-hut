import { useEffect, useLayoutEffect, useRef, useState } from 'react';

import BookingAPI, { BookingApiError } from '../API/booking-api.js';
import {
  buildSpecialRequests,
  FOOD_ALLERGY_REQUEST,
  MAX_SPECIAL_REQUEST_LENGTH,
} from '../utils/booking-requirements.js';

/**
 * API data types used by the booking flow.
 *
 * @typedef {import('../models/models.js').MealSlotDTO} MealSlotDTO
 * @typedef {import('../models/models.js').MealSlotAvailabilityDTO} MealSlotAvailabilityDTO
 * @typedef {import('../models/models.js').CreateBookingRequestDTO} CreateBookingRequestDTO
 */

/**
 * Booking details displayed in the confirmation popup.
 *
 * @typedef {Object} ConfirmedReservation
 * @property {number} id
 * @property {string} bookingDate
 * @property {string} mealName
 * @property {string} startTime
 * @property {string} endTime
 * @property {number} partySize
 * @property {boolean} emailSent
 * @property {string} specialRequests
 */

/**
 * Returns the calendar date in the hut's time zone.
 *
 * @param {Date} date
 * @returns {string}
 */
function getLocalDateString(date) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Rome',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  /** @param {Intl.DateTimeFormatPartTypes} type */
  const value = (type) =>
    parts.find((part) => part.type === type)?.value;

  return `${value('year')}-${value('month')}-${value('day')}`;
}

/**
 * Extracts an error message or provides a fallback.
 *
 * @param {unknown} error
 * @returns {string}
 */
function getErrorMessage(error) {
  return error instanceof Error
    ? error.message
    : 'An unexpected error occurred.';
}

/**
 * Formats the time remaining before bookings close.
 *
 * @param {number} remainingMilliseconds
 * @returns {string}
 */
function formatBookingCountdown(remainingMilliseconds) {
  // Display a closed status once the deadline has passed.
  if (remainingMilliseconds < 0) {
    return 'Bookings closed';
  }

  // Round up to avoid displaying zero seconds before the deadline.
  const totalSeconds = Math.ceil(
    remainingMilliseconds / 1000
  );

  // Split the remaining time into days, hours, minutes, and seconds.
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  // Select the singular or plural label for each time unit.
  /** @param {number} value */
  const dayLabel = (value) =>
    `${value} ${value === 1 ? 'day' : 'days'}`;

  /** @param {number} value */
  const hourLabel = (value) =>
    `${value} ${value === 1 ? 'hour' : 'hours'}`;

  /** @param {number} value */
  const minuteLabel = (value) =>
    `${value} ${value === 1 ? 'minute' : 'minutes'}`;

  /** @param {number} value */
  const secondLabel = (value) =>
    `${value} ${value === 1 ? 'second' : 'seconds'}`;

  // Show the largest remaining unit and the next unit when nonzero.
  if (days > 0) {
    return `Book within ${dayLabel(days)}${
      hours > 0 ? ` and ${hourLabel(hours)}` : ''
    }`;
  }

  if (hours > 0) {
    return `Book within ${hourLabel(hours)}${
      minutes > 0 ? ` and ${minuteLabel(minutes)}` : ''
    }`;
  }

  if (minutes > 0) {
    return `Book within ${minuteLabel(minutes)}${
      seconds > 0 ? ` and ${secondLabel(seconds)}` : ''
    }`;
  }

  return `Book within ${secondLabel(seconds)}`;
}

/**
 * Manages booking selections, availability searches, and confirmation.
 *
 * @param {Object} options
 * @param {object | null} options.user
 * @param {() => void} [options.onRequireLogin]
 */
export default function useBookingLogic({ user, onRequireLogin }) {
  // Store meal slots loaded from the server.
  const [mealSlots, setMealSlots] = useState(
    /** @type {MealSlotDTO[]} */ ([]),
  );

  // Store the selected date, meal slot, and number of guests.
  const [bookingDate, setBookingDate] = useState('');
  const [selectedMealSlotId, setSelectedMealSlotId] = useState('');
  const [partySize, setPartySize] = useState('2');

  // Store the latest availability result for the current selection.
  const [availability, setAvailability] = useState(
    /** @type {MealSlotAvailabilityDTO | null} */ (null),
  );

  // Store the details shown after a successful reservation.
  const [confirmedReservation, setConfirmedReservation] = useState(
    /** @type {ConfirmedReservation | null} */ (null),
  );

  // Track pending operations, errors, and optional party requirements.
  const [isLoadingSlots, setIsLoadingSlots] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [isBooking, setIsBooking] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [specialRequests, setSpecialRequests] = useState('');
  const [hasFoodAllergies, setHasFoodAllergies] = useState(false);

  // Keep a clock value that triggers countdown updates.
  const [currentTime, setCurrentTime] = useState(
    () => Date.now()
  );

  // Keep the feedback property available to consuming components.
  const feedbackMessage = '';

  // Track searches and prevent overlapping booking submissions.
  const requestId = useRef(0);
  const selectionRef = useRef('');
  const bookingInProgressRef = useRef(false);

  // Identify selections that affect availability; requests do not affect seats.
  const selectionKey = `${bookingDate}|${selectedMealSlotId}|${partySize}`;

  // Update the selection reference before asynchronous results are applied.
  useLayoutEffect(() => {
    selectionRef.current = selectionKey;
  }, [selectionKey]);

  // Show active slots for the selected date that are still open for booking.
  const activeMealSlots = mealSlots.filter((slot) => {
    if (!slot.isActive || slot.slotDate !== bookingDate) {
      return false;
    }

    // Keep the selected slot visible if it closes while the form is open.
    if (String(slot.id) === selectedMealSlotId) {
      return true;
    }

    const deadline = Date.parse(slot.bookingClosesAt ?? '');

    return (
      Number.isFinite(deadline) &&
      currentTime <= deadline
    );
  });

  // Resolve the selected slot and the numeric values used for seat checks.
  const selectedMealSlot = activeMealSlots.find(
    (slot) => String(slot.id) === selectedMealSlotId,
  );

  const requestedPartySize = Number(partySize);
  const totalAvailableSeats = availability?.totalAvailableSeats ?? 0;

  // Read the booking deadline from the slot or availability response.
  const deadlineValue =
    selectedMealSlot?.bookingClosesAt ??
    availability?.bookingClosesAt;

  const bookingDeadline = deadlineValue
    ? Date.parse(deadlineValue)
    : NaN;

  // Determine whether bookings are closed or will close within five minutes.
  const isBookingWindowClosed =
    Boolean(selectedMealSlot) &&
    Number.isFinite(bookingDeadline) &&
    currentTime > bookingDeadline;

  const isBookingDeadlineNear =
    Boolean(selectedMealSlot) &&
    Number.isFinite(bookingDeadline) &&
    !isBookingWindowClosed &&
    bookingDeadline - currentTime <= 5 * 60 * 1000;

  // Build the countdown label displayed beside the meal service.
  const bookingCountdownLabel =
    selectedMealSlot && Number.isFinite(bookingDeadline)
      ? formatBookingCountdown(bookingDeadline - currentTime)
      : '';

  // Check whether the latest availability result has enough seats.
  const canAccommodateParty =
    availability !== null &&
    totalAvailableSeats >= requestedPartySize;

  // Prevent selecting dates before today in the hut's time zone.
  const minimumBookingDate = getLocalDateString(new Date());

  // Format the selected date for availability and confirmation messages.
  const formattedBookingDate = bookingDate
    ? new Date(`${bookingDate}T00:00:00`).toLocaleDateString(
        'en-GB',
        {
          weekday: 'short',
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        },
      )
    : '';

  // Load meal slots on mount and ignore results after unmounting.
  useEffect(() => {
    let mounted = true;

    BookingAPI.getMealSlots()
      .then((slots) => {
        if (!mounted) return;

        setMealSlots(slots);
      })
      .catch((error) => {
        if (mounted) {
          setErrorMessage(getErrorMessage(error));
        }
      })
      .finally(() => {
        if (mounted) {
          setIsLoadingSlots(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  // Close the confirmation popup.
  function closeReservationConfirmation() {
    setConfirmedReservation(null);
  }

  // Clear availability and invalidate any pending search response.
  function invalidateAvailability() {
    requestId.current += 1;

    setAvailability(null);
    setErrorMessage('');
    setIsSearching(false);
  }

  /**
   * Changes the date and clears the previously selected meal slot.
   *
   * @param {string} value
   */
  function changeBookingDate(value) {
    if (bookingInProgressRef.current) return;

    invalidateAvailability();
    setBookingDate(value);
    setSelectedMealSlotId('');
  }

  /**
   * Changes the meal slot and refreshes the deadline check.
   *
   * @param {string} value
   */
  function changeMealSlot(value) {
    if (bookingInProgressRef.current) return;

    invalidateAvailability();
    setCurrentTime(Date.now());
    setSelectedMealSlotId(value);
  }

  /**
   * Changes the party size and requires a new availability check.
   *
   * @param {string} value
   */
  function changePartySize(value) {
    if (bookingInProgressRef.current) return;

    invalidateAvailability();
    setPartySize(value);
  }

  // Refresh the countdown every second and clear the timer on unmount.
  useEffect(() => {
    const timer = window.setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  /**
   * Validates the selection and requests current seat availability.
   *
   * @param {import('react').SubmitEvent<HTMLFormElement>} event
   */
  async function handleSearch(event) {
    event.preventDefault();

    // Require authentication before searching.
    if (!user) {
      onRequireLogin?.();
      return;
    }

    // Prevent a search while a booking submission is in progress.
    if (bookingInProgressRef.current) return;

    invalidateAvailability();

    // Require a valid date, meal slot, and positive whole number of guests.
    if (
      !bookingDate ||
      !selectedMealSlotId ||
      !partySize ||
      !Number.isInteger(requestedPartySize) ||
      requestedPartySize < 1 ||
      bookingDate < getLocalDateString(new Date())
    ) {
      setErrorMessage(
        'Choose today or a later date, a meal service, and a positive whole number of guests.',
      );

      return;
    }

    // Recheck the deadline using the current time before calling the API.
    const searchDeadline = Date.parse(
      selectedMealSlot?.bookingClosesAt ?? ''
    );

    if (
      !Number.isFinite(searchDeadline) ||
      Date.now() > searchDeadline
    ) {
      setCurrentTime(Date.now());

      setErrorMessage(
        'Bookings for this service are closed. Choose another service.',
      );

      return;
    }

    // Capture the search identity and selection to reject stale results.
    const currentRequest = ++requestId.current;
    const currentSelection = selectionKey;

    setIsSearching(true);

    try {
      const result = await BookingAPI.getAvailability(
        bookingDate,
        Number(selectedMealSlotId),
      );

      // Apply results only if this is still the latest matching search.
      if (
        requestId.current === currentRequest &&
        selectionRef.current === currentSelection
      ) {
        setAvailability(result);
      }
    } catch (error) {
      // Do not display errors from a search that is no longer relevant.
      if (
        requestId.current === currentRequest &&
        selectionRef.current === currentSelection
      ) {
        setErrorMessage(
          error instanceof BookingApiError && error.status === 404
            ? 'This meal service is no longer available. Choose another service.'
            : getErrorMessage(error),
        );
      }
    } finally {
      // An older search must not clear a newer search's loading state.
      if (requestId.current === currentRequest) {
        setIsSearching(false);
      }
    }
  }

  /**
   * Updates optional requirements without invalidating seat availability.
   *
   * @param {string} value
   */
  function changeSpecialRequests(value) {
    if (bookingInProgressRef.current) return;

    setSpecialRequests(value);
  }

  /**
   * Updates the allergy selection while keeping the combined request within
   * the server's existing character limit.
   *
   * @param {boolean} value
   */
  function changeFoodAllergies(value) {
    if (bookingInProgressRef.current) return;

    setHasFoodAllergies(value);

    if (value) {
      const maxRequirementsLength =
        MAX_SPECIAL_REQUEST_LENGTH -
        FOOD_ALLERGY_REQUEST.length -
        1;

      setSpecialRequests((requests) =>
        requests.slice(0, maxRequirementsLength),
      );
    }
  }

  // Submit a booking after rechecking authentication, availability, and time.
  async function handleReserve() {
    // Block duplicate submissions immediately, before React updates state.
    if (bookingInProgressRef.current) return;

    setErrorMessage('');

    // Ask the user to sign in if the session is no longer available.
    if (!user) {
      onRequireLogin?.();

      return;
    }

    // Require an availability result with enough seats for the party.
    if (!availability || !canAccommodateParty) {
      setErrorMessage(
        'Check availability before confirming your booking.',
      );

      return;
    }

    // Reject a booking if the deadline passed after the availability search.
    const deadline = Date.parse(availability.bookingClosesAt);

    if (!Number.isFinite(deadline) || Date.now() > deadline) {
      setCurrentTime(Date.now());

      setErrorMessage(
        'Bookings close two hours before the meal service starts. Choose another service.',
      );

      return;
    }

    // Reject a date that became past while the form remained open.
    if (bookingDate < getLocalDateString(new Date())) {
      invalidateAvailability();

      setErrorMessage(
        'Choose today or a later date and check availability again.',
      );

      return;
    }

    // Capture the submitted selection for the request and confirmation popup.
    const currentSelection = selectionKey;
    const date = bookingDate;
    const slotId = Number(selectedMealSlotId);
    const guests = requestedPartySize;
    const mealName = availability.slotName;
    const startTime = availability.startTime;
    const endTime = availability.endTime;

    // Include optional requirements and allergy selection in the existing field.
    /** @type {CreateBookingRequestDTO} */
    const bookingData = {
      bookingDate: date,
      slotId,
      partySize: guests,
      specialRequests: buildSpecialRequests(
        specialRequests,
        hasFoodAllergies,
      ),
    };

    // Lock booking controls and invalidate any pending availability search.
    bookingInProgressRef.current = true;
    setIsBooking(true);

    requestId.current += 1;
    setIsSearching(false);

    try {
      // Create the booking; the response also reports email delivery status.
      const { booking: savedBooking, emailSent } =
        await BookingAPI.createBooking(bookingData);

      // Clear the input while preserving its submitted value in the popup.
      setSpecialRequests('');
      setHasFoodAllergies(false);

      setConfirmedReservation({
        id: savedBooking.id,
        bookingDate: date,
        mealName,
        startTime,
        endTime,
        partySize: guests,
        emailSent,
        specialRequests: bookingData.specialRequests ?? '',
      });

      // Seats may have changed, so the submitted selection needs a new search.
      if (selectionRef.current === currentSelection) {
        setAvailability(null);
      }
    } catch (error) {
      if (
        error instanceof BookingApiError &&
        error.status === 401
      ) {
        // Request authentication again when the server rejects the session.
        onRequireLogin?.();
      } else if (
        error instanceof BookingApiError &&
        (
          error.code === 'SLOT_INACTIVE' ||
          error.code === 'SLOT_NOT_FOUND'
        )
      ) {
        // Remove a slot that is no longer available and clear the selection.
        setAvailability(null);

        setMealSlots((slots) =>
          slots.filter((slot) => slot.id !== slotId),
        );

        setSelectedMealSlotId('');

        setErrorMessage(
          'This meal service is no longer available. Choose another service.',
        );
      } else if (
        error instanceof BookingApiError &&
        error.code === 'BOOKING_TOO_LATE'
      ) {
        // Handle a deadline rejection from the server.
        setAvailability(null);

        setErrorMessage(
          'Bookings close two hours before the meal service starts. Choose another service.',
        );
      } else if (
        error instanceof BookingApiError &&
        error.status === 409
      ) {
        // Explain conflicts such as insufficient seats or a duplicate booking.
        setAvailability(null);

        setErrorMessage(
          error.code === 'NO_AVAILABILITY'
            ? 'There are no longer enough seats. Please check availability again.'
            : error.code === 'DUPLICATE_BOOKING'
              ? 'You already have a confirmed booking for this date and meal service.'
              : 'Availability has changed. Please check again.',
        );

        // Refresh seats after a conflict, except when a booking already exists.
        if (error.code !== 'DUPLICATE_BOOKING') {
          try {
            const updated = await BookingAPI.getAvailability(
              date,
              slotId,
            );

            // Apply refreshed seats only to the selection that was submitted.
            if (selectionRef.current === currentSelection) {
              setAvailability(updated);
            }
          } catch {
            // Keep availability cleared if the refresh also fails.
            if (selectionRef.current === currentSelection) {
              setAvailability(null);
            }
          }
        }
      } else {
        // Display a fallback message for other API or network errors.
        setErrorMessage(getErrorMessage(error));
      }
    } finally {
      // Unlock booking controls after either success or failure.
      bookingInProgressRef.current = false;
      setIsBooking(false);
    }
  }

  // Expose state, derived values, and actions to booking components.
  return {
    bookingDate,
    selectedMealSlotId,
    partySize,
    specialRequests,
    changeSpecialRequests,
    hasFoodAllergies,
    changeFoodAllergies,
    availability,
    confirmedReservation,
    closeReservationConfirmation,
    activeMealSlots,
    selectedMealSlot,
    requestedPartySize,
    canAccommodateParty,
    minimumBookingDate,
    formattedBookingDate,
    isLoadingSlots,
    isSearching,
    isBooking,
    errorMessage,
    feedbackMessage,
    changeBookingDate,
    changeMealSlot,
    changePartySize,
    handleSearch,
    handleReserve,
    isBookingWindowClosed,
    bookingCountdownLabel,
    isBookingDeadlineNear,
  };
}