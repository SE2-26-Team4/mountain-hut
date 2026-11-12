/**
 * Data submitted when a hiker creates a booking.
 *
 * @typedef {Object} CreateBookingRequestDTO
 * @property {string} bookingDate - Booking date in YYYY-MM-DD format.
 * @property {number} slotId
 * @property {number} partySize - Positive integer.
 * @property {string} [specialRequests] - Optional requests, max 1000 characters.
 */

/**
 * Seats allocated to a booking at a specific table.
 *
 * @typedef {Object} BookingTableAllocationDTO
 * @property {number} tableId
 * @property {number} seatsReserved - Positive integer.
 */

/**
 * Saved booking details, including status and table allocations.
 *
 * @typedef {Object} BookingDTO
 * @property {number} id
 * @property {number} hikerId
 * @property {string} bookingDate - Booking date in YYYY-MM-DD format.
 * @property {number} slotId
 * @property {number} partySize
 * @property {string} [specialRequests] - Optional requests, max 1000 characters.
 * @property {'confirmed' | 'cancelled'} status
 * @property {BookingTableAllocationDTO[]} allocations
 * @property {string} [slotName]
 * @property {string} [slotStartTime]
 * @property {string} [slotEndTime]
 * @property {string} [editClosesAt] - Edit deadline as an ISO timestamp.
 */

/**
 * Configured meal slot with its date, times, and active status.
 *
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
 * Reusable dining table with its seat count and active status.
 *
 * @typedef {Object} DiningTableDTO
 * @property {number} id
 * @property {string} name
 * @property {number} seatCount - Positive integer.
 * @property {boolean} isActive
 */

/**
 * Data submitted when creating or updating a meal slot.
 *
 * @typedef {Object} MealSlotInputDTO
 * @property {string} slotDate - Calendar date in YYYY-MM-DD format.
 * @property {string} name
 * @property {string} startTime - Time in HH:mm format.
 * @property {string} endTime - Time in HH:mm format.
 * @property {boolean} [isActive] - Defaults to true on creation; required on update.
 */

/**
 * Data submitted when creating or updating a dining table.
 *
 * @typedef {Object} DiningTableInputDTO
 * @property {string} name
 * @property {number} seatCount - Positive integer.
 * @property {boolean} [isActive] - Defaults to true on creation; required on update.
 */

/**
 * Data submitted to replace all table assignments for a meal slot.
 *
 * @typedef {Object} UpdateMealSlotCapacityRequestDTO
 * @property {number[]} tableIds - Complete set of assigned tables; empty to clear assignments.
 */

/**
 * Assigned tables and total active seat capacity for a meal slot.
 *
 * @typedef {Object} MealSlotCapacityDTO
 * @property {number} slotId
 * @property {string} slotName
 * @property {DiningTableDTO[]} tables
 * @property {number} totalSeatCapacity - Total seats across assigned active tables.
 */

/**
 * Dining table enriched with reserved and available seat counts.
 *
 * @typedef {DiningTableDTO & {
 *   reservedSeats: number,
 *   availableSeats: number
 * }} DiningTableAvailabilityDTO
 */

/**
 * Availability details for a booking date and meal slot.
 *
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

// Treat this file as a module so its types can be imported through JSDoc.
export {};
