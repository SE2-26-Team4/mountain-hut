import { useEffect, useRef } from 'react';
import { Button, Modal } from 'react-bootstrap';

import useBookingLogic from '../../hooks/useBookingLogic.js';
import Alert from '../common/AutoDismissAlert.jsx';
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
        <Modal.Header
          closeButton
          className="mh-reservation-header"
        >
          <Modal.Title
            as="h2"
            id="reservation-confirmed-title"
            className="mh-reservation-title"
          >
            Your booking is confirmed
          </Modal.Title>
        </Modal.Header>

        <Modal.Body className="mh-reservation-body">
          {reservation && (
            <>
              <div className="mh-reservation-intro">
                <p className="mh-reservation-description">
                  We look forward to welcoming you to Mountain Hut.
                </p>

                <p
                  className={`mh-reservation-email${
                    reservation.emailSent
                      ? ''
                      : ' mh-reservation-email-warning'
                  }`}
                  role="status"
                >
                  {reservation.emailSent
                    ? 'A confirmation email has been sent to your email address. Please check your inbox or spam folder.'
                    : 'Your booking is confirmed, but the confirmation email could not be sent. Please keep your reservation number.'}
                </p>
              </div>

              <div className="mh-reservation-summary">
                <dl className="mb-0">
                  {[
                    ['Reservation number', `#${reservation.id}`],
                    ['Date', confirmedDate],
                    ['Meal service', reservation.mealName],
                    [
                      'Time',
                      `${reservation.startTime} – ${reservation.endTime}`,
                    ],
                    ['Guests', reservation.partySize],
                  ].map(([label, value]) => (
                    <div
                      key={label}
                      className="mh-reservation-detail"
                    >
                      <dt>{label}</dt>
                      <dd>{value}</dd>
                    </div>
                  ))}

                  {reservation.specialRequests && (
                    <div className="mh-reservation-detail mh-reservation-requests">
                      <dt>Special requests or allergies:</dt>

                      <dd>{reservation.specialRequests}</dd>
                    </div>
                  )}
                </dl>
              </div>
            </>
          )}
        </Modal.Body>

        <Modal.Footer className="mh-reservation-footer">
          <Button
            className="mh-primary-button mh-reservation-done"
            onClick={booking.closeReservationConfirmation}
          >
            Done
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}