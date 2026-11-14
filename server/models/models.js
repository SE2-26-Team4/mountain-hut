/**
 * @typedef {Object} CreateBookingRequestDTO
 * @property {string} bookingDate - Booking date in YYYY-MM-DD format.
 * @property {number} slotId
 * @property {number} partySize - Positive integer.
 * @property {string} [specialRequests] - Optional requests, max 1000 characters.
 * @property {string} [dietaryRequirements] - Optional dietary requirements, max 1000 characters.
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
 * @property {string} [dietaryRequirements] - Optional dietary requirements, max 1000 characters.
 * @property {'confirmed' | 'cancelled'} status
 * @property {BookingTableAllocationDTO[]} allocations
 * @property {string} [slotName]
 * @property {string} [slotStartTime]
 * @property {string} [slotEndTime]
 * @property {string} [editClosesAt] - Edit deadline as an ISO timestamp.
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

/**
 * Hiker profile as seen by staff. Temporary hikers can have an email address but cannot sign in.
 *
 * @typedef {Object} HikerDTO
 * @property {number} id
 * @property {string} fullName
 * @property {string | null} email
 * @property {string | null} phone
 * @property {string | null} notes
 * @property {string | null} emergencyContact
 * @property {boolean} isTemporary - True when the hiker cannot log in.
 * @property {boolean} mustChangePassword - True until the first password change.
 */

/**
 * Hiker selected or entered by staff for a booking.
 * - existing: a registered or temporary hiker found by searching;
 * - new: a full account that can log in with a generated password;
 * - temporary: name and optional phone, without web access.
 *
 * @typedef {(
 *   { type: 'existing', hikerId: number } |
 *   {
 *     type: 'new',
 *     fullName: string,
 *     email: string,
 *     phone?: string | null,
 *     notes?: string | null,
 *     emergencyContact?: string | null
 *   } |
 *   { type: 'temporary', fullName: string, phone?: string | null }
 * )} StaffHikerInputDTO
 */

/**
 * @typedef {CreateBookingRequestDTO & {
 *   hiker: StaffHikerInputDTO
 * }} CreateStaffBookingRequestDTO
 */

/**
 * Hiker created by staff. The initial password is sent by email only.
 *
 * @typedef {Object} StaffHikerRegistrationDTO
 * @property {HikerDTO} hiker
 * @property {boolean} [passwordSent]
 * @property {string} [initialPassword] - Internal value used only to send the email.
 */

/**
 * @typedef {StaffHikerRegistrationDTO & {
 *   booking: BookingDTO
 * }} StaffBookingDTO
 */

export {};
