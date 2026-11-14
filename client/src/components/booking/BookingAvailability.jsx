import { Button, Col, Row, Spinner } from "react-bootstrap";
import { Link } from "react-router-dom";

import SuccessCheck from "../common/SuccessCheck.jsx";
import WarningMark from "../common/WarningMark.jsx";
import BookingRequestFields from "./BookingRequestFields.jsx";

/**
 * @typedef {ReturnType<typeof import("../../hooks/useBookingLogic.js").default>} BookingState
 */

/**
 * @param {Object} props
 * @param {BookingState} props.booking
 * @param {boolean} props.isAuthenticated
 */
export default function BookingAvailability({ booking, isAuthenticated }) {
  const {
    availability,
    alreadyBooked,
    formattedBookingDate,
    selectedMealSlot,
    requestedPartySize,
    canAccommodateParty,
    isBooking,
    handleReserve,
    isBookingWindowClosed,
    requests,
    setRequests,
    requestsInvalid,
  } = booking;

  if (!availability) return null;

  const guestLabel = `${requestedPartySize} ${
    requestedPartySize === 1 ? "guest" : "guests"
  }`;
  const mealLabel = selectedMealSlot?.name || "Selected service";
  const canBook =
    canAccommodateParty && !isBookingWindowClosed && !alreadyBooked;

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
              ? "mh-availability-status-success"
              : "mh-availability-status-unavailable"
          }`}
          role="status"
        >
          {canBook ? <SuccessCheck /> : <WarningMark />}

          <div className="mh-availability-status-content">
            <h2 id="availability-title">
              {alreadyBooked
                ? "You already have a booking"
                : isBookingWindowClosed
                  ? "Bookings are closed"
                  : canAccommodateParty
                    ? "A table is available"
                    : "No tables available"}
            </h2>

            <p className="mb-0">
              {alreadyBooked ? (
                <>
                  You already have a confirmed booking for this meal slot on{" "}
                  <strong>{formattedBookingDate}</strong>. You can view it in{" "}
                  <Link to="/my-bookings">My Bookings</Link>.
                </>
              ) : isBookingWindowClosed ? (
                <>
                  Bookings close two hours before the meal service starts.
                  Please choose another date or service.
                </>
              ) : canAccommodateParty ? (
                <>
                  We can welcome {guestLabel} for {mealLabel.toLowerCase()} on{" "}
                  <strong>{formattedBookingDate}</strong>.
                </>
              ) : (
                <>
                  Unfortunately, we cannot accommodate {guestLabel} for{" "}
                  {mealLabel.toLowerCase()} on {formattedBookingDate}. Please
                  try another date, meal service, or party size.
                </>
              )}
            </p>
          </div>
        </div>

        {canBook && (
          <div className="px-3 px-md-4 py-3">
            <BookingRequestFields
              requests={requests}
              onChange={setRequests}
              partySize={requestedPartySize}
              disabled={isBooking}
            />
          </div>
        )}

        {canAccommodateParty && !alreadyBooked && (
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
                    <span className="mh-availability-info-label">Date</span>
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
                    <span className="mh-availability-info-label">Guests</span>
                    <strong>{guestLabel}</strong>
                  </div>
                </Col>
              </Row>
            </Col>

            <Col xs={12} className="mh-availability-actions">
              {!isAuthenticated && !isBookingWindowClosed && (
                <p className="text-secondary small mb-2">
                  Sign in to confirm your reservation. Your selection will be
                  saved.
                </p>
              )}

              <Button
                className="mh-booking-confirm-button d-flex align-items-center justify-content-between w-100"
                type="button"
                disabled={isBooking || isBookingWindowClosed || requestsInvalid}
                onClick={handleReserve}
              >
                {isBooking ? (
                  <>
                    <Spinner size="sm" animation="border" aria-hidden="true" />
                    <span>Confirming…</span>
                  </>
                ) : (
                  <>
                    <span>
                      {isBookingWindowClosed
                        ? "Bookings closed"
                        : isAuthenticated
                          ? "Confirm reservation"
                          : "Sign in to continue"}
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
