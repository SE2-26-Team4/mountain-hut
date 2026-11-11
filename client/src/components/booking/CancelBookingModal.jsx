import { Modal, Spinner } from 'react-bootstrap';

import { formatCount } from '../../utils/formatCount.js';
import { formatBookingDate } from '../../utils/formatBookingDate.js';
import Alert from '../common/AutoDismissAlert.jsx';

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
  // Keep the modal open until the request has finished.
  const handleHide = () => {
    if (!isCancelling) onHide();
  };

  return (
    <Modal
      show={show}
      onHide={handleHide}
      onExited={onExited}
      backdrop={isCancelling ? 'static' : true}
      keyboard={!isCancelling}
      centered
      aria-labelledby="cancel-booking-title"
    >
      <Modal.Header closeButton={!isCancelling}>
        <Modal.Title id="cancel-booking-title">
          Cancel booking?
        </Modal.Title>
      </Modal.Header>

      <Modal.Body>
        {errorMessage && (
          <Alert variant="danger">
            {errorMessage}
          </Alert>
        )}

        {booking && (
          <>
            <p>
              You are about to cancel booking #{booking.id}.
            </p>

            <dl className="bg-light rounded-3 px-3 py-3 mb-3">
              <dt className="small text-secondary fw-normal">Date</dt>
              <dd className="fw-semibold">
                {formatBookingDate(booking.bookingDate)}
              </dd>

              <dt className="small text-secondary fw-normal">Party size</dt>
              <dd className="fw-semibold mb-0">
                {formatCount(booking.partySize, 'guest')}
              </dd>
            </dl>

            <p className="text-secondary mb-0">
              Your seats will be released for other guests. This action
              cannot be undone.
            </p>
          </>
        )}
      </Modal.Body>

      <Modal.Footer className="mh-cancel-booking-footer">
        {/* Plain buttons keep Bootstrap's state colors off the theme. */}
        <button
          type="button"
          className="mh-primary-button"
          onClick={handleHide}
          disabled={isCancelling}
        >
          Keep booking
        </button>

        <button
          type="button"
          className="mh-cancel-booking-button"
          onClick={onConfirm}
          disabled={isCancelling || !booking}
        >
          {isCancelling ? (
            <>
              <Spinner
                as="span"
                animation="border"
                size="sm"
                aria-hidden="true"
              />
              Cancelling…
            </>
          ) : (
            'Cancel booking'
          )}
        </button>
      </Modal.Footer>
    </Modal>
  );
}
