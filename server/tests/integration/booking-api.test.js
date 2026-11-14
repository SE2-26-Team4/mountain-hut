import { randomUUID } from "node:crypto";

import request from "supertest";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

// Simulate email sending so these tests exercise booking APIs
// without contacting the real email provider.
vi.mock("../../services/booking-confirmation-service.js", () => ({
  sendBookingConfirmationEmail: vi.fn().mockResolvedValue({
    id: "test-email-id",
  }),
}));

import app from "../../app.js";
import { BookingError } from "../../dao/booking-dao.js";
import { getAsync, initializeDatabase, runAsync } from "../../db.js";
import { initializeAccounts } from "../../init/init-accounts.js";
import * as BookingService from "../../services/booking-service.js";
import { hashPassword } from "../../services/password.js";

// Use unique account and configuration names to avoid test-data conflicts.
const password = "BookingApiTest123!";
const email = `booking-api-${randomUUID()}@example.com`;
const bookingDate = "2099-12-31";
const uniqueSuffix = randomUUID();

// Keep fixture IDs and the authenticated hiker agent for requests and cleanup.
let hikerId;
let slotId;
let inactiveSlotId;
let tableId;
let hikerAgent;

// Store authenticated staff agents for role-based access tests.
/** @type {Record<string, {
 *   id: number,
 *   agent: import('supertest').Agent
 * }>} */
const staffAccounts = {};

// Remove allocations before bookings to respect foreign-key dependencies.
async function clearTestBookings() {
  await runAsync(
    `DELETE FROM booking_table_allocations
     WHERE booking_id IN (
       SELECT id FROM bookings WHERE slot_id = ?
     )`,
    [slotId],
  );

  await runAsync("DELETE FROM bookings WHERE slot_id = ?", [slotId]);
}

// Create reusable fixtures and authenticated sessions before the suite.
beforeAll(async () => {
  await initializeDatabase();
  await initializeAccounts();

  const passwordHash = await hashPassword(password);

  // Create the hiker who will submit and manage bookings.
  const user = await runAsync(
    `INSERT INTO users (
       full_name, email, password_hash, role
     )
     VALUES (?, ?, ?, 'hiker')`,
    ["Booking API Hiker", email, passwordHash],
  );

  hikerId = user.lastID;

  // Create an active slot for successful bookings and availability checks.
  const slot = await runAsync(
    `INSERT INTO meal_slots (
       slot_date, name, start_time, end_time
     )
     VALUES (?, ?, '18:00', '20:00')`,
    [bookingDate, `Booking API slot ${uniqueSuffix}`],
  );

  slotId = slot.lastID;

  // Create an inactive slot to verify that booking creation rejects it.
  const inactiveSlot = await runAsync(
    `INSERT INTO meal_slots (
       slot_date, name, start_time, end_time, is_active
     )
     VALUES (?, ?, '12:00', '14:00', 0)`,
    [bookingDate, `Booking API inactive slot ${uniqueSuffix}`],
  );

  inactiveSlotId = inactiveSlot.lastID;

  // Assign one four-seat table to the active slot.
  const table = await runAsync(
    `INSERT INTO dining_tables (name, seat_count)
     VALUES (?, 4)`,
    [`Booking API table ${uniqueSuffix}`],
  );

  tableId = table.lastID;

  await runAsync("INSERT INTO slot_tables (slot_id, table_id) VALUES (?, ?)", [
    slotId,
    tableId,
  ]);

  // Preserve the hiker's session cookie across booking requests.
  hikerAgent = request.agent(app);

  const loginResponse = await hikerAgent
    .post("/api/sessions")
    .send({ email, password });

  expect(loginResponse.status).toBe(201);

  // Create and authenticate both staff roles for authorization checks.
  for (const role of ["employee", "warden"]) {
    const staffEmail = `booking-api-${role}-${uniqueSuffix}@example.com`;

    const staffUser = await runAsync(
      `INSERT INTO users (
         full_name, email, password_hash, role
       )
       VALUES (?, ?, ?, ?)`,
      [`Booking API ${role}`, staffEmail, passwordHash, role],
    );

    const agent = request.agent(app);

    const staffLoginResponse = await agent
      .post("/api/staff/sessions")
      .send({ email: staffEmail, password });

    expect(staffLoginResponse.status).toBe(201);

    staffAccounts[role] = {
      id: staffUser.lastID,
      agent,
    };
  }
});

// Start each test with all four seats available in the active slot.
beforeEach(async () => {
  await clearTestBookings();
});

// Restore methods replaced by spies after each test.
afterEach(() => {
  vi.restoreAllMocks();
});

// Delete test records in dependency order after the suite finishes.
afterAll(async () => {
  // Remove bookings and table assignments before deleting the slot.
  if (slotId) {
    await clearTestBookings();

    await runAsync("DELETE FROM slot_tables WHERE slot_id = ?", [slotId]);
  }

  // Remove the reusable test table.
  if (tableId) {
    await runAsync("DELETE FROM dining_tables WHERE id = ?", [tableId]);
  }

  // Remove both active and inactive test slots.
  for (const id of [slotId, inactiveSlotId]) {
    if (id) {
      await runAsync("DELETE FROM meal_slots WHERE id = ?", [id]);
    }
  }

  // Remove the test hiker and staff accounts.
  if (hikerId) {
    await runAsync("DELETE FROM users WHERE id = ?", [hikerId]);
  }

  for (const { id } of Object.values(staffAccounts)) {
    await runAsync("DELETE FROM users WHERE id = ?", [id]);
  }
});

describe('booking availability API', () => {
  // Verify an unauthenticated visitor can check an active slot.
  it('returns availability to an unauthenticated visitor', async () => {
    const response = await request(app)
      .get("/api/bookings/availability")
      .query({ bookingDate, slotId });

    expect(response.status).toBe(200);
    expect(response.body.error).toBeUndefined();

    expect(response.body.availability).toMatchObject({
      bookingDate,
      slotId,
      totalAvailableSeats: 4,
    });

    // Check both the slot total and the individual table's seat counts.
    expect(response.body.availability.tables).toEqual([
      expect.objectContaining({
        id: tableId,
        seatCount: 4,
        reservedSeats: 0,
        availableSeats: 4,
      }),
    ]);
  });

  // Verify validation of malformed dates and invalid or missing slot IDs.
  it.each(["invalid date", "invalid slot ID", "missing slot ID"])(
    "rejects availability parameters: %s",
    async (scenario) => {
      const query =
        scenario === "invalid date"
          ? { bookingDate: "not-a-date", slotId }
          : scenario === "invalid slot ID"
            ? { bookingDate, slotId: "invalid" }
            : { bookingDate };

      const response = await request(app)
        .get("/api/bookings/availability")
        .query(query);

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe("INVALID_BOOKING");
    },
  );

  // Verify that an unknown slot has no availability response.
  it("returns 404 for an unknown meal slot", async () => {
    const response = await request(app)
      .get("/api/bookings/availability")
      .query({ bookingDate, slotId: 999999 });

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("MEAL_SLOT_NOT_FOUND");
  });

  // Verify that a valid slot ID cannot be queried using another date.
  it("returns no availability when the slot belongs to another date", async () => {
    const response = await request(app)
      .get("/api/bookings/availability")
      .query({
        bookingDate: "2100-01-01",
        slotId,
      });

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("MEAL_SLOT_NOT_FOUND");
  });
});

describe("booking management API", () => {
  // Require an authenticated session before creating a booking.
  it("requires authentication to create a booking", async () => {
    const response = await request(app)
      .post("/api/bookings")
      .send({ bookingDate, slotId, partySize: 1 });

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("UNAUTHENTICATED");
  });

  // Staff accounts must not create bookings through hiker-only endpoints.
  it.each(["employee", "warden"])(
    "rejects booking creation by %s accounts",
    async (role) => {
      const { id, agent } = staffAccounts[role];

      const response = await agent.post("/api/bookings").send({
        bookingDate,
        slotId,
        partySize: 1,
      });

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe("FORBIDDEN");

      // Confirm that authorization failure did not persist a booking.
      const saved = await getAsync(
        "SELECT COUNT(*) AS count FROM bookings WHERE hiker_id = ?",
        [id],
      );

      expect(saved.count).toBe(0);
    },
  );

  // Reject booking creation when the selected slot does not exist.
  it("returns 404 when booking an unknown meal slot", async () => {
    const response = await hikerAgent.post("/api/bookings").send({
      bookingDate,
      slotId: 999999,
      partySize: 1,
    });

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("SLOT_NOT_FOUND");
  });

  // Reject slots that staff have marked inactive.
  it("rejects a booking for an inactive meal slot", async () => {
    const response = await hikerAgent.post("/api/bookings").send({
      bookingDate,
      slotId: inactiveSlotId,
      partySize: 1,
    });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("SLOT_INACTIVE");
  });

  // Check date and party-size validation through the booking endpoint.
  it.each(["invalid date", "zero party size", "fractional party size"])(
    "rejects booking data: %s",
    async (scenario) => {
      const body = {
        bookingDate,
        slotId,
        partySize: 1,
      };

      // Change only the field relevant to the current validation scenario.
      if (scenario === "invalid date") {
        body.bookingDate = "invalid";
      } else if (scenario === "zero party size") {
        body.partySize = 0;
      } else {
        body.partySize = 1.5;
      }

      const response = await hikerAgent.post("/api/bookings").send(body);

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe(
        scenario === "invalid date" ? "INVALID_BOOKING" : "INVALID_PARTY_SIZE",
      );
    },
  );

  // Reject past dates and verify that no corresponding booking is stored.
  it("rejects a past booking date without saving a booking", async () => {
    const pastDate = "2000-01-01";

    const response = await hikerAgent.post("/api/bookings").send({
      bookingDate: pastDate,
      slotId,
      partySize: 2,
    });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("INVALID_BOOKING");

    const saved = await getAsync(
      `SELECT COUNT(*) AS count
       FROM bookings
       WHERE hiker_id = ?
         AND slot_id = ?
         AND booking_date = ?`,
      [hikerId, slotId, pastDate],
    );

    expect(saved.count).toBe(0);
  });

  // Verify successful persistence, table allocation, and reduced availability.
  it("creates a booking", async () => {
    const response = await hikerAgent.post("/api/bookings").send({
      bookingDate,
      slotId,
      partySize: 2,
    });

    expect(response.status).toBe(201);

    expect(response.body.booking).toMatchObject({
      hikerId,
      bookingDate,
      slotId,
      partySize: 2,
      status: "confirmed",
      allocations: [{ tableId, seatsReserved: 2 }],
    });

    // Two reserved seats must leave two seats available at the table.
    const availability = await request(app)
      .get("/api/bookings/availability")
      .query({ bookingDate, slotId });

    expect(availability.status).toBe(200);

    expect(availability.body.availability.totalAvailableSeats).toBe(2);
  });

  // Reject a party larger than the slot's available capacity.
  it("rejects a booking when there is not enough availability", async () => {
    const response = await hikerAgent.post("/api/bookings").send({
      bookingDate,
      slotId,
      partySize: 5,
    });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("NO_AVAILABILITY");
  });

  // A slot must be booked using its configured date.
  it("rejects booking a slot on another date without saving it", async () => {
    const wrongDate = "2100-01-01";

    const response = await hikerAgent.post("/api/bookings").send({
      bookingDate: wrongDate,
      slotId,
      partySize: 1,
    });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("INVALID_BOOKING");

    // Confirm that the rejected date/slot combination was not persisted.
    const stored = await getAsync(
      `SELECT COUNT(*) AS count
       FROM bookings
       WHERE slot_id = ? AND booking_date = ?`,
      [slotId, wrongDate],
    );

    expect(stored.count).toBe(0);
  });
});

describe("booking API error handling", () => {
  // Translate a temporary SQLite lock into a service-unavailable response.
  it("returns 503 when the database is busy", async () => {
    vi.spyOn(BookingService, "createBookingForHiker").mockRejectedValueOnce(
      Object.assign(new Error("SQLITE_BUSY: database is locked"), {
        code: "SQLITE_BUSY",
      }),
    );

    const response = await hikerAgent
      .post("/api/bookings")
      .send({ bookingDate, slotId, partySize: 1 });

    expect(response.status).toBe(503);
    expect(response.body.error.code).toBe("DATABASE_BUSY");
  });

  // Unexpected failures must not expose private error details to clients.
  it.each([
    [
      "an unknown booking error code",
      new BookingError("UNKNOWN_CODE", "Private booking detail"),
    ],
    ["an unexpected error", new Error("Private database detail")],
  ])("returns a generic 500 response for %s", async (_label, error) => {
    // Suppress expected error logging and simulate the service failure.
    vi.spyOn(console, "error").mockImplementation(() => {});

    vi.spyOn(BookingService, "createBookingForHiker").mockRejectedValueOnce(
      error,
    );

    const response = await hikerAgent
      .post("/api/bookings")
      .send({ bookingDate, slotId, partySize: 1 });

    expect(response.status).toBe(500);

    expect(response.body.error).toEqual({
      code: "INTERNAL_SERVER_ERROR",
      message: "An unexpected error occurred.",
    });

    expect(response.text).not.toContain("Private");
  });
});

describe("booking retrieval and cancellation API", () => {
  // Keep the booking ID created specifically for each test in this group.
  let createdBookingId;

  // Create a fresh confirmed booking after the shared cleanup has run.
  beforeEach(async () => {
    const created = await hikerAgent.post("/api/bookings").send({
      bookingDate,
      slotId,
      partySize: 1,
    });

    expect(created.status).toBe(201);
    createdBookingId = created.body.booking.id;
  });

  // Verify that the hiker can find their newly created booking.
  it("allows an authenticated hiker to retrieve their bookings", async () => {
    const response = await hikerAgent.get("/api/bookings");

    expect(response.status).toBe(200);

    expect(response.body.bookings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: createdBookingId,
          hikerId,
          bookingDate,
          slotId,
          status: "confirmed",
        }),
      ]),
    );
  });

  // Verify that cancellation updates the status and releases reserved seats.
  it("allows an authenticated hiker to cancel their booking", async () => {
    const response = await hikerAgent.delete(
      `/api/bookings/${createdBookingId}`,
    );

    expect(response.status).toBe(200);
    expect(response.body.booking.status).toBe("cancelled");

    // The table must regain its full four-seat availability.
    const availability = await request(app)
      .get("/api/bookings/availability")
      .query({ bookingDate, slotId });

    expect(availability.status).toBe(200);

    expect(availability.body.availability.totalAvailableSeats).toBe(4);
  });

  // A second cancellation must not report success or change the booking.
  it("returns 404 when the booking is already cancelled", async () => {
    const first = await hikerAgent.delete(`/api/bookings/${createdBookingId}`);

    expect(first.status).toBe(200);

    const second = await hikerAgent.delete(`/api/bookings/${createdBookingId}`);

    expect(second.status).toBe(404);

    expect(second.body.error).toEqual({
      code: "BOOKING_NOT_FOUND",
      message: "The requested booking was not found.",
    });
  });

  // Hikers must not be able to cancel, or detect, bookings of other hikers.
  it("does not allow a hiker to cancel another hiker's booking", async () => {
    const otherEmail = `booking-api-other-${randomUUID()}@example.com`;

    const otherUser = await runAsync(
      `INSERT INTO users (
         full_name, email, password_hash, role
       )
       VALUES (?, ?, ?, 'hiker')`,
      ["Booking API Other Hiker", otherEmail, await hashPassword(password)],
    );

    try {
      const otherAgent = request.agent(app);

      const login = await otherAgent
        .post("/api/sessions")
        .send({ email: otherEmail, password });

      expect(login.status).toBe(201);

      const response = await otherAgent.delete(
        `/api/bookings/${createdBookingId}`,
      );

      // Use the same answer as a missing booking to avoid revealing it.
      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe("BOOKING_NOT_FOUND");

      // The owner's booking stays confirmed and keeps its seat.
      const saved = await getAsync("SELECT status FROM bookings WHERE id = ?", [
        createdBookingId,
      ]);

      expect(saved.status).toBe("confirmed");

      const availability = await request(app)
        .get("/api/bookings/availability")
        .query({ bookingDate, slotId });

      expect(availability.body.availability.totalAvailableSeats).toBe(3);
    } finally {
      await runAsync("DELETE FROM users WHERE id = ?", [otherUser.lastID]);
    }
  });
});

describe("editing a booking", () => {
  // [REQUIREMENT] MH-06: Changes to party size are subject to the automatic verification of availability
  it("updates the same booking and keeps the assigned table when it fits", async () => {
    const created = await hikerAgent
      .post("/api/bookings")
      .send({
        bookingDate,
        slotId,
        partySize: 2,
      })
      .expect(201);

    const { id } = created.body.booking;
    const updated = await hikerAgent
      .put(`/api/bookings/${id}`)
      .send({
        bookingDate,
        slotId,
        partySize: 3,
        specialRequests: "Gluten free",
      })
      .expect(200);

    expect(updated.body.emailSent).toBe(true);
    expect(updated.body.booking).toMatchObject({
      id,
      partySize: 3,
      specialRequests: "Gluten free",
      allocations: [{ tableId, seatsReserved: 3 }],
    });

    const list = await hikerAgent.get("/api/bookings").expect(200);
    expect(list.body.bookings).toContainEqual(
      expect.objectContaining(updated.body.booking),
    );
  });

  // [REQUIREMENT] MH-06: If there are not enough seats, the change is refused and the booking stays as it was.
  it("preserves the original booking when there is insufficient capacity", async () => {
    const created = await hikerAgent
      .post("/api/bookings")
      .send({
        bookingDate,
        slotId,
        partySize: 2,
        specialRequests: "Vegetarian",
      })
      .expect(201);

    const { id } = created.body.booking;
    const rejected = await hikerAgent
      .put(`/api/bookings/${id}`)
      .send({
        bookingDate,
        slotId,
        partySize: 5,
        specialRequests: "Gluten free",
      })
      .expect(409);

    expect(rejected.body.error.code).toBe("NO_AVAILABILITY");

    const list = await hikerAgent.get("/api/bookings").expect(200);
    expect(list.body.bookings).toContainEqual(
      expect.objectContaining(created.body.booking),
    );
  });

  // [REQUIREMENT] MH-06: The current seats are released and the tables are assigned
  // again with the MH-01 rules.
  it("reassigns a larger party and releases the original table", async () => {
    const largerTable = await runAsync(
      "INSERT INTO dining_tables (name, seat_count) VALUES (?, 6)",
      [`Booking API larger table ${uniqueSuffix}`],
    );
    const largerTableId = largerTable.lastID;

    try {
      await runAsync(
        "INSERT INTO slot_tables (slot_id, table_id) VALUES (?, ?)",
        [slotId, largerTableId],
      );

      const created = await hikerAgent
        .post("/api/bookings")
        .send({ bookingDate, slotId, partySize: 2 })
        .expect(201);

      expect(created.body.booking.allocations).toEqual([
        { tableId, seatsReserved: 2 },
      ]);

      const { id } = created.body.booking;
      const updated = await hikerAgent
        .put(`/api/bookings/${id}`)
        .send({ bookingDate, slotId, partySize: 5 })
        .expect(200);

      expect(updated.body.booking).toMatchObject({
        id,
        partySize: 5,
        allocations: [{ tableId: largerTableId, seatsReserved: 5 }],
      });

      const availability = await request(app)
        .get("/api/bookings/availability")
        .query({ bookingDate, slotId })
        .expect(200);

      expect(availability.body.availability.tables).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: tableId, availableSeats: 4 }),
          expect.objectContaining({ id: largerTableId, availableSeats: 1 }),
        ]),
      );
    } finally {
      await clearTestBookings();
      await runAsync(
        "DELETE FROM slot_tables WHERE slot_id = ? AND table_id = ?",
        [slotId, largerTableId],
      );
      await runAsync("DELETE FROM dining_tables WHERE id = ?", [largerTableId]);
    }
  });

  it("moves the same booking to a different date and meal slot", async () => {
    const targetDate = "2100-01-01";
    const targetSlot = await runAsync(
      `INSERT INTO meal_slots (slot_date, name, start_time, end_time)
       VALUES (?, ?, '12:00', '14:00')`,
      [targetDate, `Booking API target slot ${uniqueSuffix}`],
    );
    const targetSlotId = targetSlot.lastID;

    try {
      await runAsync(
        "INSERT INTO slot_tables (slot_id, table_id) VALUES (?, ?)",
        [targetSlotId, tableId],
      );

      const created = await hikerAgent
        .post("/api/bookings")
        .send({ bookingDate, slotId, partySize: 2 })
        .expect(201);

      const { id } = created.body.booking;
      const updated = await hikerAgent
        .put(`/api/bookings/${id}`)
        .send({ bookingDate: targetDate, slotId: targetSlotId, partySize: 2 })
        .expect(200);

      expect(updated.body.booking).toMatchObject({
        id,
        bookingDate: targetDate,
        slotId: targetSlotId,
        allocations: [{ tableId, seatsReserved: 2 }],
      });

      const originalAvailability = await request(app)
        .get("/api/bookings/availability")
        .query({ bookingDate, slotId })
        .expect(200);

      expect(originalAvailability.body.availability.totalAvailableSeats).toBe(
        4,
      );
    } finally {
      await runAsync("DELETE FROM bookings WHERE slot_id = ?", [targetSlotId]);
      await runAsync("DELETE FROM slot_tables WHERE slot_id = ?", [
        targetSlotId,
      ]);
      await runAsync("DELETE FROM meal_slots WHERE id = ?", [targetSlotId]);
    }
  });

  // [REQUIREMENT] MH-06: Changes are admitted within 48 hours from the date booked.
  it("accepts edits at the 48-hour deadline and rejects them after it", async () => {
    // The original meal starts at 18:00 Rome time on 2099-12-31.
    const deadline = Date.parse("2099-12-29T17:00:00.000Z");

    vi.useFakeTimers({ toFake: ["Date"] });

    try {
      vi.setSystemTime(deadline);

      // Authenticate with the test clock so the session cookie stays valid.
      const agent = request.agent(app);
      await agent.post("/api/sessions").send({ email, password }).expect(201);

      const created = await agent
        .post("/api/bookings")
        .send({ bookingDate, slotId, partySize: 2 })
        .expect(201);

      const { id } = created.body.booking;
      const updated = await agent
        .put(`/api/bookings/${id}`)
        .send({
          bookingDate,
          slotId,
          partySize: 2,
          specialRequests: "Vegetarian",
        })
        .expect(200);

      expect(updated.body.booking.specialRequests).toBe("Vegetarian");

      vi.setSystemTime(deadline + 1);

      const rejected = await agent
        .put(`/api/bookings/${id}`)
        .send({
          bookingDate,
          slotId,
          partySize: 2,
          specialRequests: "Gluten free",
        })
        .expect(409);

      expect(rejected.body.error.code).toBe("BOOKING_EDIT_TOO_LATE");

      const list = await agent.get("/api/bookings").expect(200);
      expect(list.body.bookings).toContainEqual(
        expect.objectContaining({ id, specialRequests: "Vegetarian" }),
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it.each(["abc", "9007199254740992"])(
    "rejects an invalid booking ID (%s)",
    async (id) => {
      const response = await hikerAgent
        .put(`/api/bookings/${id}`)
        .send({ bookingDate, slotId, partySize: 2 })
        .expect(400);

      expect(response.body.error.code).toBe("INVALID_BOOKING");
    },
  );

  it("returns 404 when the booking to edit does not exist", async () => {
    const response = await hikerAgent
      .put(`/api/bookings/${Number.MAX_SAFE_INTEGER}`)
      .send({ bookingDate, slotId, partySize: 2 })
      .expect(404);

    expect(response.body.error.code).toBe("BOOKING_NOT_FOUND");
  });
});
