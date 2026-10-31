import {withTransaction } from '../db.js';

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

/* HELPERS */

export class BookingError extends Error {
  /**
   * @param {string} code
   * @param {string} message
   */
  constructor(code, message) {
    super(message);
    this.name = 'BookingError';
    this.code = code;
  }
}

/* CREATE */

/**
 * Creates a booking after checking availability and allocating seats
 * within the same transaction.
 *
 * @param {BookingInsertData} bookingData
 * @returns {Promise<BookingDTO>}
 */
export async function createBooking({
  hikerId,
  bookingDate,
  slotId,
  partySize,
}) {
  if (!Number.isSafeInteger(partySize) || partySize <= 0) {
    throw new BookingError(
      'INVALID_PARTY_SIZE',
      'Party size must be a positive integer.'
    );
  }

  return withTransaction(async ({ runAsync, getAsync, allAsync }) => {
    // Check the slot inside the transaction.
    const slot = await getAsync(
      `SELECT id, is_active AS isActive
       FROM meal_slots
       WHERE id = ?`,
      [slotId]
    );

    if (!slot) {
      throw new BookingError('SLOT_NOT_FOUND', 'Meal slot not found.');
    }

    if (!slot.isActive) {
      throw new BookingError(
        'SLOT_INACTIVE',
        'This meal slot is not available.'
      );
    }

    // Count only confirmed bookings for this date and slot.
    // Cancelled bookings do not occupy seats.
    /** @type {{ tableId: number, availableSeats: number }[]} */
    const tables = await allAsync(
      `SELECT
        t.id AS tableId,
        t.seat_count AS availableSeats
      FROM slot_tables AS st
      JOIN dining_tables AS t ON t.id = st.table_id
      WHERE st.slot_id = ?
        AND t.is_active = 1
        AND NOT EXISTS (
          SELECT 1
          FROM booking_table_allocations AS a
          JOIN bookings AS b ON b.id = a.booking_id
          WHERE a.table_id = t.id
            AND b.booking_date = ?
            AND b.slot_id = ?
            AND b.status = 'confirmed'
        )
      ORDER BY t.id`,
      [slotId, bookingDate, slotId]
    );

    /** @type {BookingTableAllocationDTO[]} */
    const allocations = [];

    // Prefer a single table, choosing the smallest suitable remainder.
    const singleTable = tables
      .filter((table) => table.availableSeats >= partySize)
      .sort(
        (a, b) =>
          a.availableSeats - b.availableSeats ||
          a.tableId - b.tableId
      )[0];

    if (singleTable) {
      allocations.push({
        tableId: singleTable.tableId,
        seatsReserved: partySize,
      });
    } else {
      const candidates = tables
        .filter((table) => table.availableSeats > 0)
        .sort(
          (a, b) =>
            b.availableSeats - a.availableSeats ||
            a.tableId - b.tableId
        );

      let remainingSeats = partySize;

      for (const table of candidates) {
        const seatsReserved = Math.min(
          table.availableSeats,
          remainingSeats
        );

        allocations.push({
          tableId: table.tableId,
          seatsReserved,
        });

        remainingSeats -= seatsReserved;

        if (remainingSeats === 0) break;
      }

      if (remainingSeats > 0) {
        throw new BookingError(
          'NO_AVAILABILITY',
          'There are not enough available seats.'
        );
      }
    }

    const bookingResult = await runAsync(
      `INSERT INTO bookings (
         hiker_id, booking_date, slot_id, party_size
       )
       VALUES (?, ?, ?, ?)`,
      [hikerId, bookingDate, slotId, partySize]
    );

    const bookingId = bookingResult.lastID;

    for (const allocation of allocations) {
      await runAsync(
        `INSERT INTO booking_table_allocations (
           booking_id, table_id, seats_reserved
         )
         VALUES (?, ?, ?)`,
        [bookingId, allocation.tableId, allocation.seatsReserved]
      );
    }

    /** @type {BookingRow} */
    const savedBooking = await getAsync(
      `SELECT
         id,
         hiker_id AS hikerId,
         booking_date AS bookingDate,
         slot_id AS slotId,
         party_size AS partySize,
         status
       FROM bookings
       WHERE id = ?`,
      [bookingId]
    );

    return { ...savedBooking, allocations };
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
  return withTransaction(async ({ getAsync, allAsync }) => {
    /** @type {BookingRow | undefined} */
    const booking = await getAsync(
      `SELECT id, hiker_id AS hikerId, booking_date AS bookingDate,
              slot_id AS slotId, party_size AS partySize, status
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
  });
}

/**
 * Retrieves all bookings made by a specific hiker.
 *
 * @param {number} hikerId
 * @returns {Promise<BookingDTO[]>}
 */
export async function getBookingsByHiker(hikerId) {
  return withTransaction(async ({ allAsync }) => {
    /** @type {BookingRow[]} */
    const bookings = await allAsync(
      `SELECT id, hiker_id AS hikerId, booking_date AS bookingDate,
              slot_id AS slotId, party_size AS partySize, status
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
  });
}

/**
 * Returns confirmed bookings and their table allocations for a date and slot.
 *
 * @param {string} bookingDate - Booking date in YYYY-MM-DD format.
 * @param {number} slotId
 * @returns {Promise<BookingDTO[]>}
 */
export async function getBookingsByDateAndSlot(bookingDate, slotId) {
  return withTransaction(async ({ allAsync }) => {
    /** @type {BookingRow[]} */
    const bookings = await allAsync(
      `SELECT id, hiker_id AS hikerId, booking_date AS bookingDate,
              slot_id AS slotId, party_size AS partySize, status
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
          `SELECT table_id AS tableId, seats_reserved AS seatsReserved
           FROM booking_table_allocations
           WHERE booking_id = ?
           ORDER BY table_id`,
          [booking.id]
        );

        return { ...booking, allocations };
      })
    );
  });
}

/* UPDATE */

/**
 * Cancels a booking by updating its status to 'cancelled'.
 *
 * @param {number} id
 * @returns {Promise<boolean>} Whether a confirmed booking was cancelled.
 */
export async function cancelBooking(id) {
  return withTransaction(async ({ runAsync }) => {
    const result = await runAsync(
      `UPDATE bookings
       SET status = 'cancelled'
       WHERE id = ? AND status = 'confirmed'`,
      [id]
    );

    return result.changes > 0;
  });
}
