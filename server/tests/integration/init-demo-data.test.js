import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const now = new Date("2026-11-21T12:00:00Z");

let db;
let initializeDemoData;

beforeEach(async () => {
  vi.resetModules();
  vi.stubEnv("DB_PATH", ":memory:");
  vi.stubEnv("SEED_DEMO_DATA", "true");
  vi.stubEnv("TEST_HIKER_EMAIL", "demo@example.com");

  db = await import("../../db.js");
  ({ initializeDemoData } = await import("../../init/init-demo-data.js"));
  await db.initializeDatabase();
});

afterEach(async () => {
  try {
    await new Promise((resolve, reject) => {
      db.default.close((error) => (error ? reject(error) : resolve()));
    });
  } finally {
    vi.unstubAllEnvs();
  }
});

describe("demo booking data", () => {
  it("leaves the schedule empty when demo data is disabled", async () => {
    vi.stubEnv("SEED_DEMO_DATA", "false");

    await initializeDemoData(now);

    expect(await db.allAsync("SELECT id FROM dining_tables")).toEqual([]);
    expect(await db.allAsync("SELECT id FROM meal_slots")).toEqual([]);
    expect(await db.allAsync("SELECT id FROM bookings")).toEqual([]);
  });

  it("preserves a schedule already configured by staff", async () => {
    await db.runAsync(
      "INSERT INTO dining_tables (name, seat_count) VALUES (?, ?)",
      ["Staff table", 4],
    );

    await initializeDemoData(now);

    expect(await db.allAsync("SELECT name FROM dining_tables")).toEqual([
      { name: "Staff table" },
    ]);
    expect(await db.allAsync("SELECT id FROM meal_slots")).toEqual([]);
  });

  it("reports a missing demo hiker without leaving partial data", async () => {
    await expect(initializeDemoData(now)).rejects.toThrow(
      "Demo data requires a demo hiker",
    );

    expect(await db.allAsync("SELECT id FROM dining_tables")).toEqual([]);
    expect(await db.allAsync("SELECT id FROM bookings")).toEqual([]);
  });

  it("uses the default demo hiker when TEST_HIKER_EMAIL is unset", async () => {
    vi.stubEnv("TEST_HIKER_EMAIL", undefined);

    const hiker = await db.runAsync(
      `INSERT INTO users (full_name, email, password_hash, role)
       VALUES (?, ?, ?, 'hiker')`,
      ["Demo Hiker", "hiker@example.com", "unused-test-hash"],
    );

    await initializeDemoData(now);

    const bookings = await db.getAsync(
      "SELECT COUNT(*) AS total FROM bookings WHERE hiker_id = ?",
      [hiker.lastID],
    );
    expect(bookings).toEqual({ total: 9 });
  });

  it("creates three bookings per filter and preserves later changes", async () => {
    const hiker = await db.runAsync(
      `INSERT INTO users (full_name, email, password_hash, role)
       VALUES (?, ?, ?, 'hiker')`,
      ["Demo Hiker", "demo@example.com", "unused-test-hash"],
    );

    await initializeDemoData(now);

    const groups = await db.allAsync(
      `SELECT CASE
                WHEN status = 'cancelled' THEN 'Cancelled'
                WHEN booking_date < ? THEN 'Past'
                ELSE 'Upcoming'
              END AS category,
              COUNT(*) AS total
       FROM bookings
       WHERE hiker_id = ?
       GROUP BY category
       ORDER BY category`,
      ["2026-11-21", hiker.lastID],
    );

    expect(groups).toEqual([
      { category: "Cancelled", total: 3 },
      { category: "Past", total: 3 },
      { category: "Upcoming", total: 3 },
    ]);

    const dinner = await db.getAsync(
      `SELECT s.id, SUM(t.seat_count) AS seats, COUNT(t.id) AS tables
       FROM meal_slots s
       JOIN slot_tables st ON st.slot_id = s.id
       JOIN dining_tables t ON t.id = st.table_id
       WHERE s.slot_date = ? AND s.name = 'Dinner'
       GROUP BY s.id`,
      ["2026-11-28"],
    );

    expect(dinner).toMatchObject({ seats: 6, tables: 2 });
    expect(
      await db.allAsync("SELECT id FROM bookings WHERE slot_id = ?", [
        dinner.id,
      ]),
    ).toEqual([]);

    await db.runAsync(
      "UPDATE bookings SET status = 'cancelled' WHERE booking_date = ?",
      ["2026-11-28"],
    );

    await initializeDemoData(now);

    expect(await db.getAsync("SELECT COUNT(*) AS total FROM bookings")).toEqual(
      {
        total: 9,
      },
    );
    expect(
      await db.getAsync("SELECT status FROM bookings WHERE booking_date = ?", [
        "2026-11-28",
      ]),
    ).toEqual({ status: "cancelled" });
  });
});
