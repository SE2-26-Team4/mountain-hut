import { useEffect, useState } from "react";
import { Button, Form, Modal } from "react-bootstrap";

import BookingAPI from "../../API/booking-api.js";
import {
  bookingRequestsTooLong,
  readBookingRequests,
  toBookingRequestFields,
} from "../../utils/booking-requirements.js";
import Alert from "../common/AutoDismissAlert.jsx";
import BookingRequestFields from "./BookingRequestFields.jsx";

/**
 * @param {{
 *   booking: import("../../models/models.js").BookingDTO,
 *   onClose: () => void,
 *   onSaved: (reservation: import("./BookingConfirmationModal.jsx").BookingConfirmation) => void,
 * }} props
 */
export default function EditBookingModal({ booking, onClose, onSaved }) {
  const [bookingDate, setBookingDate] = useState(booking.bookingDate);
  const [slotId, setSlotId] = useState(String(booking.slotId));
  const [partySize, setPartySize] = useState(String(booking.partySize));
  const [requests, setRequests] = useState(() => {
    if (booking.dietaryRequirements) {
      return {
        showDietary: true,
        dietary: booking.dietaryRequirements,
        hasAllergies: false,
        special: booking.specialRequests ?? "",
      };
    }

    return readBookingRequests(booking.specialRequests);
  });
  const [mealSlots, setMealSlots] = useState(
    /** @type {import("../../models/models.js").MealSlotDTO[]} */ ([]),
  );
  const [loadingSlots, setLoadingSlots] = useState(true);
  const [slotError, setSlotError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [saving, setSaving] = useState(false);
  const [openedAt] = useState(() => Date.now());

  const requestsTooLong = bookingRequestsTooLong(requests);

  useEffect(() => {
    let active = true;

    BookingAPI.getMealSlots()
      .then((slots) => {
        if (active) setMealSlots(slots);
      })
      .catch(() => {
        if (active) setSlotError("Could not load alternative meal slots.");
      })
      .finally(() => {
        if (active) setLoadingSlots(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const availableSlots = mealSlots.filter(
    (slot) =>
      slot.slotDate === bookingDate &&
      (slot.id === booking.slotId ||
        !slot.bookingClosesAt ||
        Date.parse(slot.bookingClosesAt) >= openedAt),
  );

  const showOriginalSlot =
    bookingDate === booking.bookingDate &&
    !availableSlots.some((slot) => slot.id === booking.slotId);

  /** @param {import("react").SubmitEvent<HTMLFormElement>} event */
  async function handleSubmit(event) {
    event.preventDefault();
    if (saving || !slotId || requestsTooLong) return;

    setSaving(true);
    setSaveError("");

    try {
      const selectedSlot = availableSlots.find(
        (slot) => String(slot.id) === slotId,
      );

      const { booking: savedBooking, emailSent } =
        await BookingAPI.updateBooking(booking.id, {
          bookingDate,
          slotId: Number(slotId),
          partySize: Number(partySize),
          ...toBookingRequestFields(requests),
        });

      const keptOriginalSlot = savedBooking.slotId === booking.slotId;

      onSaved({
        id: savedBooking.id,
        bookingDate: savedBooking.bookingDate,
        mealName:
          savedBooking.slotName ??
          selectedSlot?.name ??
          (keptOriginalSlot ? booking.slotName : undefined) ??
          "Meal service",
        startTime:
          savedBooking.slotStartTime ??
          selectedSlot?.startTime ??
          (keptOriginalSlot ? booking.slotStartTime : undefined) ??
          "",
        endTime:
          savedBooking.slotEndTime ??
          selectedSlot?.endTime ??
          (keptOriginalSlot ? booking.slotEndTime : undefined) ??
          "",
        partySize: savedBooking.partySize,
        dietaryRequirements: savedBooking.dietaryRequirements,
        specialRequests: savedBooking.specialRequests,
        emailSent,
      });
    } catch (error) {
      setSaveError(
        error instanceof Error ? error.message : "Could not save your changes.",
      );
      setSaving(false);
    }
  }

  return (
    <Modal
      show
      onHide={saving ? undefined : onClose}
      backdrop={saving ? "static" : true}
      keyboard={!saving}
      aria-labelledby="edit-booking-title"
    >
      <Form onSubmit={handleSubmit}>
        <Modal.Header closeButton={!saving}>
          <Modal.Title id="edit-booking-title">
            Edit booking #{booking.id}
          </Modal.Title>
        </Modal.Header>

        <Modal.Body>
          {slotError && <Alert variant="warning">{slotError}</Alert>}

          {saveError && (
            <Alert variant="danger" timeout={5000}>
              {saveError}
            </Alert>
          )}

          <fieldset disabled={saving}>
            <Form.Group controlId="edit-booking-date" className="mb-3">
              <Form.Label>Date</Form.Label>
              <Form.Control
                type="date"
                value={bookingDate}
                required
                disabled={loadingSlots || Boolean(slotError)}
                onChange={(event) => {
                  const date = event.target.value;
                  setBookingDate(date);
                  setSlotId(
                    date === booking.bookingDate ? String(booking.slotId) : "",
                  );
                }}
              />
            </Form.Group>

            <Form.Group controlId="edit-booking-slot" className="mb-3">
              <Form.Label>Meal slot</Form.Label>
              <Form.Select
                value={slotId}
                onChange={(event) => setSlotId(event.target.value)}
                required
              >
                <option value="" disabled>
                  {availableSlots.length
                    ? "Select a meal slot"
                    : "No meal slots available"}
                </option>

                {showOriginalSlot && (
                  <option value={booking.slotId}>Current meal slot</option>
                )}

                {availableSlots.map((slot) => (
                  <option key={slot.id} value={slot.id}>
                    {slot.name} ({slot.startTime}–{slot.endTime})
                  </option>
                ))}
              </Form.Select>
            </Form.Group>

            <Form.Group controlId="edit-booking-party" className="mb-3">
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

            <BookingRequestFields
              requests={requests}
              onChange={setRequests}
              partySize={Number(partySize)}
              disabled={saving}
            />
          </fieldset>
        </Modal.Body>

        <Modal.Footer className="justify-content-end">
          <Button
            type="button"
            variant="outline-secondary"
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={saving || !slotId || requestsTooLong}
          >
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}
