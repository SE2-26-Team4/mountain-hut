/**
 * @typedef {import('../models/models.js').MealSlotDTO} MealSlotDTO
 * @typedef {import('../models/models.js').MealSlotAvailabilityDTO} MealSlotAvailabilityDTO
 * @typedef {import('../models/models.js').CreateBookingRequestDTO} CreateBookingRequestDTO
 * @typedef {import('../models/models.js').BookingDTO} BookingDTO
 */

const API_URL = (
  import.meta.env.VITE_API_BASE_URL ?? '/api'
).replace(/\/$/, '');

class BookingApiError extends Error {
  /**
   * @param {string} message
   * @param {number} status
   * @param {string} [code]
   */
  constructor(message, status, code) {
    super(message);

    this.name = 'BookingApiError';
    this.status = status;
    this.code = code;
  }
}

/**
 * Includes the session cookie and reports unsuccessful HTTP responses.
 *
 * @param {string} path
 * @param {RequestInit} [options]
 * @returns {Promise<any>}
 */
async function request(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
  });

  const data =
    response.status === 204
      ? null
      : await response.json().catch(() => null);

  if (!response.ok) {
    throw new BookingApiError(
      data?.error?.message ?? 'The booking request could not be completed.',
      response.status,
      data?.error?.code,
    );
  }

  return data;
}

/**
 * @returns {Promise<MealSlotDTO[]>}
 */
async function getMealSlots() {
  /** @type {{ mealSlots: MealSlotDTO[] }} */
  const data = await request('/meal-slots');

  return data.mealSlots;
}

/**
 * @param {string} bookingDate - Booking date in YYYY-MM-DD format.
 * @param {number} slotId
 * @returns {Promise<MealSlotAvailabilityDTO>}
 */
async function getAvailability(bookingDate, slotId) {
  const query = new URLSearchParams({
    bookingDate,
    slotId: String(slotId),
  });

  /** @type {{ availability: MealSlotAvailabilityDTO }} */
  const data = await request(`/bookings/availability?${query}`);

  return data.availability;
}

/**
 * @param {CreateBookingRequestDTO} booking
 * @returns {Promise<{ booking: BookingDTO, emailSent: boolean }>}
 */
async function createBooking(booking) {
  /** @type {{ booking: BookingDTO, emailSent: boolean }} */
  const data = await request('/bookings', {
    method: 'POST',
    body: JSON.stringify(booking),
  });

  return data;
}


/**
 * @param {string} [search]
 * @returns {Promise<any[]>}
 */
async function searchHikers(search) {
  const query = search ? `?${new URLSearchParams({ search })}` : '';
  /** @type {{ hikers: any[] }} */
  const data = await request(`/staff/hikers${query}`);

  return data.hikers;
}

/**
 * @param {{ full_name: string, email: string }} hiker
 * @returns {Promise<any>}
 */
async function createHiker(hiker) {
  /** @type {{ hiker: any }} */
  const data = await request('/staff/hikers', {
    method: 'POST',
    body: JSON.stringify(hiker),
  });

  return data.hiker;
}

/**
 * @param {{ hikerId: number, bookingDate: string, slotId: number, partySize: number, specialRequests?: string }} booking
 * @returns {Promise<{ booking: BookingDTO, emailSent: boolean }>}
 */
async function createStaffBooking(booking) {
  /** @type {{ booking: BookingDTO, emailSent: boolean }} */
  const data = await request('/staff/bookings', {
    method: 'POST',
    body: JSON.stringify(booking),
  });

  return data;
}

const BookingAPI = {
  getMealSlots,
  getAvailability,
  createBooking,
  searchHikers,
  createHiker,
  createStaffBooking,
};

export { BookingApiError };
export default BookingAPI;