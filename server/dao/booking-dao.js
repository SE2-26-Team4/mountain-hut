import { runAsync, getAsync, allAsync } from '../db.js';

/**
 * Creates a booking and assigns its tables atomically within a transaction.
 * If any step fails, the transaction is rolled back automatically.
 *
 * @param {Object} bookingData
 * @param {number} bookingData.hikerId
 * @param {string} bookingData.bookingDate - Format: YYYY-MM-DD
 * @param {number} bookingData.slotId
 * @param {number} bookingData.partySize
 * @param {string} [bookingData.status='confirmed']
 * @param {Array<{tableId: number, seatsReserved: number}>} allocations
 * @returns {Promise<Object>} The created booking, including its ID
 */
export async function createBooking(
  { hikerId, bookingDate, slotId, partySize, status = 'confirmed' },
  allocations = []
) {
  await runAsync('BEGIN TRANSACTION');

  try {
    const bookingResult = await runAsync(
      `INSERT INTO bookings (hiker_id, booking_date, slot_id, party_size, status)
       VALUES (?, ?, ?, ?, ?)`,
      [hikerId, bookingDate, slotId, partySize, status]
    );

    const bookingId = bookingResult.lastID;

    for (const alloc of allocations) {
      await runAsync(
        `INSERT INTO booking_table_allocations (booking_id, table_id, seats_reserved)
         VALUES (?, ?, ?)`,
        [bookingId, alloc.tableId, alloc.seatsReserved]
      );
    }

    await runAsync('COMMIT');

    return {
      id: bookingId,
      hikerId,
      bookingDate,
      slotId,
      partySize,
      status,
      allocations,
    };
  } catch (error) {
    await runAsync('ROLLBACK');
    throw error;
  }
}

/**
 * Retrieves a booking by ID together with its table allocations.
 */
export async function getBookingById(id) {
  const booking = await getAsync(
    `SELECT id, hiker_id AS hikerId, booking_date AS bookingDate, slot_id AS slotId,
            party_size AS partySize, status, created_at AS createdAt
     FROM bookings
     WHERE id = ?`,
    [id]
  );

  if (!booking) return null;

  const allocations = await allAsync(
    `SELECT table_id AS tableId, seats_reserved AS seatsReserved
     FROM booking_table_allocations
     WHERE booking_id = ?`,
    [id]
  );

  return { ...booking, allocations };
}

/**
 * Retrieves all bookings made by a specific hiker.
 */
export async function getBookingsByHiker(hikerId) {
  return allAsync(
    `SELECT id, hiker_id AS hikerId, booking_date AS bookingDate, slot_id AS slotId,
            party_size AS partySize, status, created_at AS createdAt
     FROM bookings
     WHERE hiker_id = ?
     ORDER BY booking_date DESC`,
    [hikerId]
  );
}

/**
 * Cancels a booking by updating its status to 'cancelled'.
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