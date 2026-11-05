import { useEffect, useRef } from 'react';
import { Button, Modal } from 'react-bootstrap';

import useBookingLogic from '../../hooks/useBookingLogic.js';
import Alert from '../common/AutoDismissAlert.jsx';
import MountainLogo from '../common/MountainLogo.jsx';
import BookingAvailability from './BookingAvailability.jsx';
import BookingSearch from './BookingSearch.jsx';

/**
 * @typedef {import('../../API/session-api.js').SessionUser} SessionUser
 * @typedef {import('../../models/models.js').MealSlotAvailabilityDTO} MealSlotAvailabilityDTO
 */

/**
 * @param {Object} props
 * @param {SessionUser | null} props.user
 * @param {() => void} [props.onRequireLogin]
 */
export default function BookingForm({ user, onRequireLogin }) {
  const booking = useBookingLogic({ user, onRequireLogin });
  const reservation = booking.confirmedReservation;

  const availabilityRef = useRef(
    /** @type {HTMLDivElement | null} */ (null),
  );

  const previousAvailabilityRef = useRef(
    /** @type {MealSlotAvailabilityDTO | null} */ (null),
  );

  useEffect(() => {
    const hasNewResult =
      booking.availability !== null &&
      booking.availability !== previousAvailabilityRef.current;

    previousAvailabilityRef.current = booking.availability;

    if (!hasNewResult || !availabilityRef.current) return;

    const prefersReducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;

    availabilityRef.current.scrollIntoView({
      behavior: prefersReducedMotion ? 'instant' : 'smooth',
      block: 'start',
    });
  }, [booking.availability]);

  const confirmedDate = reservation
    ? new Date(`${reservation.bookingDate}T00:00:00`).toLocaleDateString(
        'en-GB',
        {
          weekday: 'short',
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        },
      )
    : '';

  return (
    <div className="mh-booking">
      {booking.errorMessage && (
        <Alert
          className="mh-booking-alert"
          variant="danger"
          role="alert"
        >
          {booking.errorMessage}
        </Alert>
      )}

      <BookingSearch
        booking={booking}
        isAuthenticated={Boolean(user)}
        onRequireLogin={onRequireLogin}
      />

      <div
        ref={availabilityRef}
        className="mh-booking-availability-anchor"
      >
        <BookingAvailability
          booking={booking}
          isAuthenticated={Boolean(user)}
        />
      </div>

      <Modal
        show={Boolean(reservation)}
        onHide={booking.closeReservationConfirmation}
        centered
        aria-labelledby="reservation-confirmed-title"
        contentClassName="mh-reservation-modal"
      >
        <Modal.Header closeButton className="border-0 pb-0">
          <div className="d-flex align-items-center gap-2">
            <MountainLogo />

            <span className="fw-semibold small">
              MOUNTAIN HUT
            </span>
          </div>
        </Modal.Header>

        <Modal.Body className="px-4 pt-4 pb-3">
          {reservation && (
            <>
              <div className="text-center mb-4">
                <h2
                  id="reservation-confirmed-title"
                  className="h4 mt-3 mb-2"
                >
                  You're all booked!
                </h2>

                <p className="text-secondary mb-0">
                  Your reservation is confirmed.
                  We look forward to welcoming you!
                </p>
              </div>

              <div className="mh-reservation-summary">
                <dl className="mb-0">
                  <div className="mh-reservation-detail d-flex align-items-baseline justify-content-between gap-3">
                    <dt className="m-0 flex-shrink-0">
                      Reservation number
                    </dt>
                    <dd className="m-0 text-end">#{reservation.id}</dd>
                  </div>

                  <div className="mh-reservation-detail d-flex align-items-baseline justify-content-between gap-3">
                    <dt className="m-0 flex-shrink-0">Date</dt>
                    <dd className="m-0 text-end">{confirmedDate}</dd>
                  </div>

                  <div className="mh-reservation-detail d-flex align-items-baseline justify-content-between gap-3">
                    <dt className="m-0 flex-shrink-0">Meal service</dt>
                    <dd className="m-0 text-end">{reservation.mealName}</dd>
                  </div>

                  <div className="mh-reservation-detail d-flex align-items-baseline justify-content-between gap-3">
                    <dt className="m-0 flex-shrink-0">Time</dt>
                    <dd className="m-0 text-end">
                      {reservation.startTime}
                      {' – '}
                      {reservation.endTime}
                    </dd>
                  </div>

                  <div className="mh-reservation-detail d-flex align-items-baseline justify-content-between gap-3">
                    <dt className="m-0 flex-shrink-0">Guests</dt>
                    <dd className="m-0 text-end">{reservation.partySize}</dd>
                  </div>
                </dl>
              </div>
            </>
          )}
        </Modal.Body>

        <Modal.Footer className="border-0 px-4 pb-4 pt-2">
          <Button
            className="mh-primary-button w-100"
            onClick={booking.closeReservationConfirmation}
          >
            Done
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}