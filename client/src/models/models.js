// Booking Request DTO - Used on the client side when submitting a booking request.
export class BookingRequest {
  constructor({ partyLeader, partySize, arrivalDate, departureDate, bookingType, notes }) {
    this.partyLeader = partyLeader;
    this.partySize = partySize;
    this.arrivalDate = arrivalDate;
    this.departureDate = departureDate;
    this.bookingType = bookingType;
    this.notes = notes || '';
  }
}


//  * Booking Response DTO - Used on the client side to parse responses from the server API.
export class BookingResponse {
  constructor({ id, partyLeader, partySize, arrivalDate, departureDate, bookingType, status, notes, createdAt }) {
    this.id = id;
    this.partyLeader = partyLeader;
    this.partySize = partySize;
    this.arrivalDate = arrivalDate;
    this.departureDate = departureDate;
    this.bookingType = bookingType;
    this.status = status || 'pending';
    this.notes = notes || '';
    this.createdAt = createdAt;
  }
}