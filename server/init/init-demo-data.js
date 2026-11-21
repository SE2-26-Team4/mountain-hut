import { withTransaction } from "../db.js";

const hutDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Rome",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/**
 * Returns a YYYY-MM-DD date relative to the current day at the hut.
 * @param {Date} now
 * @param {number} daysAhead
 */
function getDemoDate(now, daysAhead) {
  const todayAtHut = hutDateFormatter.format(now);
  const date = new Date(`${todayAtHut}T00:00:00Z`);

  date.setUTCDate(date.getUTCDate() + daysAhead);
  return date.toISOString().slice(0, 10);
}

/**
 * Creates the demo hiker's bookings and an available dinner for six guests.
 * @param {import("../db.js").TransactionQueries} queries
 * @param {number} hikerId
 * @param {Date} now
 */
async function createDemoSchedule(queries, hikerId, now) {
  const smallTable = await queries.runAsync(
    "INSERT INTO dining_tables (name, seat_count) VALUES (?, ?)",
    ["Demo table A", 2],
  );

  const largeTable = await queries.runAsync(
    "INSERT INTO dining_tables (name, seat_count) VALUES (?, ?)",
    ["Demo table B", 4],
  );

  const lunches = [
    // Upcoming: tomorrow's lunch is within the 48-hour editing deadline.
    {
      daysAhead: 1,
      partySize: 2,
      tableId: smallTable.lastID,
      status: "confirmed",
    },
    {
      daysAhead: 7,
      partySize: 4,
      tableId: largeTable.lastID,
      status: "confirmed",
    },
    {
      daysAhead: 9,
      partySize: 3,
      tableId: largeTable.lastID,
      status: "confirmed",
    },

    // Past: the UI identifies these confirmed bookings by their meal date.
    {
      daysAhead: -3,
      partySize: 3,
      tableId: largeTable.lastID,
      status: "confirmed",
    },
    {
      daysAhead: -6,
      partySize: 3,
      tableId: largeTable.lastID,
      status: "confirmed",
    },
    {
      daysAhead: -9,
      partySize: 3,
      tableId: largeTable.lastID,
      status: "confirmed",
    },

    // Cancelled bookings retain their allocations but no longer occupy seats.
    {
      daysAhead: 3,
      partySize: 3,
      tableId: largeTable.lastID,
      status: "cancelled",
    },
    {
      daysAhead: 6,
      partySize: 3,
      tableId: largeTable.lastID,
      status: "cancelled",
    },
    {
      daysAhead: 12,
      partySize: 3,
      tableId: largeTable.lastID,
      status: "cancelled",
    },
  ];

  for (const { daysAhead, partySize, tableId, status } of lunches) {
    const date = getDemoDate(now, daysAhead);
    const slot = await queries.runAsync(
      `INSERT INTO meal_slots (slot_date, name, start_time, end_time)
       VALUES (?, 'Lunch', '12:00', '13:00')`,
      [date],
    );

    await queries.runAsync(
      "INSERT INTO slot_tables (slot_id, table_id) VALUES (?, ?)",
      [slot.lastID, tableId],
    );

    // Give historical bookings a creation date before their meal.
    const createdAt =
      daysAhead < 0
        ? `${getDemoDate(now, daysAhead - 3)}T09:00:00.000Z`
        : now.toISOString();

    const booking = await queries.runAsync(
      `INSERT INTO bookings
         (hiker_id, booking_date, slot_id, party_size, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [hikerId, date, slot.lastID, partySize, status, createdAt],
    );

    await queries.runAsync(
      `INSERT INTO booking_table_allocations
         (booking_id, table_id, seats_reserved)
       VALUES (?, ?, ?)`,
      [booking.lastID, tableId, partySize],
    );
  }

  // Both tables are available for the split-seating demo.
  const dinner = await queries.runAsync(
    `INSERT INTO meal_slots (slot_date, name, start_time, end_time)
     VALUES (?, 'Dinner', '19:00', '20:00')`,
    [getDemoDate(now, 7)],
  );

  await queries.runAsync(
    `INSERT INTO slot_tables (slot_id, table_id)
     VALUES (?, ?), (?, ?)`,
    [dinner.lastID, smallTable.lastID, dinner.lastID, largeTable.lastID],
  );
}

/**
 * Seeds an empty schedule once, using the configured demo hiker.
 * @param {Date} [now]
 */
export async function initializeDemoData(now = new Date()) {
  if (process.env.SEED_DEMO_DATA !== "true") {
    return;
  }

  await withTransaction(async (queries) => {
    await queries.runAsync(`
      CREATE TABLE IF NOT EXISTS demo_data_runs (
        name TEXT PRIMARY KEY
      )
    `);

    const seedName = "initial-booking-demo";
    const previousRun = await queries.getAsync(
      "SELECT 1 FROM demo_data_runs WHERE name = ?",
      [seedName],
    );

    if (previousRun) {
      return;
    }

    // Preserve any capacity that staff have already configured.
    const existingSchedule = await queries.getAsync(`
      SELECT 1 FROM dining_tables
      UNION ALL
      SELECT 1 FROM meal_slots
      LIMIT 1
    `);

    if (existingSchedule) {
      return;
    }

    const email = (process.env.TEST_HIKER_EMAIL ?? "hiker@example.com")
      .trim()
      .toLowerCase();

    const hiker = await queries.getAsync(
      `SELECT id FROM users
       WHERE email = ? AND role = 'hiker' AND is_temporary = 0`,
      [email],
    );

    if (!hiker) {
      throw new Error(
        "Demo data requires a demo hiker. Set SEED_DEMO_ACCOUNTS=true and check TEST_HIKER_EMAIL.",
      );
    }

    await createDemoSchedule(queries, hiker.id, now);

    await queries.runAsync("INSERT INTO demo_data_runs (name) VALUES (?)", [
      seedName,
    ]);
  });
}
