import request from "supertest";
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import app from "../../app.js";
import * as MenuDAO from "../../dao/menu-dao.js";
import { getMealSlotMenu, saveMealSlotMenu } from "../../dao/menu-dao.js";
import { getAsync, initializeDatabase, runAsync } from "../../db.js";
import { initializeAccounts } from "../../init/init-accounts.js";
import { hashPassword } from "../../services/password.js";

// Read the seeded hiker and employee credentials.
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

// Use unique names and credentials for fixtures created by this suite.
const uniqueSuffix = `${Date.now()}-${Math.random()}`;
const wardenEmail = `menu-warden-${uniqueSuffix}@example.com`;
const wardenPassword = "WardenTest123!";

// Every slot created here, removed with its menu after the suite.
const createdSlotIds = [];

let hikerAgent;
let employeeAgent;
let wardenAgent;

const menuPath = (slotId) => `/api/capacity/meal-slots/${slotId}/menu`;

/**
 * Inserts a slot directly, so tests can also create slots in the past.
 * A per-slot counter keeps names unique when a test runs once per case.
 */
async function insertSlot(slotDate, name, startTime, endTime) {
  const result = await runAsync(
    `INSERT INTO meal_slots (slot_date, name, start_time, end_time)
     VALUES (?, ?, ?, ?)`,
    [
      slotDate,
      `${name} ${uniqueSuffix} #${createdSlotIds.length}`,
      startTime,
      endTime,
    ],
  );

  createdSlotIds.push(result.lastID);

  return result.lastID;
}

// Authenticate an account and keep its session cookie for later requests.
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

beforeAll(async () => {
  await initializeDatabase();
  await initializeAccounts();

  // Add a warden account alongside the seeded employee and hiker.
  await runAsync(
    `INSERT INTO users (full_name, email, password_hash, role)
     VALUES (?, ?, ?, 'warden')`,
    ["Menu API Test Warden", wardenEmail, await hashPassword(wardenPassword)],
  );

  hikerAgent = await loginAgent(hikerEmail, hikerPassword);
  employeeAgent = await loginAgent(employeeEmail, employeePassword, "staff");
  wardenAgent = await loginAgent(wardenEmail, wardenPassword, "staff");
});

afterEach(() => {
  vi.restoreAllMocks();
});

afterAll(async () => {
  if (createdSlotIds.length > 0) {
    const placeholders = createdSlotIds.map(() => "?").join(", ");

    await runAsync(
      `DELETE FROM meal_slot_menus WHERE slot_id IN (${placeholders})`,
      createdSlotIds,
    );
    await runAsync(
      `DELETE FROM meal_slots WHERE id IN (${placeholders})`,
      createdSlotIds,
    );
  }

  await runAsync("DELETE FROM users WHERE email = ?", [wardenEmail]);
});

describe("menu write API: staff access", () => {
  it("rejects a request without a session and saves nothing", async () => {
    const slotId = await insertSlot("2091-10-01", "Dinner", "19:00", "21:00");

    const response = await request(app)
      .put(menuPath(slotId))
      .send({ content: "Soup" });

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("UNAUTHENTICATED");
    expect(await getMealSlotMenu(slotId)).toBeNull();
  });

  it("rejects a hiker and saves nothing", async () => {
    const slotId = await insertSlot("2091-10-02", "Dinner", "19:00", "21:00");

    const response = await hikerAgent
      .put(menuPath(slotId))
      .send({ content: "Soup" });

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("FORBIDDEN");
    expect(await getMealSlotMenu(slotId)).toBeNull();
  });

  it("lets an employee create a slot's menu, keeping the text as written", async () => {
    const slotId = await insertSlot("2091-10-03", "Dinner", "19:00", "21:00");
    const content = "**Soups**\n- Barley soup\n  - *with speck*\n";

    const response = await employeeAgent
      .put(menuPath(slotId))
      .send({ content });

    expect(response.status).toBe(200);
    expect(response.body.menu).toEqual({
      id: expect.any(Number),
      slotId,
      content,
      updatedAt: expect.any(String),
    });
    expect(await getMealSlotMenu(slotId)).toEqual(response.body.menu);
  });

  it("lets a warden replace an existing menu", async () => {
    const slotId = await insertSlot("2091-10-04", "Lunch", "12:00", "14:00");
    const existing = await saveMealSlotMenu(slotId, "Soup");

    const response = await wardenAgent
      .put(menuPath(slotId))
      .send({ content: "Soup and salad" });

    expect(response.status).toBe(200);
    expect(response.body.menu).toMatchObject({
      id: existing.id,
      slotId,
      content: "Soup and salad",
    });
    expect(await getMealSlotMenu(slotId)).toEqual(response.body.menu);
  });
});

describe("menu write API: invalid requests", () => {
  it.each([
    ["missing content", {}],
    ["content that is not text", { content: 42 }],
    ["blank content", { content: " \n\t " }],
  ])("rejects %s and saves nothing", async (_, payload) => {
    const slotId = await insertSlot("2091-10-05", "Dinner", "19:00", "21:00");

    const response = await employeeAgent.put(menuPath(slotId)).send(payload);

    expect(response.status).toBe(400);
    expect(response.body.error).toEqual({
      code: "INVALID_MENU",
      message: "Menu text must not be empty.",
    });
    expect(await getMealSlotMenu(slotId)).toBeNull();
  });

  it("rejects a request without a body and saves nothing", async () => {
    const slotId = await insertSlot("2091-10-06", "Dinner", "19:00", "21:00");

    const response = await employeeAgent.put(menuPath(slotId));

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("INVALID_MENU");
    expect(await getMealSlotMenu(slotId)).toBeNull();
  });

  it.each(["abc", "0", "1.5", "-3", "9007199254740993"])(
    "rejects the slot ID %s",
    async (slotId) => {
      const response = await employeeAgent
        .put(menuPath(slotId))
        .send({ content: "Soup" });

      expect(response.status).toBe(400);
      expect(response.body.error).toEqual({
        code: "INVALID_MENU",
        message: "Target slot ID must be a positive safe integer.",
      });
    },
  );
});

describe("menu write API: slot state", () => {
  it("returns 404 for a missing slot and saves nothing", async () => {
    const { missingId } = await getAsync(
      "SELECT COALESCE(MAX(id), 0) + 1 AS missingId FROM meal_slots",
    );

    const response = await employeeAgent
      .put(menuPath(missingId))
      .send({ content: "Soup" });

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("MEAL_SLOT_NOT_FOUND");
    expect(
      await getAsync(
        "SELECT COUNT(*) AS count FROM meal_slot_menus WHERE slot_id = ?",
        [missingId],
      ),
    ).toEqual({ count: 0 });
  });

  // TODO(MH-10): no task enforces that a menu changes only before its slot.
  // Enable once a layer rejects it, expecting the menu to stay unchanged.
  it.todo("refuses to change the menu of a slot that has started");

  it("returns a generic 500 error for unexpected failures", async () => {
    const slotId = await insertSlot("2091-10-08", "Dinner", "19:00", "21:00");

    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(MenuDAO, "saveMealSlotMenu").mockRejectedValueOnce(
      new Error("Database unavailable"),
    );

    const response = await employeeAgent
      .put(menuPath(slotId))
      .send({ content: "Soup" });

    expect(response.status).toBe(500);
    expect(response.body.error).toEqual({
      code: "INTERNAL_SERVER_ERROR",
      message: "An unexpected error occurred.",
    });
  });
});
