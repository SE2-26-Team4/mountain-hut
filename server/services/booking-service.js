import { getBookingsByDateAndSlot } from '../dao/booking-dao.js';
import {
  getMealSlotCapacity,
  getMealSlots,
} from '../dao/capacity-dao.js';

/**
 * @typedef {import('../models/models.js').BookingDTO} BookingDTO
 * @typedef {import('../models/models.js').DiningTableDTO} DiningTableDTO
 * @typedef {import('../models/models.js').DiningTableAvailabilityDTO} DiningTableAvailabilityDTO
 * @typedef {import('../models/models.js').MealSlotAvailabilityDTO} MealSlotAvailabilityDTO
 * @typedef {import('../models/models.js').BookingTableAllocationDTO} BookingTableAllocationDTO
 */

/* HELPERS */

/**
 * Calculates bookable seats from confirmed bookings.
 * Inactive tables and tables with reserved seats have no available seats.
 *
 * @param {DiningTableDTO[]} tables
 * @param {BookingDTO[]} bookings
 * @returns {DiningTableAvailabilityDTO[]}
 */
function calculateAvailableTables(tables, bookings) {
  const reservedSeatsByTable = new Map();

  for (const booking of bookings) {
    for (const allocation of booking.allocations ?? []) {
      const currentReservedSeats =
        reservedSeatsByTable.get(allocation.tableId) ?? 0;

      reservedSeatsByTable.set(
        allocation.tableId,
        currentReservedSeats + allocation.seatsReserved,
      );
    }
  }

  return tables.map((table) => {
    const reservedSeats = reservedSeatsByTable.get(table.id) ?? 0;
    const availableSeats =
      table.isActive && reservedSeats === 0
        ? table.seatCount
        : 0;
    return {
      ...table,
      reservedSeats,
      availableSeats,
    };
  });
}

/* SERVICE FUNCTIONS */

/**
 * Returns availability for a date and slot.
 * Returns null if the slot is missing or inactive.
 *
 * @param {string} bookingDate - Booking date in YYYY-MM-DD format.
 * @param {number} slotId
 * @returns {Promise<MealSlotAvailabilityDTO | null>}
 */
export async function getMealSlotAvailability(bookingDate, slotId) {
  const mealSlots = await getMealSlots();
  const mealSlot = mealSlots.find((slot) => slot.id === slotId);

  if (!mealSlot || !mealSlot.isActive) {
    return null;
  }

  const slotCapacity = await getMealSlotCapacity(slotId);

  if (!slotCapacity) {
    return null;
  }

  const bookings = await getBookingsByDateAndSlot(bookingDate, slotId);
  const tables = calculateAvailableTables(slotCapacity.tables, bookings);

  return {
    bookingDate,
    slotId: mealSlot.id,
    slotName: mealSlot.name,
    startTime: mealSlot.startTime,
    endTime: mealSlot.endTime,
    tables,
    totalAvailableSeats: tables.reduce(
      (total, table) => total + table.availableSeats,
      0,
    ),
  };
}

/**
 * Proposes allocations using tables with the most free seats first.
 * Returns null if capacity is insufficient. Does not persist reservations.
 *
 * @param {number} partySize - Positive integer.
 * @param {Array<Pick<DiningTableAvailabilityDTO, 'id' | 'isActive' | 'availableSeats'>>} availableTables
 * @returns {BookingTableAllocationDTO[] | null}
 * @throws {Error} If partySize is not a positive integer.
 * @throws {TypeError} If availableTables is not an array.
 */
export function allocateTablesForParty(partySize, availableTables) {
  if (!Number.isInteger(partySize) || partySize <= 0) {
    throw new Error('Party size must be a positive integer.');
  }

  if (!Array.isArray(availableTables)) {
    throw new TypeError('Available tables must be provided as an array.');
  }

  const candidateTables = availableTables
    .filter(
      (table) =>
        table.isActive &&
        Number.isFinite(table.availableSeats) &&
        table.availableSeats > 0,
    )
    .sort(
      (firstTable, secondTable) =>
        secondTable.availableSeats - firstTable.availableSeats ||
        firstTable.id - secondTable.id,
    );

  const totalAvailableSeats = candidateTables.reduce(
    (total, table) => total + table.availableSeats,
    0,
  );

  if (totalAvailableSeats < partySize) {
    return null;
  }

  /** @type {BookingTableAllocationDTO[]} */
  const allocations = [];
  let remainingSeats = partySize;

  for (const table of candidateTables) {
    if (remainingSeats === 0) {
      break;
    }

    const seatsReserved = Math.min(table.availableSeats, remainingSeats);

    allocations.push({
      tableId: table.id,
      seatsReserved,
    });

    remainingSeats -= seatsReserved;
  }

  return allocations;
}