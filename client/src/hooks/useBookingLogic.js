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
 * @property {boolean} emailSent
 */

/**
 * @param {Date} date
 * @returns {string}
 */
function getLocalDateString(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
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

  const feedbackMessage = '';

  const requestId = useRef(0);
  const selectionRef = useRef('');
  const bookingInProgressRef = useRef(false);

  const selectionKey = `${bookingDate}|${selectedMealSlotId}|${partySize}`;

  useLayoutEffect(() => {
    selectionRef.current = selectionKey;
  }, [selectionKey]);

  const activeMealSlots = mealSlots.filter((slot) => slot.isActive);

  const selectedMealSlot = activeMealSlots.find(
    (slot) => String(slot.id) === selectedMealSlotId,
  );

  const requestedPartySize = Number(partySize);
  const totalAvailableSeats = availability?.totalAvailableSeats ?? 0;

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

        const firstActive = slots.find((slot) => slot.isActive);

        setSelectedMealSlotId(
          firstActive ? String(firstActive.id) : '',
        );
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
  }

  /** @param {string} value */
  function changeMealSlot(value) {
    if (bookingInProgressRef.current) return;

    invalidateAvailability();
    setSelectedMealSlotId(value);
  }

  /** @param {string} value */
  function changePartySize(value) {
    if (bookingInProgressRef.current) return;

    invalidateAvailability();
    setPartySize(value);
  }

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
      const { booking: savedBooking, emailSent } =
        await BookingAPI.createBooking(bookingData);

      setConfirmedReservation({
        id: savedBooking.id,
        bookingDate: date,
        mealName,
        startTime,
        endTime,
        partySize: guests,
        emailSent,
      });

      if (selectionRef.current === currentSelection) {
        setAvailability(null);
      }
    } catch (error) {
      if (error instanceof BookingApiError && error.status === 401) {
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
        error.status === 409
      ) {
        setAvailability(null);

        setErrorMessage(
          error.code === 'NO_AVAILABILITY'
            ? 'There are no longer enough seats. Please check availability again.'
            : 'Availability has changed. Please check again.',
        );

        try {
          const updated = await BookingAPI.getAvailability(date, slotId);

          if (selectionRef.current === currentSelection) {
            setAvailability(updated);
          }
        } catch {
          if (selectionRef.current === currentSelection) {
            setAvailability(null);
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
  };
}