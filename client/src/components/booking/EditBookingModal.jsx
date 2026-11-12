import { useEffect, useState } from "react";
import { Button, Form, Modal } from "react-bootstrap";

import BookingAPI from "../../API/booking-api.js";
import Alert from "../common/AutoDismissAlert.jsx";
import {
  buildSpecialRequests,
  FOOD_ALLERGY_REQUEST,
  MAX_SPECIAL_REQUEST_LENGTH,
} from "../../utils/booking-requirements.js";

/**
 * @param {{
 *   booking: import('../../models/models.js').BookingDTO,
 *   onClose: () => void,
 *   onSaved: (emailSent: boolean) => void
 * }} props
 */
export default function EditBookingModal({ booking, onClose, onSaved }) {
  const [bookingDate, setBookingDate] = useState(booking.bookingDate);
  const [slotId, setSlotId] = useState(String(booking.slotId));
  const [partySize, setPartySize] = useState(String(booking.partySize));
  const [firstLine, ...remainingLines] = (booking.specialRequests ?? "").split(
    "\n",
  );
  const [hasAllergy, setHasAllergy] = useState(
    firstLine === FOOD_ALLERGY_REQUEST,
  );
  const [requirements, setRequirements] = useState(
    firstLine === FOOD_ALLERGY_REQUEST
      ? remainingLines.join("\n")
      : (booking.specialRequests ?? ""),
  );
  const [mealSlots, setMealSlots] = useState(
    /** @type {import('../../models/models.js').MealSlotDTO[]} */ ([]),
  );
  const [loadingSlots, setLoadingSlots] = useState(true);
  const [slotError, setSlotError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [saving, setSaving] = useState(false);
  const [openedAt] = useState(() => Date.now());

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
  const requirementsLimit =
    MAX_SPECIAL_REQUEST_LENGTH -
    (hasAllergy ? FOOD_ALLERGY_REQUEST.length + 1 : 0);

  /** @param {import('react').SubmitEvent<HTMLFormElement>} event */
  async function handleSubmit(event) {
    event.preventDefault();
    if (saving) return;

    setSaving(true);
    setSaveError("");

    try {
      const { emailSent } = await BookingAPI.updateBooking(booking.id, {
        bookingDate,
        slotId: Number(slotId),
        partySize: Number(partySize),
        specialRequests: buildSpecialRequests(requirements, hasAllergy),
      });

      onSaved(emailSent);
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

            <Form.Check
              id="edit-booking-allergy"
              className="mb-3"
              label="Someone in my party has a food allergy"
              checked={hasAllergy}
              onChange={(event) => setHasAllergy(event.target.checked)}
            />

            {hasAllergy && (
              <Form.Group controlId="edit-booking-requirements">
                <Form.Label>Food allergy details</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={3}
                  placeholder="e.g. Peanuts and shellfish"
                  value={requirements}
                  maxLength={requirementsLimit}
                  isInvalid={requirements.length > requirementsLimit}
                  onChange={(event) => setRequirements(event.target.value)}
                />
                <Form.Control.Feedback type="invalid">
                  Shorten the allergy details to {requirementsLimit} characters.
                </Form.Control.Feedback>
              </Form.Group>
            )}
          </fieldset>
        </Modal.Body>

        <Modal.Footer className="justify-content-end">
          <Button
            type="submit"
            variant="primary"
            disabled={
              saving ||
              !slotId ||
              (hasAllergy && requirements.length > requirementsLimit)
            }
          >
            {saving ? "Saving…" : "Save changes"}
          </Button>

          <Button
            type="button"
            variant="outline-secondary"
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}
