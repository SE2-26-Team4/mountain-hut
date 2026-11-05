import { useEffect, useLayoutEffect, useRef, useState } from 'react';

import BookingAPI, { BookingApiError } from '../API/booking-api.js';

/**
 * @typedef {import('../models/models.js').MealSlotDTO} MealSlotDTO
 * @typedef {import('../models/models.js').MealSlotAvailabilityDTO} MealSlotAvailabilityDTO
 * @typedef {import('../models/models.js').CreateBookingRequestDTO} CreateBookingRequestDTO
 */

/**
 * @typedef {Object} ConfirmedReservation
 * @property {number} id
 * @property {string} bookingDate
 * @property {string} mealName
 * @property {string} startTime
 * @property {string} endTime
 * @property {number} partySize
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
 * @param {unknown} error
 * @returns {string}
 */
function getErrorMessage(error) {
  return error instanceof Error
    ? error.message
    : 'An unexpected error occurred.';
}

/**
 * @param {number} remainingMilliseconds
 * @returns {string}
 */
function formatBookingCountdown(remainingMilliseconds) {
  if (remainingMilliseconds < 0) {
    return 'Bookings closed';
  }

  const totalSeconds = Math.ceil(
    remainingMilliseconds / 1000
  );

  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

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
 * @param {Object} options
 * @param {object | null} options.user
 * @param {() => void} [options.onRequireLogin]
 */
export default function useBookingLogic({ user, onRequireLogin }) {
  const [mealSlots, setMealSlots] = useState(
    /** @type {MealSlotDTO[]} */ ([]),
  );

  const [bookingDate, setBookingDate] = useState('');
  const [selectedMealSlotId, setSelectedMealSlotId] = useState('');
  const [partySize, setPartySize] = useState('2');

  const [availability, setAvailability] = useState(
    /** @type {MealSlotAvailabilityDTO | null} */ (null),
  );

  const [confirmedReservation, setConfirmedReservation] = useState(
    /** @type {ConfirmedReservation | null} */ (null),
  );

  const [isLoadingSlots, setIsLoadingSlots] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [isBooking, setIsBooking] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const [currentTime, setCurrentTime] = useState(
    () => Date.now()
  );

  const feedbackMessage = '';

  const requestId = useRef(0);
  const selectionRef = useRef('');
  const bookingInProgressRef = useRef(false);

  const selectionKey = `${bookingDate}|${selectedMealSlotId}|${partySize}`;

  useLayoutEffect(() => {
    selectionRef.current = selectionKey;
  }, [selectionKey]);

  const activeMealSlots = mealSlots.filter((slot) => {
    if (!slot.isActive || slot.slotDate !== bookingDate) {
      return false;
    }

    // Keep the selected slot visible if it expires during compilation.
    if (String(slot.id) === selectedMealSlotId) {
      return true;
    }

    const deadline = Date.parse(slot.bookingClosesAt ?? '');

    return (
      Number.isFinite(deadline) &&
      currentTime <= deadline
    );
  });

  const selectedMealSlot = activeMealSlots.find(
    (slot) => String(slot.id) === selectedMealSlotId,
  );

  const requestedPartySize = Number(partySize);
  const totalAvailableSeats = availability?.totalAvailableSeats ?? 0;

  const deadlineValue =
    selectedMealSlot?.bookingClosesAt ??
    availability?.bookingClosesAt;

  const bookingDeadline = deadlineValue
    ? Date.parse(deadlineValue)
    : NaN;

  const isBookingWindowClosed =
    Boolean(selectedMealSlot) &&
    Number.isFinite(bookingDeadline) &&
    currentTime > bookingDeadline;

  const isBookingDeadlineNear =
    Boolean(selectedMealSlot) &&
    Number.isFinite(bookingDeadline) &&
    !isBookingWindowClosed &&
    bookingDeadline - currentTime <= 5 * 60 * 1000;

  const bookingCountdownLabel =
    selectedMealSlot && Number.isFinite(bookingDeadline)
      ? formatBookingCountdown(bookingDeadline - currentTime)
      : '';

  const canAccommodateParty =
    availability !== null &&
    totalAvailableSeats >= requestedPartySize;

  const minimumBookingDate = getLocalDateString(new Date());

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

  function closeReservationConfirmation() {
    setConfirmedReservation(null);
  }

  function invalidateAvailability() {
    requestId.current += 1;

    setAvailability(null);
    setErrorMessage('');
    setIsSearching(false);
  }

  /** @param {string} value */
  function changeBookingDate(value) {
    if (bookingInProgressRef.current) return;

    invalidateAvailability();
    setBookingDate(value);
    setSelectedMealSlotId('');
  }

  /** @param {string} value */
  function changeMealSlot(value) {
    if (bookingInProgressRef.current) return;

    invalidateAvailability();
    setCurrentTime(Date.now());
    setSelectedMealSlotId(value);
  }

  /** @param {string} value */
  function changePartySize(value) {
    if (bookingInProgressRef.current) return;

    invalidateAvailability();
    setPartySize(value);
  }

  useEffect(() => {
    const timer = window.setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  /** @param {import('react').SubmitEvent<HTMLFormElement>} event */
  async function handleSearch(event) {
    event.preventDefault();

    if (bookingInProgressRef.current) return;

    invalidateAvailability();

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

    const currentRequest = ++requestId.current;
    const currentSelection = selectionKey;

    setIsSearching(true);

    try {
      const result = await BookingAPI.getAvailability(
        bookingDate,
        Number(selectedMealSlotId),
      );

      if (
        requestId.current === currentRequest &&
        selectionRef.current === currentSelection
      ) {
        setAvailability(result);
      }
    } catch (error) {
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
      if (requestId.current === currentRequest) {
        setIsSearching(false);
      }
    }
  }

  async function handleReserve() {
    if (bookingInProgressRef.current) return;

    setErrorMessage('');

    if (!user) {
      onRequireLogin?.();

      return;
    }

    if (!availability || !canAccommodateParty) {
      setErrorMessage(
        'Check availability before confirming your booking.',
      );

      return;
    }

    const deadline = Date.parse(availability.bookingClosesAt);

  if (!Number.isFinite(deadline) || Date.now() > deadline) {
    setCurrentTime(Date.now());

    setErrorMessage(
      'Bookings close two hours before the meal service starts. Choose another service.',
    );

    return;
  }

    if (bookingDate < getLocalDateString(new Date())) {
      invalidateAvailability();
      setErrorMessage(
        'Choose today or a later date and check availability again.',
      );

      return;
    }

    const currentSelection = selectionKey;
    const date = bookingDate;
    const slotId = Number(selectedMealSlotId);
    const guests = requestedPartySize;
    const mealName = availability.slotName;
    const startTime = availability.startTime;
    const endTime = availability.endTime;

    /** @type {CreateBookingRequestDTO} */
    const bookingData = {
      bookingDate: date,
      slotId,
      partySize: guests,
    };

    bookingInProgressRef.current = true;
    setIsBooking(true);

    requestId.current += 1;
    setIsSearching(false);

    try {
      const savedBooking = await BookingAPI.createBooking(bookingData);

      setConfirmedReservation({
        id: savedBooking.id,
        bookingDate: date,
        mealName,
        startTime,
        endTime,
        partySize: guests,
      });

      if (selectionRef.current === currentSelection) {
        setAvailability(null);
      }
    } catch (error) {
  if (
    error instanceof BookingApiError &&
    error.status === 401
  ) {
    onRequireLogin?.();
  } else if (
    error instanceof BookingApiError &&
    (
      error.code === 'SLOT_INACTIVE' ||
      error.code === 'SLOT_NOT_FOUND'
    )
  ) {
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
    setAvailability(null);

    setErrorMessage(
      'Bookings close two hours before the meal service starts. Choose another service.',
    );
  } else if (
    error instanceof BookingApiError &&
    error.status === 409
  ) {
    setAvailability(null);

    setErrorMessage(
      error.code === 'NO_AVAILABILITY'
        ? 'There are no longer enough seats. Please check availability again.'
        : error.code === 'DUPLICATE_BOOKING'
          ? 'You already have a confirmed booking for this date and meal service.'
          : 'Availability has changed. Please check again.',
    );

    if (error.code !== 'DUPLICATE_BOOKING') {
      try {
        const updated = await BookingAPI.getAvailability(
          date,
          slotId,
        );

        if (selectionRef.current === currentSelection) {
          setAvailability(updated);
        }
      } catch {
        if (selectionRef.current === currentSelection) {
          setAvailability(null);
        }
      }
    }
  } else {
    setErrorMessage(getErrorMessage(error));
  }
} finally {
  bookingInProgressRef.current = false;
  setIsBooking(false);
}
 }
  return {
    bookingDate,
    selectedMealSlotId,
    partySize,
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