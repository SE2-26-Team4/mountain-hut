import { useState } from "react";
import { Button, Form, Spinner } from "react-bootstrap";
import { Link } from "react-router-dom";

import useMyBookings from "../../hooks/useMyBookings.js";
import { getBookingStatus } from "../../utils/booking-status.js";
import { formatBookingDate } from "../../utils/formatBookingDate.js";
import Alert from "../common/AutoDismissAlert.jsx";
import BookingCard from "./BookingCard.jsx";
import BookingConfirmationModal from "./BookingConfirmationModal.jsx";
import CancelBookingModal from "./CancelBookingModal.jsx";
import EditBookingModal from "./EditBookingModal.jsx";

const BOOKINGS_PER_BATCH = 6;

/**
 * @typedef {import("../../models/models.js").BookingDTO} BookingDTO
 * @typedef {import("./BookingConfirmationModal.jsx").BookingConfirmation} BookingConfirmation
 * @typedef {{ booking: BookingDTO, status: ReturnType<typeof getBookingStatus> }} BookingWithStatus
 */

/**
 * @param {Object} props
 * @param {number} props.hikerId
 */
export default function MyBookingsList({ hikerId }) {
  const { bookings, isLoading, errorMessage, retry, cancelBooking } =
    useMyBookings(hikerId);

  // Keep the booking details visible while the cancel modal fades out.
  const [bookingToCancel, setBookingToCancel] = useState(
    /** @type {BookingDTO | null} */ (null),
  );
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelError, setCancelError] = useState("");
  const [editing, setEditing] = useState(
    /** @type {BookingDTO | null} */ (null),
  );
  const [updatedReservation, setUpdatedReservation] = useState(
    /** @type {BookingConfirmation | null} */ (null),
  );
  const [cancellationFeedback, setCancellationFeedback] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [dateFilter, setDateFilter] = useState("");
  const [sortOrder, setSortOrder] = useState("default");

  /** @param {BookingDTO} booking */
  const openCancelModal = (booking) => {
    setCancellationFeedback("");
    setBookingToCancel(booking);
    setCancelError("");
    setShowCancelModal(true);
  };

  const closeCancelModal = () => {
    setShowCancelModal(false);
  };

  /** @param {BookingDTO} booking */
  const openEditModal = (booking) => {
    setCancellationFeedback("");
    setEditing(booking);
  };

  const confirmCancellation = async () => {
    if (!bookingToCancel) return;

    setIsCancelling(true);
    setCancelError("");

    try {
      const cancelled = await cancelBooking(bookingToCancel.id);

      setShowCancelModal(false);
      setCancellationFeedback(
        `Booking #${cancelled.id} for ${formatBookingDate(
          cancelled.bookingDate,
        )} has been cancelled.`,
      );
    } catch (error) {
      setCancelError(
        error instanceof Error
          ? error.message
          : "Could not cancel your booking.",
      );
    } finally {
      setIsCancelling(false);
    }
  };

  /** @param {BookingConfirmation} reservation */
  const handleBookingSaved = (reservation) => {
    setEditing(null);
    setUpdatedReservation(reservation);
  };

  const closeUpdateConfirmation = () => {
    setUpdatedReservation(null);
    retry();
  };

  if (isLoading) {
    return (
      <div className="d-flex align-items-center gap-3" role="status">
        <Spinner animation="border" aria-hidden="true" />
        <span>Loading your bookings…</span>
      </div>
    );
  }

  if (errorMessage) {
    return (
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
  const matchingBookings = bookings
    .map((booking) => ({ booking, status: getBookingStatus(booking, now) }))
    .filter(
      ({ booking, status }) =>
        (statusFilter === "All" || status === statusFilter) &&
        (!dateFilter || booking.bookingDate === dateFilter),
    );

  /** @param {BookingWithStatus} a @param {BookingWithStatus} b */
  const compareMealDate = (a, b) =>
    a.booking.bookingDate.localeCompare(b.booking.bookingDate) ||
    (a.booking.slotStartTime ?? "").localeCompare(
      b.booking.slotStartTime ?? "",
    );

  const upcoming = matchingBookings
    .filter(({ status }) => status === "Upcoming")
    .sort((a, b) =>
      sortOrder === "newest" ? compareMealDate(b, a) : compareMealDate(a, b),
    );

  const other = matchingBookings
    .filter(({ status }) => status !== "Upcoming")
    .sort((a, b) =>
      sortOrder === "oldest" ? compareMealDate(a, b) : compareMealDate(b, a),
    );

  // Changing a filter or the sort order resets each group's visible count.
  const filterKey = `${hikerId}:${statusFilter}:${dateFilter}:${sortOrder}`;

  return (
    <>
      {cancellationFeedback && (
        <Alert variant="success" role="status">
          {cancellationFeedback}
        </Alert>
      )}

      <div className="d-flex flex-wrap gap-3 mb-4">
        <Form.Group controlId="booking-status-filter">
          <Form.Label>Status</Form.Label>
          <Form.Select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            <option>All</option>
            <option>Upcoming</option>
            <option>Past</option>
            <option>Cancelled</option>
          </Form.Select>
        </Form.Group>

        <Form.Group controlId="booking-date-filter">
          <Form.Label>Date</Form.Label>
          <Form.Control
            type="date"
            value={dateFilter}
            onChange={(event) => setDateFilter(event.target.value)}
          />
        </Form.Group>

        <Form.Group controlId="booking-sort-order">
          <Form.Label>Sort by</Form.Label>
          <Form.Select
            value={sortOrder}
            onChange={(event) => setSortOrder(event.target.value)}
          >
            <option value="default">Default</option>
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
          </Form.Select>
        </Form.Group>
      </div>

      {matchingBookings.length === 0 && (
        <p role="status">No bookings match these filters.</p>
      )}

      <BookingGroup
        key={`upcoming:${filterKey}`}
        title="Upcoming bookings"
        bookings={upcoming}
        onCancel={openCancelModal}
        onEdit={openEditModal}
      />

      <BookingGroup
        key={`other:${filterKey}`}
        title="Past and cancelled bookings"
        bookings={other}
      />

      {editing && (
        <EditBookingModal
          booking={editing}
          onClose={() => setEditing(null)}
          onSaved={handleBookingSaved}
        />
      )}

      <BookingConfirmationModal
        reservation={updatedReservation}
        updated
        onClose={closeUpdateConfirmation}
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
 * @param {BookingWithStatus[]} props.bookings
 * @param {(booking: BookingDTO) => void} [props.onCancel]
 * @param {(booking: BookingDTO) => void} [props.onEdit]
 */
function BookingGroup({ title, bookings, onCancel, onEdit }) {
  const [visibleCount, setVisibleCount] = useState(BOOKINGS_PER_BATCH);

  if (bookings.length === 0) return null;

  const visibleBookings = bookings.slice(0, visibleCount);
  const hasMoreBookings = visibleBookings.length < bookings.length;
  const useTicketLayout = bookings.length < 3;

  return (
    <section className="mb-5" aria-label={title}>
      <h2 className="h4 mb-3">{title}</h2>

      <div className="row g-3">
        {visibleBookings.map(({ booking, status }) => (
          <div
            className={
              useTicketLayout
                ? "col-12 mh-booking-ticket-column"
                : "col-12 col-xl-4 mh-booking-column"
            }
            key={booking.id}
          >
            <BookingCard
              booking={booking}
              status={status}
              onCancel={onCancel}
              onEdit={onEdit}
            />
          </div>
        ))}
      </div>

      {bookings.length > BOOKINGS_PER_BATCH && (
        <div className="d-flex flex-column align-items-center gap-2 mt-4">
          <p className="small text-body-secondary mb-0" role="status">
            Showing {visibleBookings.length} of {bookings.length} bookings
          </p>

          {hasMoreBookings && (
            <Button
              type="button"
              variant="outline-secondary"
              onClick={() =>
                setVisibleCount((count) => count + BOOKINGS_PER_BATCH)
              }
            >
              Show more bookings
            </Button>
          )}
        </div>
      )}
    </section>
  );
}
