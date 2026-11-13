import { useId } from "react";
import { Modal } from "react-bootstrap";

import SuccessCheck from "../common/SuccessCheck.jsx";

/**
 * @typedef {Object} BookingConfirmation
 * @property {number} id
 * @property {string} bookingDate
 * @property {string} mealName
 * @property {string} startTime
 * @property {string} endTime
 * @property {number} partySize
 * @property {boolean} emailSent
 * @property {string} [dietaryRequirements]
 * @property {string} [specialRequests]
 */

/**
 * @param {{
 *   reservation: BookingConfirmation | null,
 *   onClose: () => void,
 *   updated?: boolean,
 * }} props
 */
export default function BookingConfirmationModal({
  reservation,
  onClose,
  updated = false,
}) {
  const titleId = useId();
  const action = updated ? "updated" : "confirmed";

  const confirmedDate = reservation
    ? new Date(`${reservation.bookingDate}T00:00:00`).toLocaleDateString(
        "en-GB",
        {
          weekday: "short",
          day: "numeric",
          month: "short",
          year: "numeric",
        },
      )
    : "";

  return (
    <Modal
      show={Boolean(reservation)}
      onHide={onClose}
      centered
      aria-labelledby={titleId}
      contentClassName="mh-reservation-modal"
    >
      <Modal.Header
        closeButton
        className="mh-reservation-header mh-reservation-header-centered"
      >
        <div className="flex-grow-1 text-center">
          <SuccessCheck />

          <Modal.Title
            as="h2"
            id={titleId}
            className="mh-reservation-title mt-3"
          >
            Your booking is {action}
          </Modal.Title>
        </div>
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
                  reservation.emailSent ? "" : " mh-reservation-email-warning"
                }`}
                role="status"
              >
                {reservation.emailSent
                  ? "A confirmation email has been sent to your email address. Please check your inbox or spam folder."
                  : `Your booking is ${action}, but the confirmation email could not be sent. Please keep your reservation number.`}
              </p>
            </div>

            <div className="mh-reservation-summary">
              <dl className="mb-0">
                {[
                  ["Reservation number", `#${reservation.id}`],
                  ["Date", confirmedDate],
                  ["Meal service", reservation.mealName],
                  [
                    "Time",
                    reservation.startTime && reservation.endTime
                      ? `${reservation.startTime} – ${reservation.endTime}`
                      : "—",
                  ],
                  ["Guests", reservation.partySize],
                ].map(([label, value]) => (
                  <div key={label} className="mh-reservation-detail">
                    <dt>{label}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}

                {reservation.dietaryRequirements?.trim() && (
                  <div className="mh-reservation-detail">
                    <dt>Dietary requirements</dt>
                    <dd>Received</dd>
                  </div>
                )}

                {reservation.specialRequests?.trim() && (
                  <div className="mh-reservation-detail">
                    <dt>Special requests</dt>
                    <dd>Received</dd>
                  </div>
                )}
              </dl>
            </div>
          </>
        )}
      </Modal.Body>

      <Modal.Footer className="mh-reservation-footer">
        <button type="button" className="cap-primary w-100" onClick={onClose}>
          Done
        </button>
      </Modal.Footer>
    </Modal>
  );
}
