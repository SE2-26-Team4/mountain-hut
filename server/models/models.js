/**
 * @typedef {Object} CreateBookingRequestDTO
 * @property {string} bookingDate - Booking date in YYYY-MM-DD format.
 * @property {number} slotId
 * @property {number} partySize - Positive integer.
 * @property {string} [specialRequests] - Optional requests, max 1000 characters.
 */

/**
 * @typedef {Object} BookingTableAllocationDTO
 * @property {number} tableId
 * @property {number} seatsReserved - Positive integer.
 */

/**
 * @typedef {Object} BookingDTO
 * @property {number} id
 * @property {number} hikerId
 * @property {string} bookingDate - Booking date in YYYY-MM-DD format.
 * @property {number} slotId
 * @property {number} partySize
 * @property {string} [specialRequests] - Optional requests, max 1000 characters.
 * @property {'confirmed' | 'cancelled'} status
 * @property {BookingTableAllocationDTO[]} allocations
 */

/**
 * @typedef {Object} MealSlotDTO
 * @property {number} id
 * @property {string} slotDate - Calendar date in YYYY-MM-DD format.
 * @property {string} [bookingClosesAt] - Booking deadline supplied by the public slot listing.
 * @property {string} name
 * @property {string} startTime - Time in HH:mm format.
 * @property {string} endTime - Time in HH:mm format.
 * @property {boolean} isActive
 */

/**
 * @typedef {Object} DiningTableDTO
 * @property {number} id
 * @property {string} name
 * @property {number} seatCount - Positive integer.
 * @property {boolean} isActive
 */

/**
 * @typedef {Object} MealSlotInputDTO
 * @property {string} slotDate - Calendar date in YYYY-MM-DD format.
 * @property {string} name
 * @property {string} startTime - Time in HH:mm format.
 * @property {string} endTime - Time in HH:mm format.
 * @property {boolean} [isActive] - Defaults to true on creation; required on update.
 */

/**
 * @typedef {Object} DiningTableInputDTO
 * @property {string} name
 * @property {number} seatCount - Positive integer.
 * @property {boolean} [isActive] - Defaults to true on creation; required on update.
 */

/**
 * @typedef {Object} UpdateMealSlotCapacityRequestDTO
 * @property {number[]} tableIds - Complete set of assigned tables; empty to clear assignments.
 */

/**
 * @typedef {Object} WeeklyScheduleCopyRequestDTO
 * @property {string} sourceWeekStart - First date included in the source week.
 * @property {string} destinationWeekStart - First date included in the destination week.
 */

/**
 * @typedef {MealSlotDTO & { tableIds: number[] }} CopiedMealSlotDTO
 */

/**
 * @typedef {Object} MealSlotCapacityDTO
 * @property {number} slotId
 * @property {string} slotName
 * @property {DiningTableDTO[]} tables
 * @property {number} totalSeatCapacity - Total seats across assigned active tables.
 */

/**
 * @typedef {DiningTableDTO & {
 *   reservedSeats: number,
 *   availableSeats: number
 * }} DiningTableAvailabilityDTO
 */

/**
 * @typedef {Object} MealSlotAvailabilityDTO
 * @property {string} bookingDate - Booking date in YYYY-MM-DD format.
 * @property {string} bookingClosesAt - Booking deadline as an ISO timestamp.
 * @property {number} slotId
 * @property {string} slotName
 * @property {string} startTime - Time in HH:mm format.
 * @property {string} endTime - Time in HH:mm format.
 * @property {DiningTableAvailabilityDTO[]} tables
 * @property {number} totalAvailableSeats
 */

export {};