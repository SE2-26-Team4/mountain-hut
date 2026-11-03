/**
 * @typedef {import('../../models/models.js').BookingDTO} BookingDTO
 */

/**
 * @param {Object} props
 * @param {BookingDTO} props.booking
 */
export default function BookingCard({ booking }) {
  const date = new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'long',
  }).format(new Date(`${booking.bookingDate}T12:00:00`));

  return (
    <article className="card h-100">
      <div className="card-body">
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
      </div>
    </article>
  );
}