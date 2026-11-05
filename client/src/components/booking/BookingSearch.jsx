import { Button, Col, Form, Row, Spinner } from 'react-bootstrap';
import { Link } from 'react-router-dom';

/**
 * @typedef {ReturnType<typeof import('../../hooks/useBookingLogic.js').default>} BookingState
 */

/**
 * @param {Object} props
 * @param {BookingState} props.booking
 */
function BookingSearch({ booking }) {
  const {
    bookingDate,
    selectedMealSlotId,
    partySize,
    activeMealSlots,
    minimumBookingDate,
    isLoadingSlots,
    isSearching,
    isBooking,
    changeBookingDate,
    changeMealSlot,
    changePartySize,
    handleSearch,
    bookingCountdownLabel,
    isBookingWindowClosed,
    isBookingDeadlineNear,
  } = booking;

  return (
    <Form
      className="mh-booking-search"
      onSubmit={handleSearch}
    >
      <Row className="g-3 align-items-end">
        <Col xs={12} md={4} xl={3}>
          <Form.Group controlId="booking-date">
            <Form.Label className="d-flex align-items-center gap-2">
              <i
                className="bi bi-calendar3 mh-field-icon"
                aria-hidden="true"
              />
              Date
            </Form.Label>

            <Form.Control
              type="date"
              value={bookingDate}
              min={minimumBookingDate}
              onChange={(event) =>
                changeBookingDate(event.target.value)
              }
              disabled={isBooking}
              required
            />
          </Form.Group>
        </Col>

        <Col xs={12} md={5} xl={4}>
          <Form.Group controlId="booking-meal-slot">
            <Form.Label className="mh-meal-service-label d-flex flex-wrap align-items-center justify-content-between gap-2">
              <span className="d-inline-flex align-items-center gap-2">
                <i
                  className="bi bi-cup-hot mh-field-icon"
                  aria-hidden="true"
                />
                Meal service
              </span>

              <small
                className={`mh-booking-countdown ${
                  isBookingWindowClosed
                    ? 'text-danger'
                    : isBookingDeadlineNear
                      ? 'mh-booking-countdown-warning'
                      : 'text-secondary'
                }`}
              >
                {bookingCountdownLabel ||
                  'Bookings close 2 hours before service.'}
              </small>
            </Form.Label>

            <Form.Select
              value={selectedMealSlotId}
              onChange={(event) =>
                changeMealSlot(event.target.value)
              }
              disabled={
                isLoadingSlots ||
                isBooking ||
                activeMealSlots.length === 0
              }
              required
            >
              <option value="" disabled>
                {isLoadingSlots
                  ? 'Loading meal services…'
                  : !bookingDate
                    ? 'Select a date first'
                    : activeMealSlots.length === 0
                      ? 'No services for this date'
                      : 'Select a meal service'}
              </option>

              {activeMealSlots.map((slot) => {
                const selectedAndClosed =
                  String(slot.id) === selectedMealSlotId &&
                  isBookingWindowClosed;

                return (
                  <option key={slot.id} value={slot.id}>
                    {slot.name} ({slot.startTime}–{slot.endTime})
                    {selectedAndClosed ? ' — Bookings closed' : ''}
                  </option>
                );
              })}
            </Form.Select>
          </Form.Group>
        </Col>

        <Col xs={12} md={3} xl={2}>
          <Form.Group controlId="booking-party-size">
            <Form.Label className="d-flex align-items-center gap-2">
              <i
                className="bi bi-people mh-field-icon"
                aria-hidden="true"
              />
              Guests
            </Form.Label>

            <Form.Control
              type="number"
              min="1"
              step="1"
              value={partySize}
              onChange={(event) =>
                changePartySize(event.target.value)
              }
              disabled={isBooking}
              required
            />
          </Form.Group>
        </Col>

        <Col
          xs={12}
          md={{ span: 6, offset: 3 }}
          xl={{ span: 3, offset: 0 }}
        >
          <Button
            className="mh-booking-search-button d-inline-flex align-items-center justify-content-between gap-3 w-100"
            type="submit"
            disabled={
              isLoadingSlots ||
              isSearching ||
              isBooking ||
              activeMealSlots.length === 0 ||
              isBookingWindowClosed
            }
          >
            {isSearching ? (
              <>
                <Spinner
                  size="sm"
                  animation="border"
                  aria-hidden="true"
                />

                <span>Checking…</span>
              </>
            ) : (
              <>
                <span>Check availability</span>
                <span aria-hidden="true">→</span>
              </>
            )}
          </Button>
        </Col>
      </Row>

      <div className="mh-booking-menu-link d-flex flex-wrap align-items-center gap-2 mt-3">
        <Link to="/menu">
          View meal times and menus
        </Link>

        <span>Coming soon</span>
      </div>

      {!isLoadingSlots &&
        bookingDate &&
        activeMealSlots.length === 0 &&
        !booking.errorMessage && (
          <p
            className="text-secondary fs-5 mt-3 mb-0"
            role="status"
          >
            There are no meal services still open for booking on the selected date.
            Please choose another date.
          </p>
        )}
    </Form>
  );
}

export default BookingSearch;