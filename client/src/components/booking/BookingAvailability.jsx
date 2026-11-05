import { Button, Col, Row, Spinner } from 'react-bootstrap';

/**
 * @typedef {ReturnType<typeof import('../../hooks/useBookingLogic.js').default>} BookingState
 */

/**
 * @param {Object} props
 * @param {BookingState} props.booking
 * @param {boolean} props.isAuthenticated
 */
function BookingAvailability({ booking, isAuthenticated }) {
  const {
    availability,
    formattedBookingDate,
    selectedMealSlot,
    requestedPartySize,
    canAccommodateParty,
    isBooking,
    handleReserve,
    isBookingWindowClosed,
  } = booking;

  if (!availability) return null;

  const guestLabel = `${requestedPartySize} ${
    requestedPartySize === 1 ? 'guest' : 'guests'
  }`;

  const mealLabel = selectedMealSlot?.name || 'Selected service';

  const canBook = canAccommodateParty && !isBookingWindowClosed;

  return (
    <section
      className="mh-availability"
      aria-labelledby="availability-title"
      aria-live="polite"
    >
      <div className="mh-availability-confirmation">
        <div
          className={`mh-availability-status d-flex align-items-center ${
            canBook
              ? 'mh-availability-status-success'
              : 'mh-availability-status-unavailable'
          }`}
          role="status"
        >
          <span
            className="mh-availability-status-icon d-flex align-items-center justify-content-center"
            aria-hidden="true"
          >
            {canBook ? (
              <i className="bi bi-check-lg" />
            ) : (
              '!'
            )}
          </span>

          <div className="mh-availability-status-content">
            <h2 id="availability-title">
              {isBookingWindowClosed
                ? 'Bookings are closed'
                : canAccommodateParty
                  ? 'A table is available'
                  : 'No tables available'}
            </h2>

            <p className="mb-0">
              {isBookingWindowClosed ? (
                <>
                  Bookings close two hours before the meal service starts.
                  Please choose another date or service.
                </>
              ) : canAccommodateParty ? (
                <>
                  We can welcome {guestLabel} for{' '}
                  {mealLabel.toLowerCase()} on{' '}
                  <strong>{formattedBookingDate}</strong>.
                </>
              ) : (
                <>
                  Unfortunately, we cannot accommodate{' '}
                  {guestLabel} for {mealLabel.toLowerCase()}{' '}
                  on {formattedBookingDate}. Please try another
                  date, meal service, or party size.
                </>
              )}
            </p>
          </div>
        </div>

        {canAccommodateParty && (
          <Row className="g-0 align-items-center mh-availability-confirmation-bottom">
            <Col xs={12} className="mh-availability-details">
              <Row className="g-0 align-items-center mh-availability-confirmation-info">
                <Col
                  xs={12}
                  md={4}
                  className="mh-availability-info-item d-flex align-items-center"
                >
                  <span
                    className="mh-availability-info-icon d-flex align-items-center justify-content-center"
                    aria-hidden="true"
                  >
                    <i className="bi bi-calendar3" />
                  </span>

                  <div className="d-flex flex-column">
                    <span className="mh-availability-info-label">
                      Date
                    </span>

                    <strong>{formattedBookingDate}</strong>
                  </div>
                </Col>

                <Col
                  xs={12}
                  md={4}
                  className="mh-availability-info-item d-flex align-items-center"
                >
                  <span
                    className="mh-availability-info-icon d-flex align-items-center justify-content-center"
                    aria-hidden="true"
                  >
                    <i className="bi bi-clock" />
                  </span>

                  <div className="d-flex flex-column">
                    <span className="mh-availability-info-label">
                      Meal service
                    </span>

                    <strong>
                      {mealLabel}

                      <span className="d-block">
                        {availability.startTime}–{availability.endTime}
                      </span>
                    </strong>
                  </div>
                </Col>

                <Col
                  xs={12}
                  md={4}
                  className="mh-availability-info-item d-flex align-items-center"
                >
                  <span
                    className="mh-availability-info-icon d-flex align-items-center justify-content-center"
                    aria-hidden="true"
                  >
                    <i className="bi bi-people" />
                  </span>

                  <div className="d-flex flex-column">
                    <span className="mh-availability-info-label">
                      Guests
                    </span>

                    <strong>{guestLabel}</strong>
                  </div>
                </Col>
              </Row>
            </Col>

            <Col xs={12} className="mh-availability-actions">
              {!isAuthenticated && !isBookingWindowClosed && (
                <p className="text-secondary small mb-2">
                  Sign in to confirm your reservation.
                  Your selection will be saved.
                </p>
              )}

              <Button
                className="mh-booking-confirm-button d-flex align-items-center justify-content-between w-100"
                type="button"
                disabled={isBooking || isBookingWindowClosed}
                onClick={handleReserve}
              >
                {isBooking ? (
                  <>
                    <Spinner
                      size="sm"
                      animation="border"
                      aria-hidden="true"
                    />

                    <span>Confirming…</span>
                  </>
                ) : (
                  <>
                    <span>
                      {isBookingWindowClosed
                        ? 'Bookings closed'
                        : isAuthenticated
                          ? 'Confirm reservation'
                          : 'Sign in to continue'}
                    </span>

                    <span aria-hidden="true">→</span>
                  </>
                )}
              </Button>
            </Col>
          </Row>
        )}
      </div>
    </section>
  );
}

export default BookingAvailability;