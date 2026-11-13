import { useId } from "react";
import { Form } from "react-bootstrap";

import { bookingRequestsTooLong } from "../../utils/booking-requirements.js";

/**
 * @param {{
 *   requests: import("../../utils/booking-requirements.js").BookingRequests,
 *   onChange: (requests: import("../../utils/booking-requirements.js").BookingRequests) => void,
 *   partySize: number,
 *   staff?: boolean,
 *   disabled?: boolean,
 * }} props
 */
export default function BookingRequestFields({
  requests,
  onChange,
  partySize,
  staff = false,
  disabled = false,
}) {
  const id = useId();
  const subject = staff
    ? partySize === 1
      ? "The hiker has"
      : "Someone in the party has"
    : partySize === 1
      ? "I have"
      : "Someone in my party has";
  const tooLong = bookingRequestsTooLong(requests);

  return (
    <div className="d-grid gap-3">
      <Form.Check
        id={`${id}-dietary-toggle`}
        type="checkbox"
        label={`${subject} food allergies, intolerances, or other dietary requirements`}
        checked={requests.showDietary}
        disabled={disabled}
        onChange={(event) =>
          onChange({ ...requests, showDietary: event.target.checked })
        }
      />

      {requests.showDietary && (
        <>
          <Form.Group controlId={`${id}-dietary`}>
            <Form.Label>Dietary requirements</Form.Label>
            <Form.Control
              as="textarea"
              rows={2}
              value={requests.dietary}
              disabled={disabled}
              aria-describedby={`${id}-dietary-help`}
              placeholder={
                partySize === 1
                  ? staff
                    ? "E.g. The hiker needs a vegetarian meal."
                    : "E.g. I need a vegetarian meal."
                  : "E.g. 1 guest with a peanut allergy and 2 guests who need vegetarian meals."
              }
              onChange={(event) =>
                onChange({ ...requests, dietary: event.target.value })
              }
            />
            <Form.Text id={`${id}-dietary-help`}>
              {partySize === 1
                ? staff
                  ? "Please describe the hiker’s dietary requirements."
                  : "Please describe your dietary requirements."
                : "Please describe the dietary requirements and tell us how many guests each one applies to."}
            </Form.Text>
          </Form.Group>
        </>
      )}

      <Form.Group controlId={`${id}-special`}>
        <Form.Label>Special requests (optional)</Form.Label>
        <Form.Control
          as="textarea"
          rows={2}
          value={requests.special}
          disabled={disabled}
          aria-describedby={`${id}-special-help`}
          placeholder={
            partySize === 1
              ? staff
                ? "E.g. The hiker may arrive about 20 minutes late."
                : "E.g. I may arrive about 20 minutes late."
              : staff
                ? "E.g. The group may arrive about 20 minutes late."
                : "E.g. We may arrive about 20 minutes late."
          }
          onChange={(event) =>
            onChange({ ...requests, special: event.target.value })
          }
        />
        <Form.Text id={`${id}-special-help`}>
          Let us know if there’s anything else we should know about your
          booking.
        </Form.Text>
      </Form.Group>

      {tooLong && (
        <p className="text-danger small mb-0" role="alert">
          Shorten the requests to stay within the 1,000-character limit.
        </p>
      )}
    </div>
  );
}
