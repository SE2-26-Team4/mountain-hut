// Booking Request DTO - Used when receiving booking data from the client.

class BookingRequest {
  constructor({ partyLeader, partySize, arrivalDate, departureDate, bookingType, notes }) {
    this.partyLeader = partyLeader;
    this.partySize = partySize;
    this.arrivalDate = arrivalDate;
    this.departureDate = departureDate;
    this.bookingType = bookingType; // 'overnight', 'meal', 'day-trip'
    this.notes = notes || '';
  }
}


//  Booking Response DTO - Sent back to the client with server-assigned metadata and status.

class BookingResponse {
  constructor({ id, partyLeader, partySize, arrivalDate, departureDate, bookingType, status, notes, createdAt }) {
    this.id = id;
    this.partyLeader = partyLeader;
    this.partySize = partySize;
    this.arrivalDate = arrivalDate;
    this.departureDate = departureDate;
    this.bookingType = bookingType;
    this.status = status || 'pending'; // 'pending', 'confirmed', 'rejected', 'cancelled'
    this.notes = notes || '';
    this.createdAt = createdAt || new Date().toISOString();
  }
}

module.exports = {
  BookingRequest,
  BookingResponse
};