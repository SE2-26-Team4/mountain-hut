import { Col, Form, Row } from "react-bootstrap";

import { formatCount } from "../../utils/formatCount.js";
import BookingRequestFields from "../booking/BookingRequestFields.jsx";

/**
 * Free seats of the selected meal slot.
 *
 * @typedef {(
 *   { status: "idle" } |
 *   { status: "loading" } |
 *   { status: "error" } |
 *   { status: "ready", seats: number }
 * )} SeatAvailability
 */

/**
 * Tells staff how many seats are free before they confirm the booking.
 *
 * @param {{ availability: SeatAvailability, partySize: number }} props
 */
function SeatAvailabilityText({ availability, partySize }) {
  if (availability.status === "idle") return null;

  if (availability.status === "loading") {
    return (
      <Form.Text id="staff-booking-seats" role="status">
        Checking available seats…
      </Form.Text>
    );
  }

  if (availability.status === "error") {
    return (
      <Form.Text id="staff-booking-seats" className="text-danger" role="alert">
        Could not load the available seats.
      </Form.Text>
    );
  }

  const { seats } = availability;

  if (seats === 0) {
    return (
      <Form.Text id="staff-booking-seats" className="text-danger" role="alert">
        No seats are available for this meal slot.
      </Form.Text>
    );
  }

  if (partySize > seats) {
    return (
      <Form.Text id="staff-booking-seats" className="text-danger" role="alert">
        Only {formatCount(seats, "seat")} available for{" "}
        {formatCount(partySize, "guest")}.
      </Form.Text>
    );
  }

  return (
    <Form.Text id="staff-booking-seats" role="status">
      {formatCount(seats, "seat")} available.
    </Form.Text>
  );
}

/** @param {{
 *   bookingDate: string,
 *   slotId: string,
 *   partySize: string,
 *   requests: import("../../utils/booking-requirements.js").BookingRequests,
 *   onRequestsChange: (requests: import("../../utils/booking-requirements.js").BookingRequests) => void,
 *   isSavingBooking: boolean,
 *   hutToday: string,
 *   slotLoadError: string,
 *   setBookingDate: (value: string) => void,
 *   setSlotId: (value: string) => void,
 *   setPartySize: (value: string) => void,
 *   loadingSlots: boolean,
 *   slotsForDate: import("../../models/models.js").MealSlotDTO[],
 *   seatAvailability: SeatAvailability,
 * }} props */
export default function StaffBookingDetails({
  bookingDate,
  slotId,
  partySize,
  requests,
  onRequestsChange,
  isSavingBooking,
  hutToday,
  slotLoadError,
  setBookingDate,
  setSlotId,
  setPartySize,
  loadingSlots,
  slotsForDate,
  seatAvailability,
}) {
  return (
    <fieldset className="mt-4 border-top pt-3">
      <legend className="h5 mb-3">Booking details</legend>

      <Row className="g-3">
        <Col xs={12} md={4}>
          <Form.Group controlId="staff-booking-date">
            <Form.Label>Date</Form.Label>
            <Form.Control
              type="date"
              min={hutToday}
              value={bookingDate}
              onChange={(event) => {
                setBookingDate(event.target.value);
                setSlotId("");
              }}
              required
            />
          </Form.Group>
        </Col>

        <Col xs={12} md={5}>
          <Form.Group controlId="staff-booking-slot">
            <Form.Label>Meal slot</Form.Label>
            <Form.Select
              value={slotId}
              onChange={(event) => setSlotId(event.target.value)}
              disabled={loadingSlots || slotsForDate.length === 0}
              aria-describedby={
                seatAvailability.status === "idle"
                  ? undefined
                  : "staff-booking-seats"
              }
              required
            >
              <option value="">
                {loadingSlots
                  ? "Loading meal slots…"
                  : !bookingDate
                    ? "Choose a date first"
                    : slotsForDate.length === 0
                      ? "No slots available"
                      : "Select a meal slot"}
              </option>

              {slotsForDate.map((slot) => (
                <option key={slot.id} value={slot.id}>
                  {slot.name} · {slot.startTime}–{slot.endTime}
                </option>
              ))}
            </Form.Select>

            {slotLoadError && (
              <Form.Text className="text-danger" role="alert">
                {slotLoadError}
              </Form.Text>
            )}

            <SeatAvailabilityText
              availability={seatAvailability}
              partySize={Number(partySize)}
            />
          </Form.Group>
        </Col>

        <Col xs={12} md={3}>
          <Form.Group controlId="staff-booking-party-size">
            <Form.Label>Party size</Form.Label>
            <Form.Control
              type="number"
              min={1}
              step={1}
              value={partySize}
              onChange={(event) => setPartySize(event.target.value)}
              required
            />
          </Form.Group>
        </Col>

        <Col xs={12}>
          <BookingRequestFields
            requests={requests}
            onChange={onRequestsChange}
            partySize={Number(partySize)}
            staff
            disabled={isSavingBooking}
          />
        </Col>
      </Row>
    </fieldset>
  );
}
