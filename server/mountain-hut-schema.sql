PRAGMA foreign_keys = ON;

BEGIN TRANSACTION;

CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  full_name TEXT NOT NULL CHECK (length(trim(full_name)) > 0),
  email TEXT NOT NULL UNIQUE COLLATE NOCASE
    CHECK (length(trim(email)) > 0),
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL
    CHECK (role IN ('hiker', 'employee', 'warden')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE meal_slots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE CHECK (length(trim(name)) > 0),
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1))
);

CREATE TABLE dining_tables (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE CHECK (length(trim(name)) > 0),
  seat_count INTEGER NOT NULL CHECK (seat_count > 0),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1))
);

CREATE TABLE slot_tables (
  slot_id INTEGER NOT NULL REFERENCES meal_slots(id),
  table_id INTEGER NOT NULL REFERENCES dining_tables(id),
  PRIMARY KEY (slot_id, table_id)
);

CREATE TABLE bookings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  hiker_id INTEGER NOT NULL REFERENCES users(id),
  booking_date TEXT NOT NULL,
  slot_id INTEGER NOT NULL REFERENCES meal_slots(id),
  party_size INTEGER NOT NULL CHECK (party_size > 0),
  status TEXT NOT NULL DEFAULT 'confirmed'
    CHECK (status IN ('confirmed', 'cancelled')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE booking_table_allocations (
  booking_id INTEGER NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  table_id INTEGER NOT NULL REFERENCES dining_tables(id),
  seats_reserved INTEGER NOT NULL CHECK (seats_reserved > 0),
  PRIMARY KEY (booking_id, table_id)
);

CREATE INDEX idx_bookings_date_slot_status
  ON bookings(booking_date, slot_id, status);

CREATE INDEX idx_booking_allocations_table
  ON booking_table_allocations(table_id);

COMMIT;
