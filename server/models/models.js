// [Define booking DTOs]: Define the booking data contracts used by the server.
/**
 * @typedef {Object} CreateBookingRequestDTO
 * @property {string} bookingDate
 * @property {number} slotId
 * @property {number} partySize
 */

/**
 * @typedef {Object} BookingDTO
 * @property {number} id
 * @property {number} mealSlotId
 * @property {string} mealDate
 * @property {string} startTime
 * @property {string} endTime
 * @property {number} partySize
 * @property {string} status
 * @property {number[]} tableIds
 */

// [Define meal-slot and table-capacity DTOs]: Define the data contracts for meal slots and their assigned table capacity.
/**
 * @typedef {Object} MealSlotDTO
 * @property {number} id
 * @property {string} name
 * @property {string} startTime
 * @property {string} endTime
 * @property {boolean} isActive
 */

/**
 * @typedef {Object} DiningTableDTO
 * @property {number} id
 * @property {string} name
 * @property {number} seatCount
 * @property {boolean} isActive
 */

/**
 * @typedef {Object} UpdateMealSlotCapacityRequestDTO
 * @property {number[]} tableIds
 */

/**
 * @typedef {Object} MealSlotCapacityDTO
 * @property {number} slotId
 * @property {string} slotName
 * @property {DiningTableDTO[]} tables
 * @property {number} totalSeatCapacity
 */
