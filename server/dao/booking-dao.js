import { withTransaction } from '../db.js';
import {
  getBookingDeadline,
  getMealStartTimestamp,
} from '../services/booking-time.js';
import {
  createHiker,
  getHikerById,
  isEmailRegistered,
} from './auth-dao.js';

/**
 * Data types used to create and retrieve bookings.
 *
 * @typedef {import('../models/models.js').CreateBookingRequestDTO} CreateBookingRequestDTO
 * @typedef {import('../models/models.js').BookingDTO} BookingDTO
 * @typedef {import('../models/models.js').BookingTableAllocationDTO} BookingTableAllocationDTO
 * @typedef {import('../models/models.js').HikerDTO} HikerDTO
 * @typedef {import('./auth-dao.js').NewHikerRecord} NewHikerRecord
 * @typedef {import('../db.js').TransactionQueries} TransactionQueries
 */

/**
 * Booking input enriched with the authenticated hiker's ID.
 *
 * @typedef {CreateBookingRequestDTO & {
 *   hikerId: number
 * }} BookingInsertData
 */

/**
 * Hiker chosen by staff: an existing hiker or a new account to create.
 *
 * @typedef {(
 *   { existingHikerId: number } |
 *   { newHiker: NewHikerRecord }
 * )} StaffBookingHiker
 */

/**
 * Booking fields stored separately from table allocations.
 *
 * @typedef {Omit<BookingDTO, 'allocations'>} BookingRow
 */

// Represent booking failures with a code that API routes can handle.
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

/**
 * Validates the booking fields that do not require the database.
 *
 * @param {number} partySize
 * @param {string} specialRequests
 */
function validateBookingFields(partySize, specialRequests) {
  // Require a positive whole number of guests within the safe integer range.
  if (!Number.isSafeInteger(partySize) || partySize <= 0) {
    throw new BookingError(
      'INVALID_PARTY_SIZE',
      'Party size must be a positive integer.'
    );
  }

  // Require optional requests to be text with at most 1,000 characters.
  if (
    typeof specialRequests !== 'string' ||
    specialRequests.length > 1000
  ) {
    throw new BookingError(
      'INVALID_BOOKING',
      'Special requests must be text of at most 1000 characters.'
    );
  }
}

/**
 * Checks availability, allocates seats and saves a booking.
 * It must run inside an open transaction, so that the checks and the
 * inserts are atomic together with any other change of the caller.
 *
 * Hikers can book up to two hours before the meal service starts;
 * staff can book until the service starts.
 *
 * @param {TransactionQueries} queries
 * @param {BookingInsertData & { specialRequests: string }} bookingData
 * @param {boolean} bookedByStaff
 * @returns {Promise<BookingDTO>}
 */
async function insertBooking(
  { runAsync, getAsync, allAsync },
  {
    hikerId,
    bookingDate,
    slotId,
    partySize,
    specialRequests,
  },
  bookedByStaff
) {
  // Retrieve the selected slot's date, start time, and active status.
  const slot = await getAsync(
    `SELECT
       id,
       slot_date AS slotDate,
       start_time AS startTime,
       is_active AS isActive
     FROM meal_slots
     WHERE id = ?`,
    [slotId]
  );

  // Reject a slot that does not exist.
  if (!slot) {
    throw new BookingError(
      'SLOT_NOT_FOUND',
      'Meal slot not found.'
    );
  }

  // Prevent booking a slot using a date different from its configured date.
  if (slot.slotDate !== bookingDate) {
    throw new BookingError(
      'INVALID_BOOKING',
      'The selected meal slot does not belong to the booking date.'
    );
  }

  // Reject slots that staff have made inactive.
  if (!slot.isActive) {
    throw new BookingError(
      'SLOT_INACTIVE',
      'This meal slot is not available.'
    );
  }

  // Calculate the booking deadline using the hut's time zone:
  // two hours before the service for hikers, its start for staff.
  let bookingDeadline;

  try {
    bookingDeadline = bookedByStaff
      ? getMealStartTimestamp(bookingDate, slot.startTime)
      : getBookingDeadline(bookingDate, slot.startTime);
  } catch {
    throw new BookingError(
      'INVALID_BOOKING',
      'The selected meal time is not valid in the hut time zone.'
    );
  }

  if (bookedByStaff) {
    // Staff cannot book a service that has already started.
    if (Date.now() >= bookingDeadline) {
      throw new BookingError(
        'BOOKING_TOO_LATE',
        'Bookings cannot be made after the meal service has started.'
      );
    }
  } else if (Date.now() > bookingDeadline) {
    // Hikers can book up to the deadline, including the deadline itself.
    throw new BookingError(
      'BOOKING_TOO_LATE',
      'Bookings close two hours before the meal service starts.'
    );
  }

  // Check whether this hiker already has a confirmed booking for the slot.
  const existingBooking = await getAsync(
    `SELECT id
     FROM bookings
     WHERE hiker_id = ?
       AND booking_date = ?
       AND slot_id = ?
       AND status = 'confirmed'
     LIMIT 1`,
    [hikerId, bookingDate, slotId]
  );

  if (existingBooking) {
    throw new BookingError(
      'DUPLICATE_BOOKING',
      bookedByStaff
        ? 'This hiker already has a confirmed booking for this date and meal service.'
        : 'You already have a confirmed booking for this date and meal service.'
    );
  }

  // Calculate free seats for active tables assigned to this slot.
  // Only confirmed bookings for the same date and slot occupy seats.
  /** @type {{ tableId: number, availableSeats: number }[]} */
  const tables = await allAsync(
    `SELECT
       t.id AS tableId,
       t.seat_count - COALESCE((
         SELECT SUM(a.seats_reserved)
         FROM booking_table_allocations AS a
         JOIN bookings AS b ON b.id = a.booking_id
         WHERE a.table_id = t.id
           AND b.booking_date = ?
           AND b.slot_id = ?
           AND b.status = 'confirmed'
       ), 0) AS availableSeats
     FROM slot_tables AS st
     JOIN dining_tables AS t ON t.id = st.table_id
     WHERE st.slot_id = ?
       AND t.is_active = 1
     ORDER BY t.id`,
    [bookingDate, slotId, slotId]
  );

  // Collect the exact number of seats reserved at each selected table.
  /** @type {BookingTableAllocationDTO[]} */
  const allocations = [];

  // Prefer one table with the smallest sufficient number of free seats.
  // Use the lowest table ID to break ties.
  const singleTable = tables
    .filter((table) => table.availableSeats >= partySize)
    .sort(
      (a, b) =>
        a.availableSeats - b.availableSeats ||
        a.tableId - b.tableId
    )[0];

  if (singleTable) {
    // Keep the whole party together without reserving unused seats.
    allocations.push({
      tableId: singleTable.tableId,
      seatsReserved: partySize,
    });
  } else {
    // Consider tables with free seats, ordered by descending availability.
    const candidates = tables
      .filter((table) => table.availableSeats > 0)
      .sort(
        (a, b) =>
          b.availableSeats - a.availableSeats ||
          a.tableId - b.tableId
      );

    // Determine the minimum number of tables needed for the party.
    let minimumTableCount = 0;
    let maximumSeats = 0;

    for (const table of candidates) {
      maximumSeats += table.availableSeats;
      minimumTableCount += 1;

      if (maximumSeats >= partySize) break;
    }

    // Reject insufficient capacity before inserting any booking records.
    if (maximumSeats < partySize) {
      throw new BookingError(
        'NO_AVAILABILITY',
        'There are not enough available seats.'
      );
    }

    /**
     * Available table considered when splitting the party.
     *
     * @typedef {{
     *   tableId: number,
     *   availableSeats: number
     * }} Candidate
     */

    // Store partial combinations by table count and total free seats.
    // Combinations with the same count and capacity are interchangeable
    // for the capacity optimization.
    /** @type {Map<number, Candidate[]>[]} */
    const combinations = Array.from(
      { length: minimumTableCount },
      () => new Map()
    );

    // Start with an empty combination containing no seats and no tables.
    combinations[0].set(0, []);

    // Track the sufficient combination with the smallest total capacity.
    /** @type {Candidate[] | null} */
    let bestCombination = null;
    let bestCapacity = Infinity;

    for (const table of candidates) {
      // Descending counts prevent adding the same table more than once.
      for (
        let count = minimumTableCount - 1;
        count >= 0;
        count -= 1
      ) {
        // Extend each known partial combination with the current table.
        for (const [capacity, selected] of combinations[count]) {
          const nextCapacity = capacity + table.availableSeats;
          const nextSelected = [...selected, table];

          if (count + 1 === minimumTableCount) {
            // Among combinations using the minimum number of tables,
            // choose the smallest total capacity that fits the party.
            if (
              nextCapacity >= partySize &&
              nextCapacity < bestCapacity
            ) {
              bestCapacity = nextCapacity;
              bestCombination = nextSelected;
            }
          } else if (
            nextCapacity < partySize &&
            !combinations[count + 1].has(nextCapacity)
          ) {
            // Keep partial combinations for later tables to extend.
            combinations[count + 1].set(
              nextCapacity,
              nextSelected
            );
          }
        }
      }
    }

    // Reserve exactly the party size across the chosen tables.
    // Any unused seats remain available for other parties.
    let remainingSeats = partySize;

    for (const table of /** @type {Candidate[]} */ (bestCombination)) {
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
  }

  // Save the booking details, including normalized special requests.
  const bookingResult = await runAsync(
    `INSERT INTO bookings (
       hiker_id,
       booking_date,
       slot_id,
       party_size,
       special_requests
     )
     VALUES (?, ?, ?, ?, ?)`,
    [
      hikerId,
      bookingDate,
      slotId,
      partySize,
      specialRequests,
    ]
  );

  // Use the generated booking ID to link its table allocations.
  const bookingId = bookingResult.lastID;

  // Persist each table allocation within the same transaction.
  for (const allocation of allocations) {
    await runAsync(
      `INSERT INTO booking_table_allocations (
         booking_id,
         table_id,
         seats_reserved
       )
       VALUES (?, ?, ?)`,
      [
        bookingId,
        allocation.tableId,
        allocation.seatsReserved,
      ]
    );
  }

  // Read the saved booking using the property names expected by the API.
  /** @type {BookingRow} */
  const savedBooking = await getAsync(
    `SELECT
       id,
       hiker_id AS hikerId,
       booking_date AS bookingDate,
       slot_id AS slotId,
       party_size AS partySize,
       special_requests AS specialRequests,
       status
     FROM bookings
     WHERE id = ?`,
    [bookingId]
  );

  // Return the saved booking together with its seat allocations.
  return { ...savedBooking, allocations };
}

/**
 * Creates a booking for a hiker and allocates seats atomically.
 *
 * @param {BookingInsertData} bookingData
 * @returns {Promise<BookingDTO>}
 */
export async function createBooking({
  hikerId,
  bookingDate,
  slotId,
  partySize,
  specialRequests = '',
}) {
  validateBookingFields(partySize, specialRequests);

  // Check availability and save all booking records atomically.
  return withTransaction((queries) =>
    insertBooking(
      queries,
      {
        hikerId,
        bookingDate,
        slotId,
        partySize,
        // Remove surrounding whitespace before saving the requests.
        specialRequests: specialRequests.trim(),
      },
      false
    )
  );
}

/* STAFF BOOKINGS */

/**
 * Inserts a hiker created by staff once the email is known to be free.
 * It must run inside an open transaction.
 *
 * @param {TransactionQueries} queries
 * @param {NewHikerRecord} newHiker
 * @returns {Promise<HikerDTO>}
 */
async function insertNewHiker(queries, newHiker) {
  // Temporary hikers have no email, so only full accounts can conflict.
  if (
    newHiker.email !== null &&
    (await isEmailRegistered(queries, newHiker.email))
  ) {
    throw new BookingError(
      'EMAIL_ALREADY_REGISTERED',
      'An account with this email already exists.'
    );
  }

  return createHiker(queries, newHiker);
}

/**
 * Registers a full or temporary hiker on behalf of staff, without a booking.
 *
 * @param {NewHikerRecord} newHiker
 * @returns {Promise<HikerDTO>}
 */
export async function registerHiker(newHiker) {
  return withTransaction((queries) =>
    insertNewHiker(queries, newHiker)
  );
}

/**
 * Creates a booking entered by staff for an existing hiker or for a hiker
 * created together with the booking. Both are saved in one transaction:
 * if the booking is rejected (e.g. no availability), no account is created.
 *
 * @param {CreateBookingRequestDTO & { hiker: StaffBookingHiker }} bookingData
 * @returns {Promise<{ booking: BookingDTO, hiker: HikerDTO }>}
 */
export async function createStaffBooking({
  hiker,
  bookingDate,
  slotId,
  partySize,
  specialRequests = '',
}) {
  validateBookingFields(partySize, specialRequests);

  return withTransaction(async (queries) => {
    /** @type {HikerDTO | undefined} */
    let bookedHiker;

    if ('newHiker' in hiker) {
      bookedHiker = await insertNewHiker(queries, hiker.newHiker);
    } else {
      // Staff accounts are reported as missing: only hikers can be booked.
      bookedHiker = await getHikerById(queries, hiker.existingHikerId);

      if (!bookedHiker) {
        throw new BookingError(
          'HIKER_NOT_FOUND',
          'The selected hiker was not found.'
        );
      }
    }

    // Reuse the same availability checks and table allocation as hikers,
    // with the staff time limit.
    const booking = await insertBooking(
      queries,
      {
        hikerId: bookedHiker.id,
        bookingDate,
        slotId,
        partySize,
        specialRequests: specialRequests.trim(),
      },
      true
    );

    return { booking, hiker: bookedHiker };
  });
}

/**
 * Retrieves a booking together with its table allocations.
 *
 * @param {number} id
 * @returns {Promise<BookingDTO | null>}
 */
export async function getBookingById(id) {
  // Read booking details and allocations within the same transaction.
  return withTransaction(async ({ getAsync, allAsync }) => {
    // Retrieve the booking record, including its special requests.
    /** @type {BookingRow | undefined} */
    const booking = await getAsync(
      `SELECT
         id,
         hiker_id AS hikerId,
         booking_date AS bookingDate,
         slot_id AS slotId,
         party_size AS partySize,
         special_requests AS specialRequests,
         status
       FROM bookings
       WHERE id = ?`,
      [id]
    );

    // Report a missing booking without querying its allocations.
    if (!booking) return null;

    // Retrieve the seats assigned to each table in a stable order.
    /** @type {BookingTableAllocationDTO[]} */
    const allocations = await allAsync(
      `SELECT
         table_id AS tableId,
         seats_reserved AS seatsReserved
       FROM booking_table_allocations
       WHERE booking_id = ?
       ORDER BY table_id`,
      [id]
    );

    // Combine the booking details and table allocations.
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
  // Read the hiker's bookings and their allocations in one transaction.
  return withTransaction(async ({ allAsync }) => {
    // Include every status and list the most recent booking dates first.
    /** @type {BookingRow[]} */
    const bookings = await allAsync(
      `SELECT
         id,
         hiker_id AS hikerId,
         booking_date AS bookingDate,
         slot_id AS slotId,
         party_size AS partySize,
         special_requests AS specialRequests,
         status
       FROM bookings
       WHERE hiker_id = ?
       ORDER BY booking_date DESC, id DESC`,
      [hikerId]
    );

    // Load allocations for each booking and return the complete records.
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
  });
}

/**
 * Returns confirmed bookings for a date and slot.
 *
 * @param {string} bookingDate - Format: YYYY-MM-DD.
 * @param {number} slotId
 * @returns {Promise<BookingDTO[]>}
 */
export async function getBookingsByDateAndSlot(
  bookingDate,
  slotId
) {
  // Read confirmed bookings and their allocations in one transaction.
  return withTransaction(async ({ allAsync }) => {
    // Exclude cancelled bookings because they no longer occupy seats.
    /** @type {BookingRow[]} */
    const bookings = await allAsync(
      `SELECT
         id,
         hiker_id AS hikerId,
         booking_date AS bookingDate,
         slot_id AS slotId,
         party_size AS partySize,
         special_requests AS specialRequests,
         status
       FROM bookings
       WHERE booking_date = ?
         AND slot_id = ?
         AND status = 'confirmed'
       ORDER BY id`,
      [bookingDate, slotId]
    );

    // Attach table allocations so callers can calculate occupied seats.
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
  });
}

/**
 * Cancels a confirmed booking.
 *
 * @param {number} id
 * @param {number} [hikerId] - Restricts cancellation to the owner.
 * @returns {Promise<boolean>}
 */
export async function cancelBooking(id, hikerId) {
  return withTransaction(async ({ runAsync }) => {
    // Restrict the update to the owner when a hiker ID is provided.
    const ownerCondition =
      hikerId === undefined ? '' : ' AND hiker_id = ?';

    // Match the parameters to the optional ownership condition.
    const params =
      hikerId === undefined ? [id] : [id, hikerId];

    // Change only confirmed bookings and preserve their stored allocations.
    // Availability calculations ignore allocations of cancelled bookings.
    const result = await runAsync(
      `UPDATE bookings
       SET status = 'cancelled'
       WHERE id = ?
         AND status = 'confirmed'${ownerCondition}`,
      params
    );

    // Return true only when a confirmed booking was actually cancelled.
    return result.changes > 0;
  });
}