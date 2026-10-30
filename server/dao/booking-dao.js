import { runAsync, getAsync, allAsync, withTransaction } from '../db.js';

/**
 * @typedef {import('../models/models.js').CreateBookingRequestDTO} CreateBookingRequestDTO
 * @typedef {import('../models/models.js').BookingDTO} BookingDTO
 * @typedef {import('../models/models.js').BookingTableAllocationDTO} BookingTableAllocationDTO
 */

/**
 * Data required to persist a booking for the authenticated hiker.
 *
 * @typedef {CreateBookingRequestDTO & {
 *   hikerId: number
 * }} BookingInsertData
 */

/**
 * Booking fields stored separately from table allocations.
 *
 * @typedef {Omit<BookingDTO, 'allocations'>} BookingRow
 */

/* CREATE */

/**
 * Creates a booking and assigns its tables atomically within a transaction.
 * If any step fails, the transaction is rolled back automatically.
 *
 * @param {BookingInsertData} bookingData
 * @param {BookingTableAllocationDTO[]} allocations
 * @returns {Promise<BookingDTO>} The created booking, including its ID
 */
export async function createBooking(
  { hikerId, bookingDate, slotId, partySize },
  allocations = []
) {
  return withTransaction(async ({ runAsync, getAsync, allAsync }) => {
    const bookingResult = await runAsync(
      `INSERT INTO bookings (hiker_id, booking_date, slot_id, party_size)
       VALUES (?, ?, ?, ?)`,
      [hikerId, bookingDate, slotId, partySize]
    );

    const bookingId = bookingResult.lastID;

    for (const alloc of allocations) {
      await runAsync(
        `INSERT INTO booking_table_allocations (booking_id, table_id, seats_reserved)
         VALUES (?, ?, ?)`,
        [bookingId, alloc.tableId, alloc.seatsReserved]
      );
    }

    /** @type {BookingRow} */
    const savedBooking = await getAsync(
      `SELECT id, hiker_id AS hikerId, booking_date AS bookingDate,
              slot_id AS slotId, party_size AS partySize, status
       FROM bookings
       WHERE id = ?`,
      [bookingId]
    );

    /** @type {BookingTableAllocationDTO[]} */
    const savedAllocations = await allAsync(
      `SELECT table_id AS tableId, seats_reserved AS seatsReserved
       FROM booking_table_allocations
       WHERE booking_id = ?
       ORDER BY table_id`,
      [bookingId]
    );

    return { ...savedBooking, allocations: savedAllocations };
  });
}

/* READ */

/**
 * Retrieves a booking by ID together with its table allocations.
 *
 * @param {number} id
 * @returns {Promise<BookingDTO | null>}
 */
export async function getBookingById(id) {
  /** @type {BookingRow | undefined} */
  const booking = await getAsync(
    `SELECT id, hiker_id AS hikerId, booking_date AS bookingDate, slot_id AS slotId,
            party_size AS partySize, status
     FROM bookings
     WHERE id = ?`,
    [id]
  );

  if (!booking) return null;

  /** @type {BookingTableAllocationDTO[]} */
  const allocations = await allAsync(
    `SELECT table_id AS tableId, seats_reserved AS seatsReserved
     FROM booking_table_allocations
     WHERE booking_id = ?
     ORDER BY table_id`,
    [id]
  );

  return { ...booking, allocations };
}

/**
 * Retrieves all bookings made by a specific hiker.
 *
 * @param {number} hikerId
 * @returns {Promise<BookingDTO[]>}
 */
export async function getBookingsByHiker(hikerId) {
  /** @type {BookingRow[]} */
  const bookings = await allAsync(
    `SELECT id, hiker_id AS hikerId, booking_date AS bookingDate, slot_id AS slotId,
            party_size AS partySize, status
     FROM bookings
     WHERE hiker_id = ?
     ORDER BY booking_date DESC, id DESC`,
    [hikerId]
  );

  return Promise.all(
    bookings.map(async (booking) => {
      /** @type {BookingTableAllocationDTO[]} */
      const allocations = await allAsync(
        `SELECT table_id AS tableId, seats_reserved AS seatsReserved
         FROM booking_table_allocations
         WHERE booking_id = ?
         ORDER BY table_id`,
        [booking.id]
      );

      return { ...booking, allocations };
    })
  );
}

/**
 * Returns confirmed bookings and their table allocations for a date and slot.
 *
 * @param {string} bookingDate - Booking date in YYYY-MM-DD format.
 * @param {number} slotId
 * @returns {Promise<BookingDTO[]>}
 */
export async function getBookingsByDateAndSlot(bookingDate, slotId) {
  /** @type {BookingRow[]} */
  const bookings = await allAsync(
    `SELECT
       id,
       hiker_id AS hikerId,
       booking_date AS bookingDate,
       slot_id AS slotId,
       party_size AS partySize,
       status
     FROM bookings
     WHERE booking_date = ?
       AND slot_id = ?
       AND status = 'confirmed'
     ORDER BY id`,
    [bookingDate, slotId]
  );

  return Promise.all(
    bookings.map(async (booking) => {
      /** @type {BookingTableAllocationDTO[]} */
      const allocations = await allAsync(
        `SELECT
           table_id AS tableId,
           seats_reserved AS seatsReserved
         FROM booking_table_allocations
         WHERE booking_id = ?
         ORDER BY table_id`,
        [booking.id]
      );

      return { ...booking, allocations };
    })
  );
}

/* UPDATE */

/**
 * Cancels a booking by updating its status to 'cancelled'.
 *
 * @param {number} id
 * @returns {Promise<boolean>} Whether a confirmed booking was cancelled.
 */
export async function cancelBooking(id) {
  const result = await runAsync(
    `UPDATE bookings
     SET status = 'cancelled'
     WHERE id = ? AND status = 'confirmed'`,
    [id]
  );

  return result.changes > 0;
}

