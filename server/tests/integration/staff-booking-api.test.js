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

// Create the email mock before importing modules that use the sending service.
const emailMocks = vi.hoisted(() => ({
  send: vi.fn(),
}));

// Exercise the real routes and template without sending real emails.
vi.mock("../../services/booking-confirmation-service.js", () => ({
  sendBookingConfirmationEmail: emailMocks.send,
}));

import app from "../../app.js";
import { getAsync, initializeDatabase, runAsync } from "../../db.js";
import { initializeAccounts } from "../../init/init-accounts.js";
import { hashPassword, verifyPassword } from "../../services/password.js";

// Staff enter bookings for existing, new or temporary hikers.

const uniqueSuffix = randomUUID();

const hikerEmail = (process.env.TEST_HIKER_EMAIL ?? "hiker@example.com")
  .trim()
  .toLowerCase();
const hikerPassword = process.env.TEST_HIKER_PASSWORD ?? "HikerTest123!";

const employeeEmail = (
  process.env.TEST_EMPLOYEE_EMAIL ?? "employee@example.com"
)
  .trim()
  .toLowerCase();
const employeePassword =
  process.env.TEST_EMPLOYEE_PASSWORD ?? "EmployeeTest123!";

const wardenEmail = `staff-api-warden-${uniqueSuffix}@example.com`;
const wardenPassword = "WardenTest123!";

// A far date for the general rules, and a date used with a fake clock.
const bookingDate = "2099-09-15";
const timedDate = "2031-03-12";

// Existing hiker found by staff through name, email or phone.
const existingHiker = {
  fullName: `Staff API Hiker ${uniqueSuffix}`,
  email: `staff-api-hiker-${uniqueSuffix}@example.com`,
  phone: "+393401112233",
};

let existingHikerId;
let employeeId;
let slotId;
let timedSlotId;
let tableId;
let hikerAgent;
let employeeAgent;
let wardenAgent;

/* HELPERS */

// Authenticate an account and preserve its session cookie.
async function loginAgent(email, password, area = "hiker") {
  const agent = request.agent(app);

  const response = await agent
    .post(area === "staff" ? "/api/staff/sessions" : "/api/sessions")
    .send({ email, password });

  if (response.status !== 201) {
    throw new Error(`Could not sign in test account: ${email}`);
  }

  return agent;
}

function newHikerInput(overrides = {}) {
  return {
    type: "new",
    fullName: `Staff API New Hiker ${uniqueSuffix}`,
    email: `staff-api-new-${uniqueSuffix}@example.com`,
    phone: "+39 333 765 4321",
    ...overrides,
  };
}

function temporaryHikerInput(overrides = {}) {
  return {
    type: "temporary",
    fullName: `Staff API Walk-in ${uniqueSuffix}`,
    phone: "+41 79 123 45 67",
    ...overrides,
  };
}

function staffBooking(hiker, overrides = {}) {
  return {
    hiker,
    bookingDate,
    slotId,
    partySize: 2,
    ...overrides,
  };
}

// Freeze only the clock, so that timers and sessions keep working.
function setNow(instant) {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(instant));
}

async function clearBookings() {
  await runAsync(
    `DELETE FROM booking_table_allocations
     WHERE booking_id IN (
       SELECT id FROM bookings WHERE slot_id IN (?, ?)
     )`,
    [slotId, timedSlotId],
  );

  await runAsync("DELETE FROM bookings WHERE slot_id IN (?, ?)", [
    slotId,
    timedSlotId,
  ]);
}

// Remove hikers created by the tests, identified by the unique suffix.
async function clearCreatedHikers() {
  await runAsync(
    `DELETE FROM users
     WHERE role = 'hiker'
       AND id <> ?
       AND full_name LIKE ?`,
    [existingHikerId, `%${uniqueSuffix}%`],
  );
}

/* SETUP */

beforeAll(async () => {
  await initializeDatabase();
  await initializeAccounts();

  // A hiker with a phone, searchable by staff.
  existingHikerId = (
    await runAsync(
      `INSERT INTO users (full_name, email, password_hash, role, phone)
       VALUES (?, ?, ?, 'hiker', ?)`,
      [
        existingHiker.fullName,
        existingHiker.email,
        await hashPassword("ExistingHiker123!"),
        existingHiker.phone,
      ],
    )
  ).lastID;

  // A warden account, the second staff role.
  await runAsync(
    `INSERT INTO users (full_name, email, password_hash, role)
     VALUES (?, ?, ?, 'warden')`,
    [
      `Staff API Warden ${uniqueSuffix}`,
      wardenEmail,
      await hashPassword(wardenPassword),
    ],
  );

  employeeId = (
    await getAsync("SELECT id FROM users WHERE email = ?", [employeeEmail])
  ).id;

  // One four-seat table shared by the far-date slot and the timed slot.
  // The timed slot starts at 12:00 in Rome, i.e. 11:00 UTC (winter time).
  slotId = (
    await runAsync(
      `INSERT INTO meal_slots (slot_date, name, start_time, end_time)
       VALUES (?, ?, '19:00', '21:00')`,
      [bookingDate, `Staff API slot ${uniqueSuffix}`],
    )
  ).lastID;

  timedSlotId = (
    await runAsync(
      `INSERT INTO meal_slots (slot_date, name, start_time, end_time)
       VALUES (?, ?, '12:00', '14:00')`,
      [timedDate, `Staff API timed slot ${uniqueSuffix}`],
    )
  ).lastID;

  tableId = (
    await runAsync(
      "INSERT INTO dining_tables (name, seat_count) VALUES (?, 4)",
      [`Staff API table ${uniqueSuffix}`],
    )
  ).lastID;

  for (const id of [slotId, timedSlotId]) {
    await runAsync(
      "INSERT INTO slot_tables (slot_id, table_id) VALUES (?, ?)",
      [id, tableId],
    );
  }

  hikerAgent = await loginAgent(hikerEmail, hikerPassword);
  employeeAgent = await loginAgent(employeeEmail, employeePassword, "staff");
  wardenAgent = await loginAgent(wardenEmail, wardenPassword, "staff");
});

beforeEach(async () => {
  await clearBookings();
  await clearCreatedHikers();

  emailMocks.send.mockReset();
  emailMocks.send.mockResolvedValue({ id: "test-email-id" });
});

afterEach(() => {
  vi.useRealTimers();
});

afterAll(async () => {
  await clearBookings();
  await clearCreatedHikers();

  await runAsync("DELETE FROM slot_tables WHERE slot_id IN (?, ?)", [
    slotId,
    timedSlotId,
  ]);

  await runAsync("DELETE FROM meal_slots WHERE id IN (?, ?)", [
    slotId,
    timedSlotId,
  ]);

  await runAsync("DELETE FROM dining_tables WHERE id = ?", [tableId]);

  await runAsync("DELETE FROM users WHERE id = ? OR email = ?", [
    existingHikerId,
    wardenEmail,
  ]);
});

/* TESTS */

describe("staff booking API authorization", () => {
  const endpoints = [
    ["GET", "/api/staff/hikers?search=Staff"],
    ["POST", "/api/staff/hikers"],
    ["POST", "/api/staff/bookings"],
  ];

  it.each(endpoints)("%s %s requires login", async (method, path) => {
    const response = await request(app)[method.toLowerCase()](path);

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("UNAUTHENTICATED");
  });

  it.each(endpoints)("%s %s is forbidden to hikers", async (method, path) => {
    const pending = hikerAgent[method.toLowerCase()](path);
    const response = await (method === "POST"
      ? pending.send(staffBooking({ type: "existing", hikerId: 1 }))
      : pending);

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("FORBIDDEN");
  });
});

describe("GET /api/staff/hikers", () => {
  it.each([
    ["name", `api hiker ${uniqueSuffix.slice(0, 8)}`],
    ["email", `STAFF-API-HIKER-${uniqueSuffix}`],
    ["phone typed with separators", "340 111-22"],
  ])("finds a hiker by %s", async (_label, search) => {
    const response = await employeeAgent
      .get("/api/staff/hikers")
      .query({ search });

    expect(response.status).toBe(200);
    expect(response.body.hikers).toEqual([
      {
        id: existingHikerId,
        fullName: existingHiker.fullName,
        email: existingHiker.email,
        phone: existingHiker.phone,
        notes: null,
        emergencyContact: null,
        isTemporary: false,
        mustChangePassword: false,
      },
    ]);
  });

  it("is available to wardens and never returns staff accounts", async () => {
    const response = await wardenAgent
      .get("/api/staff/hikers")
      .query({ search: wardenEmail });

    expect(response.status).toBe(200);
    expect(response.body.hikers).toEqual([]);
  });

  it.each([
    ["missing", ""],
    ["too short", "?search=%20a%20"],
    ["repeated", "?search=ab&search=cd"],
  ])("rejects a %s search term", async (_label, query) => {
    const response = await employeeAgent.get(`/api/staff/hikers${query}`);

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("INVALID_HIKER");
  });
});

describe("POST /api/staff/hikers", () => {
  it("registers a full hiker with a one-time initial password", async () => {
    const input = newHikerInput();

    const response = await employeeAgent.post("/api/staff/hikers").send(input);

    expect(response.status).toBe(201);
    expect(response.body.hiker).toMatchObject({
      fullName: input.fullName,
      email: input.email,
      phone: "+393337654321",
      isTemporary: false,
      mustChangePassword: true,
    });
    expect(response.body.hiker).not.toHaveProperty("passwordHash");
    expect(response.body.initialPassword).toEqual(expect.any(String));

    // Staff can communicate the returned password: it matches the stored hash.
    const row = await getAsync("SELECT password_hash FROM users WHERE id = ?", [
      response.body.hiker.id,
    ]);

    await expect(
      verifyPassword(response.body.initialPassword, row.password_hash),
    ).resolves.toBe(true);
  });

  it("registers a temporary hiker without email or password", async () => {
    const response = await wardenAgent
      .post("/api/staff/hikers")
      .send(temporaryHikerInput({ phone: null }));

    expect(response.status).toBe(201);
    expect(response.body).toEqual({
      hiker: expect.objectContaining({
        fullName: `Staff API Walk-in ${uniqueSuffix}`,
        email: null,
        phone: null,
        isTemporary: true,
        mustChangePassword: false,
      }),
    });
  });

  it("rejects an email already used by any account", async () => {
    const response = await employeeAgent
      .post("/api/staff/hikers")
      .send(newHikerInput({ email: employeeEmail.toUpperCase() }));

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("EMAIL_ALREADY_REGISTERED");
  });

  it.each([
    ["an existing hiker", { type: "existing", hikerId: 1 }],
    ["an unknown hiker type", { type: "guest", fullName: "Guest" }],
    ["an invalid email", newHikerInput({ email: "not-an-email" })],
    ["a missing name", temporaryHikerInput({ fullName: "  " })],
  ])("rejects %s", async (_label, input) => {
    const response = await employeeAgent.post("/api/staff/hikers").send(input);

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("INVALID_HIKER");
  });

  it("rejects a request without a body", async () => {
    const response = await employeeAgent.post("/api/staff/hikers");

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("INVALID_HIKER");
  });
});

describe("POST /api/staff/bookings", () => {
  it("books an existing hiker and sends the confirmation email", async () => {
    const response = await employeeAgent
      .post("/api/staff/bookings")
      .send(
        staffBooking(
          { type: "existing", hikerId: existingHikerId },
          { specialRequests: "  Gluten free  " },
        ),
      );

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      booking: {
        hikerId: existingHikerId,
        bookingDate,
        slotId,
        partySize: 2,
        specialRequests: "Gluten free",
        status: "confirmed",
        allocations: [{ tableId, seatsReserved: 2 }],
      },
      hiker: { id: existingHikerId, email: existingHiker.email },
      emailSent: true,
    });
    expect(response.body).not.toHaveProperty("initialPassword");

    expect(emailMocks.send).toHaveBeenCalledTimes(1);
    expect(emailMocks.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: existingHiker.email,
        text: expect.stringContaining(existingHiker.fullName),
      }),
    );
  });

  it("creates a new hiker together with the booking", async () => {
    const input = newHikerInput();

    const response = await wardenAgent
      .post("/api/staff/bookings")
      .send(staffBooking(input));

    expect(response.status).toBe(201);
    expect(response.body.hiker).toMatchObject({
      email: input.email,
      isTemporary: false,
      mustChangePassword: true,
    });
    expect(response.body.booking.hikerId).toBe(response.body.hiker.id);
    expect(response.body.initialPassword).toEqual(expect.any(String));
    expect(response.body.emailSent).toBe(true);

    expect(emailMocks.send).toHaveBeenCalledWith(
      expect.objectContaining({ to: input.email }),
    );

    // The initial password is never sent by email.
    expect(JSON.stringify(emailMocks.send.mock.calls)).not.toContain(
      response.body.initialPassword,
    );
  });

  it("books a temporary hiker without sending an email", async () => {
    const response = await employeeAgent
      .post("/api/staff/bookings")
      .send(staffBooking(temporaryHikerInput()));

    expect(response.status).toBe(201);
    expect(response.body.hiker).toMatchObject({
      email: null,
      phone: "+41791234567",
      isTemporary: true,
    });
    expect(response.body.booking.hikerId).toBe(response.body.hiker.id);
    expect(response.body.emailSent).toBe(false);
    expect(emailMocks.send).not.toHaveBeenCalled();
  });

  it("stores a temporary hiker email and sends both booking requests", async () => {
    const email = `staff-api-temporary-${uniqueSuffix}@example.com`;

    const response = await employeeAgent.post("/api/staff/bookings").send(
      staffBooking(temporaryHikerInput({ phone: null }), {
        confirmationEmail: `  ${email}  `,
        dietaryRequirements: "  Peanut allergy  ",
        specialRequests: "  We may arrive late  ",
      }),
    );

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      hiker: { email, phone: null, isTemporary: true },
      booking: {
        dietaryRequirements: "Peanut allergy",
        specialRequests: "We may arrive late",
      },
      emailRecipient: email,
      emailSent: true,
    });
    expect(response.body).not.toHaveProperty("initialPassword");

    const row = await getAsync(
      "SELECT email, password_hash FROM users WHERE id = ?",
      [response.body.hiker.id],
    );
    expect(row).toEqual({ email, password_hash: null });

    const search = await employeeAgent
      .get("/api/staff/hikers")
      .query({ search: email });

    expect(search.status).toBe(200);
    expect(search.body.hikers).toEqual([
      expect.objectContaining({ id: response.body.hiker.id, email }),
    ]);

    expect(emailMocks.send).toHaveBeenCalledTimes(1);
    const [message] = emailMocks.send.mock.calls[0];
    expect(message.to).toBe(email);

    for (const body of [message.text, message.html]) {
      expect(body).toContain("Peanut allergy");
      expect(body).toContain("We may arrive late");
    }
  });

  it("stores separate dietary entries and flags only the allergy in the email", async () => {
    const dietaryRequirements = JSON.stringify([
      { description: "Peanut allergy", hasAllergies: true },
      { description: "Vegetarian meal", hasAllergies: false },
    ]);

    const response = await employeeAgent.post("/api/staff/bookings").send(
      staffBooking(temporaryHikerInput(), {
        partySize: 2,
        confirmationEmail: `staff-api-dietary-${uniqueSuffix}@example.com`,
        dietaryRequirements,
      }),
    );

    expect(response.status).toBe(201);
    expect(response.body.booking.dietaryRequirements).toBe(dietaryRequirements);
    expect(response.body.emailSent).toBe(true);
    expect(emailMocks.send).toHaveBeenCalledTimes(1);

    const [message] = emailMocks.send.mock.calls[0];
    expect(message.text).toContain("[FOOD ALLERGY] Peanut allergy");
    expect(message.text).toContain("Vegetarian meal");
    expect(message.text).not.toContain("[FOOD ALLERGY] Vegetarian meal");
    expect(message.html).toMatch(
      /<strong>\[FOOD ALLERGY\]<\/strong>\s+Peanut allergy/,
    );
    expect(message.html).toContain("Vegetarian meal");
    expect(message.html.match(/\[FOOD ALLERGY\]/g)).toHaveLength(1);
  });

  it.each([
    ["malformed JSON", "[", "Dietary requirements must contain a valid list."],
    [
      "a missing description",
      JSON.stringify([{ hasAllergies: true }]),
      "Each dietary requirement needs a description and an allergy flag.",
    ],
    [
      "a blank description",
      JSON.stringify([{ description: " ", hasAllergies: true }]),
      "Each dietary requirement needs a description and an allergy flag.",
    ],
    [
      "a missing allergy flag",
      JSON.stringify([{ description: "Vegetarian meal" }]),
      "Each dietary requirement needs a description and an allergy flag.",
    ],
    [
      "more entries than guests",
      JSON.stringify([
        { description: "Peanut allergy", hasAllergies: true },
        { description: "Vegetarian meal", hasAllergies: false },
      ]),
      "You can add at most one dietary requirement per guest.",
    ],
  ])(
    "rejects dietary requirements with %s",
    async (_label, dietaryRequirements, message) => {
      const response = await employeeAgent.post("/api/staff/bookings").send(
        staffBooking(temporaryHikerInput(), {
          partySize: 1,
          dietaryRequirements,
        }),
      );

      expect(response.status).toBe(400);
      expect(response.body.error).toMatchObject({
        code: "INVALID_BOOKING",
        message,
      });
      expect(emailMocks.send).not.toHaveBeenCalled();
    },
  );

  it.each([
    ["a non-string address", 42],
    ["an address with invalid syntax", "not-an-email"],
    ["an address exceeding 254 characters", `${"a".repeat(255)}@example.com`],
  ])("rejects %s for a temporary hiker", async (_label, confirmationEmail) => {
    const response = await employeeAgent
      .post("/api/staff/bookings")
      .send(staffBooking(temporaryHikerInput(), { confirmationEmail }));

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("INVALID_HIKER");
    expect(emailMocks.send).not.toHaveBeenCalled();
  });

  it("rejects a confirmation email override for an existing hiker", async () => {
    const response = await employeeAgent.post("/api/staff/bookings").send(
      staffBooking(
        { type: "existing", hikerId: existingHikerId },
        {
          confirmationEmail: "other@example.com",
        },
      ),
    );

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("INVALID_HIKER");
    expect(emailMocks.send).not.toHaveBeenCalled();
  });

  it.each([42, "a".repeat(1001)])(
    "rejects invalid dietary requirements",
    async (dietaryRequirements) => {
      const response = await employeeAgent.post("/api/staff/bookings").send(
        staffBooking(
          { type: "existing", hikerId: existingHikerId },
          {
            dietaryRequirements,
          },
        ),
      );

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe("INVALID_BOOKING");
      expect(emailMocks.send).not.toHaveBeenCalled();
    },
  );

  it("keeps the booking when the confirmation email fails", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    emailMocks.send.mockRejectedValue(new Error("Email provider down"));

    try {
      const response = await employeeAgent
        .post("/api/staff/bookings")
        .send(staffBooking({ type: "existing", hikerId: existingHikerId }));

      expect(response.status).toBe(201);
      expect(response.body.emailSent).toBe(false);
      expect(consoleError).toHaveBeenCalledWith(
        "Booking saved, but confirmation email could not be sent:",
        expect.any(Error),
      );
    } finally {
      consoleError.mockRestore();
    }
  });

  it.each([
    ["an unknown hiker", "unknown"],
    ["a staff account", "employee"],
  ])("reports %s as not found", async (_label, kind) => {
    const hikerId = kind === "employee" ? employeeId : 2147483647;

    const response = await employeeAgent
      .post("/api/staff/bookings")
      .send(staffBooking({ type: "existing", hikerId }));

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("HIKER_NOT_FOUND");
  });

  it.each([
    ["a missing hiker", undefined],
    ["a hiker ID sent as text", { type: "existing", hikerId: String(1) }],
  ])("rejects %s", async (_label, hiker) => {
    const response = await employeeAgent
      .post("/api/staff/bookings")
      .send(staffBooking(hiker));

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("INVALID_HIKER");
  });

  it.each([
    ["an invalid party size", { partySize: 0 }, "INVALID_PARTY_SIZE"],
    ["a malformed date", { bookingDate: "15/09/2099" }, "INVALID_BOOKING"],
    ["a past date", { bookingDate: "2000-01-01" }, "INVALID_BOOKING"],
  ])("rejects %s", async (_label, overrides, code) => {
    const response = await employeeAgent
      .post("/api/staff/bookings")
      .send(
        staffBooking({ type: "existing", hikerId: existingHikerId }, overrides),
      );

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe(code);
  });

  it("rejects a request without a body", async () => {
    const response = await employeeAgent.post("/api/staff/bookings");

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("INVALID_BOOKING");
  });

  it("does not create the new hiker when the booking is rejected", async () => {
    const input = newHikerInput();

    const response = await employeeAgent
      .post("/api/staff/bookings")
      .send(staffBooking(input, { partySize: 5 }));

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("NO_AVAILABILITY");

    const created = await getAsync("SELECT id FROM users WHERE email = ?", [
      input.email,
    ]);

    expect(created).toBeUndefined();
  });

  it("rejects a second booking of the same hiker for the slot", async () => {
    const booking = staffBooking({
      type: "existing",
      hikerId: existingHikerId,
    });

    expect(
      (await employeeAgent.post("/api/staff/bookings").send(booking)).status,
    ).toBe(201);

    const response = await employeeAgent
      .post("/api/staff/bookings")
      .send(booking);

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("DUPLICATE_BOOKING");
  });
});

describe("time limit for staff bookings", () => {
  // Fresh sessions are created under the fake clock, so that the
  // shared sessions (created with the real clock) are never touched.
  it("accepts staff bookings within two hours of the meal, unlike hikers", async () => {
    setNow("2031-03-12T10:00:00.000Z");

    const hiker = await loginAgent(hikerEmail, hikerPassword);
    const employee = await loginAgent(employeeEmail, employeePassword, "staff");

    const hikerResponse = await hiker.post("/api/bookings").send({
      bookingDate: timedDate,
      slotId: timedSlotId,
      partySize: 2,
    });

    expect(hikerResponse.status).toBe(409);
    expect(hikerResponse.body.error.code).toBe("BOOKING_TOO_LATE");

    const staffResponse = await employee
      .post("/api/staff/bookings")
      .send(
        staffBooking(
          { type: "existing", hikerId: existingHikerId },
          { bookingDate: timedDate, slotId: timedSlotId },
        ),
      );

    expect(staffResponse.status).toBe(201);
    expect(staffResponse.body.booking.slotId).toBe(timedSlotId);
  });

  it("rejects staff bookings once the meal has started", async () => {
    setNow("2031-03-12T11:30:00.000Z");

    const employee = await loginAgent(employeeEmail, employeePassword, "staff");

    const response = await employee.post("/api/staff/bookings").send(
      staffBooking(temporaryHikerInput(), {
        bookingDate: timedDate,
        slotId: timedSlotId,
      }),
    );

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("BOOKING_TOO_LATE");
  });
});
