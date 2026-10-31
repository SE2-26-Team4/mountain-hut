/*
 * Booking API routes.
 * GET /bookings/availability: return availability for a date and slot.
 * POST /bookings: require the hiker role and use the authenticated user ID.
 * Delegate input validation to the booking service.
 * The booking DAO checks availability and allocates tables atomically.
 * Map application errors to the corresponding HTTP responses.
 */