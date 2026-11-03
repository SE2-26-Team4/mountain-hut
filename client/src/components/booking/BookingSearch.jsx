import { Button, Col, Form, Row, Spinner } from 'react-bootstrap';
import { Link } from 'react-router-dom';

/**
 * @typedef {ReturnType<typeof import('../../hooks/useBookingLogic.js').default>} BookingState
 */

const partySizeOptions = Array.from(
  { length: 12 },
  (_, index) => index + 1,
);

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
            <Form.Label className="d-flex align-items-center gap-2">
              <i
                className="bi bi-cup-hot mh-field-icon"
                aria-hidden="true"
              />
              Meal service
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
                  : 'Select a meal service'}
              </option>

              {activeMealSlots.map((slot) => (
                <option key={slot.id} value={slot.id}>
                  {slot.name} ({slot.startTime}–{slot.endTime})
                </option>
              ))}
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

            <Form.Select
              value={partySize}
              onChange={(event) =>
                changePartySize(event.target.value)
              }
              disabled={isBooking}
              required
            >
              {partySizeOptions.map((size) => (
                <option key={size} value={size}>
                  {size} {size === 1 ? 'guest' : 'guests'}
                </option>
              ))}
            </Form.Select>
          </Form.Group>
        </Col>

        <Col
          xs={12}
          md={{ span: 6, offset: 3 }}
          xl={{ span: 3, offset: 0 }}
        >
          <Button
            className="mh-primary-button w-100"
            type="submit"
            disabled={
              isLoadingSlots ||
              isSearching ||
              isBooking ||
              activeMealSlots.length === 0
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
        activeMealSlots.length === 0 &&
        !booking.errorMessage && (
          <p
            className="text-secondary fs-5 mt-3 mb-0"
            role="status"
          >
            There are currently no meal services available to book.
            Please check back later.
          </p>
        )}
    </Form>
  );
}

export default BookingSearch;