import { useState } from 'react';
import { Button, Spinner } from 'react-bootstrap';
import { Link } from 'react-router-dom';

import useMyBookings from '../../hooks/useMyBookings.js';
import { formatBookingDate } from '../../utils/formatBookingDate.js';
import Alert from '../common/AutoDismissAlert.jsx';
import BookingCard from './BookingCard.jsx';
import CancelBookingModal from './CancelBookingModal.jsx';

/**
 * @typedef {import('../../models/models.js').BookingDTO} BookingDTO
 */

/**
 * @param {Object} props
 * @param {number} props.hikerId
 */
export default function MyBookingsList({ hikerId }) {
  const {
    bookings,
    isLoading,
    errorMessage,
    retry,
    cancelBooking,
  } = useMyBookings(hikerId);

  // The selected booking stays set while the modal fades out,
  // so its details do not disappear during the animation.
  const [bookingToCancel, setBookingToCancel] = useState(
    /** @type {BookingDTO | null} */ (null),
  );
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelError, setCancelError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  /** @param {BookingDTO} booking */
  const openCancelModal = (booking) => {
    setBookingToCancel(booking);
    setCancelError('');
    setSuccessMessage('');
    setShowCancelModal(true);
  };

  const closeCancelModal = () => {
    setShowCancelModal(false);
  };

  const confirmCancellation = async () => {
    if (!bookingToCancel) return;

    setIsCancelling(true);
    setCancelError('');

    try {
      const cancelled = await cancelBooking(bookingToCancel.id);

      setShowCancelModal(false);
      setSuccessMessage(
        `Booking #${cancelled.id} for ${formatBookingDate(
          cancelled.bookingDate,
        )} has been cancelled.`,
      );
    } catch (error) {
      // Keep the modal open so the hiker can read the error and retry.
      setCancelError(
        error instanceof Error
          ? error.message
          : 'Could not cancel your booking.',
      );
    } finally {
      setIsCancelling(false);
    }
  };

  if (isLoading) {
    return (
      <div
        className="d-flex align-items-center gap-3"
        role="status"
      >
        <Spinner animation="border" aria-hidden="true" />

        <span>Loading your bookings…</span>
      </div>
    );
  }

  if (errorMessage) {
    return (
      // Keep the alert visible: it holds the only way to retry.
      <Alert variant="danger" timeout={0}>
        <p>{errorMessage}</p>

        <Button variant="outline-danger" onClick={retry}>
          Try again
        </Button>
      </Alert>
    );
  }

  if (bookings.length === 0) {
    return (
      <div>
        <p>You have no bookings yet.</p>

        <Link to="/#reserve">Reserve a table</Link>
      </div>
    );
  }

  const now = new Date();
  const today = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-');

  const upcoming = bookings
    .filter(
      (booking) =>
        booking.status === 'confirmed' &&
        booking.bookingDate >= today,
    )
    .sort((a, b) => a.bookingDate.localeCompare(b.bookingDate));

  const other = bookings
    .filter(
      (booking) =>
        booking.status !== 'confirmed' ||
        booking.bookingDate < today,
    )
    .sort((a, b) => b.bookingDate.localeCompare(a.bookingDate));

  return (
    <>
      {successMessage && (
        <Alert variant="success" role="status">
          {successMessage}
        </Alert>
      )}

      <BookingGroup
        title="Upcoming bookings"
        bookings={upcoming}
        onCancel={openCancelModal}
      />

      <BookingGroup
        title="Past and cancelled bookings"
        bookings={other}
      />

      <CancelBookingModal
        show={showCancelModal}
        booking={bookingToCancel}
        isCancelling={isCancelling}
        errorMessage={cancelError}
        onConfirm={confirmCancellation}
        onHide={closeCancelModal}
        onExited={() => setBookingToCancel(null)}
      />
    </>
  );
}

/**
 * @param {Object} props
 * @param {string} props.title
 * @param {BookingDTO[]} props.bookings
 * @param {(booking: BookingDTO) => void} [props.onCancel]
 */
function BookingGroup({ title, bookings, onCancel }) {
  if (bookings.length === 0) return null;

  return (
    <section className="mb-5" aria-label={title}>
      <h2 className="h4 mb-3">{title}</h2>

      <div className="row g-3">
        {bookings.map((booking) => (
          <div className="col-12 col-md-6" key={booking.id}>
            <BookingCard booking={booking} onCancel={onCancel} />
          </div>
        ))}
      </div>
    </section>
  );
}
