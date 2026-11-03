import { Button, Spinner } from 'react-bootstrap';
import { Link } from 'react-router-dom';

import useMyBookings from '../../hooks/useMyBookings.js';
import Alert from '../common/AutoDismissAlert.jsx';
import BookingCard from './BookingCard.jsx';

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
  } = useMyBookings(hikerId);

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
      <Alert variant="danger">
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
      <BookingGroup
        title="Upcoming bookings"
        bookings={upcoming}
      />

      <BookingGroup
        title="Past and cancelled bookings"
        bookings={other}
      />
    </>
  );
}

/**
 * @param {Object} props
 * @param {string} props.title
 * @param {BookingDTO[]} props.bookings
 */
function BookingGroup({ title, bookings }) {
  if (bookings.length === 0) return null;

  return (
    <section className="mb-5" aria-label={title}>
      <h2 className="h4 mb-3">{title}</h2>

      <div className="row g-3">
        {bookings.map((booking) => (
          <div className="col-12 col-md-6" key={booking.id}>
            <BookingCard booking={booking} />
          </div>
        ))}
      </div>
    </section>
  );
}