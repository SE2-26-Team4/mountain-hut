import { formatBookingDate } from '../../utils/formatBookingDate.js';

/**
 * @typedef {import('../../models/models.js').BookingDTO} BookingDTO
 */

/**
 * @param {Object} props
 * @param {BookingDTO} props.booking
 * @param {(booking: BookingDTO) => void} [props.onCancel] - Shows the
 *   Cancel booking button when provided.
 */
export default function BookingCard({ booking, onCancel }) {
  const date = formatBookingDate(booking.bookingDate);

  return (
    <article className="card h-100">
      <div className="card-body d-flex flex-column">
        <h3 className="h5">Booking #{booking.id}</h3>

        <dl className="mb-0">
          <dt>Date</dt>
          <dd>{date}</dd>

          <dt>Meal slot</dt>
          <dd>#{booking.slotId}</dd>

          <dt>Party size</dt>
          <dd>{booking.partySize}</dd>

          <dt>Status</dt>
          <dd className="mb-0">
            {booking.status === 'confirmed'
              ? 'Confirmed'
              : 'Cancelled'}
          </dd>
        </dl>

        {onCancel && (
          <div className="d-flex justify-content-end mt-auto pt-4">
            <button
              type="button"
              className="mh-cancel-booking-button"
              onClick={() => onCancel(booking)}
              aria-label={`Cancel booking #${booking.id}`}
            >
              <i className="bi bi-x-circle" aria-hidden="true" />
              Cancel booking
            </button>
          </div>
        )}
      </div>
    </article>
  );
}
