import { useState } from "react";
import { Overlay, Tooltip } from "react-bootstrap";

import { formatBookingDate } from "../../utils/formatBookingDate.js";
import StatusBadge from "../common/StatusBadge.jsx";

/**
 * @typedef {import('../../models/models.js').BookingDTO} BookingDTO
 */

/**
 * @param {Object} props
 * @param {BookingDTO} props.booking
 * @param {(booking: BookingDTO) => void} [props.onCancel] - Shows the
 *   Cancel booking button when provided.
 * @param {(booking: BookingDTO) => void} [props.onEdit]
 * @param {'Upcoming' | 'Past' | 'Cancelled'} props.status
 */
export default function BookingCard({ booking, status, onCancel, onEdit }) {
  const [editButton, setEditButton] = useState(
    /** @type {HTMLButtonElement | null} */ (null),
  );
  const [checkedAt, setCheckedAt] = useState(() => Date.now());
  const [showEditReason, setShowEditReason] = useState(false);

  const editDeadline = Date.parse(booking.editClosesAt ?? "");
  const editClosed = checkedAt > editDeadline;
  const editReasonId = `booking-edit-reason-${booking.id}`;

  const handleEditClick = () => {
    const clickedAt = Date.now();

    // Check again in case the deadline passed while the page was open.
    if (clickedAt > editDeadline) {
      setCheckedAt(clickedAt);
      setShowEditReason((visible) => !visible);
      return;
    }

    onEdit?.(booking);
  };

  const date = formatBookingDate(booking.bookingDate);

  const badgeVariant = {
    Upcoming: /** @type {const} */ ("primary"),
    Past: /** @type {const} */ ("secondary"),
    Cancelled: /** @type {const} */ ("danger"),
  }[status];

  return (
    <article className="card h-100">
      <div className="card-body d-flex flex-column">
        <div className="d-flex justify-content-between align-items-start gap-2">
          <h3 className="h5">Booking #{booking.id}</h3>
          <StatusBadge variant={badgeVariant}>{status}</StatusBadge>
        </div>

        <dl className="mb-0">
          <dt>Date</dt>
          <dd>{date}</dd>

          <dt>Meal slot</dt>
          <dd>
            {booking.slotName &&
            booking.slotStartTime &&
            booking.slotEndTime ? (
              <>
                <span className="d-block">{booking.slotName}</span>
                <span className="d-block small fw-normal">
                  {booking.slotStartTime}–{booking.slotEndTime}
                </span>
              </>
            ) : (
              "Meal details unavailable"
            )}
          </dd>

          <dt>Party size</dt>
          <dd>{booking.partySize}</dd>

          {booking.dietaryRequirements && (
            <>
              <dt>Dietary requirements</dt>
              <dd className="mh-booking-dietary mb-0">
                <span
                  className="mh-booking-dietary-text"
                  title={booking.dietaryRequirements}
                >
                  {booking.dietaryRequirements}
                </span>
              </dd>
            </>
          )}

          {booking.specialRequests && (
            <>
              <dt>Special requests</dt>
              <dd className="mh-booking-dietary mb-0">
                <span
                  className="mh-booking-dietary-text"
                  title={booking.specialRequests}
                >
                  {booking.specialRequests}
                </span>
              </dd>
            </>
          )}
        </dl>

        {(onEdit || onCancel) && (
          <div className="mh-booking-card-actions d-flex flex-wrap justify-content-end align-items-center gap-2 mt-auto pt-4">
            {onEdit && (
              <>
                <button
                  ref={setEditButton}
                  type="button"
                  className="btn btn-outline-secondary"
                  onClick={handleEditClick}
                  aria-label={`Edit booking #${booking.id}`}
                  aria-disabled={editClosed}
                  aria-describedby={showEditReason ? editReasonId : undefined}
                >
                  <i className="bi bi-pencil" aria-hidden="true" />
                </button>

                <Overlay
                  target={editButton}
                  show={showEditReason}
                  placement="top"
                  rootClose
                  onHide={() => setShowEditReason(false)}
                >
                  <Tooltip id={editReasonId}>
                    Changes close 48 hours before the original meal starts.
                  </Tooltip>
                </Overlay>
              </>
            )}

            {onCancel && (
              <button
                type="button"
                className="mh-cancel-booking-button"
                onClick={() => onCancel(booking)}
                aria-label={`Cancel booking #${booking.id}`}
              >
                <i className="bi bi-trash" aria-hidden="true" />
              </button>
            )}
          </div>
        )}
      </div>
    </article>
  );
}
