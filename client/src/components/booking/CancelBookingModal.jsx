import { Button, Modal, Spinner } from "react-bootstrap";

import { formatCount } from "../../utils/formatCount.js";
import { formatBookingDate } from "../../utils/formatBookingDate.js";
import Alert from "../common/AutoDismissAlert.jsx";
import CancellationMark from "../common/CancellationMark.jsx";

/**
 * @typedef {import('../../models/models.js').BookingDTO} BookingDTO
 */

/**
 * Asks the hiker to confirm a cancellation before it is sent.
 *
 * @param {Object} props
 * @param {boolean} props.show
 * @param {BookingDTO | null} props.booking
 * @param {boolean} props.isCancelling
 * @param {string} props.errorMessage
 * @param {() => void} props.onConfirm
 * @param {() => void} props.onHide
 * @param {() => void} [props.onExited]
 */
export default function CancelBookingModal({
  show,
  booking,
  isCancelling,
  errorMessage,
  onConfirm,
  onHide,
  onExited,
}) {
  const handleHide = () => {
    if (!isCancelling) onHide();
  };

  return (
    <Modal
      show={show}
      onHide={handleHide}
      onExited={onExited}
      backdrop={isCancelling ? "static" : true}
      keyboard={!isCancelling}
      centered
      contentClassName="mh-reservation-modal"
      aria-labelledby="cancel-booking-title"
    >
      <Modal.Header
        closeButton={!isCancelling}
        className="mh-reservation-header mh-reservation-header-centered"
      >
        <div className="flex-grow-1 text-center">
          <CancellationMark />

          <Modal.Title
            id="cancel-booking-title"
            className="mh-reservation-title mt-3"
          >
            {booking ? `Cancel booking #${booking.id}?` : "Cancel booking?"}
          </Modal.Title>
        </div>
      </Modal.Header>

      <Modal.Body>
        {errorMessage && (
          <Alert variant="danger" timeout={5000}>
            {errorMessage}
          </Alert>
        )}

        {booking && (
          <>
            <dl className="mb-3">
              <dt className="fw-normal">Date</dt>
              <dd>{formatBookingDate(booking.bookingDate)}</dd>

              <dt className="fw-normal">Party size</dt>
              <dd className="mb-0">
                {formatCount(booking.partySize, "guest")}
              </dd>
            </dl>

            <p className="text-secondary mb-0">
              Your seats will be released for other guests. This action cannot
              be undone.
            </p>
          </>
        )}
      </Modal.Body>

      <Modal.Footer className="justify-content-end">
        <Button
          type="button"
          variant="danger"
          onClick={onConfirm}
          disabled={isCancelling || !booking}
        >
          {isCancelling && (
            <Spinner
              as="span"
              animation="border"
              size="sm"
              className="me-2"
              aria-hidden="true"
            />
          )}
          {isCancelling ? "Cancelling…" : "Cancel booking"}
        </Button>

        <Button
          type="button"
          variant="outline-secondary"
          onClick={handleHide}
          disabled={isCancelling}
        >
          Keep booking
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
