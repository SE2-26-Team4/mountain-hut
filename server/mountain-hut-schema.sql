PRAGMA foreign_keys = ON;

BEGIN TRANSACTION;

-- Staff can create temporary hikers with a name, optional phone,
-- and optional email. Temporary hikers have no password and cannot log in.
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  full_name TEXT NOT NULL CHECK (length(trim(full_name)) > 0),
  email TEXT UNIQUE COLLATE NOCASE
    CHECK (email IS NULL OR length(trim(email)) > 0),
  password_hash TEXT,
  role TEXT NOT NULL
    CHECK (role IN ('hiker', 'employee', 'warden')),
  phone TEXT,
  notes TEXT,
  emergency_contact TEXT,
  is_temporary INTEGER NOT NULL DEFAULT 0
    CHECK (is_temporary IN (0, 1)),
  must_change_password INTEGER NOT NULL DEFAULT 0
    CHECK (must_change_password IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CHECK (
    (is_temporary = 0
      AND email IS NOT NULL
      AND password_hash IS NOT NULL)
    OR (is_temporary = 1
      AND password_hash IS NULL
      AND role = 'hiker')
  )
);

CREATE TABLE meal_slots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slot_date TEXT NOT NULL,
  name TEXT NOT NULL CHECK (length(trim(name)) > 0),
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1
    CHECK (is_active IN (0, 1))
);

CREATE UNIQUE INDEX idx_meal_slots_name_times
  ON meal_slots (
    slot_date,
    trim(name) COLLATE NOCASE,
    start_time,
    end_time
  );

CREATE TABLE dining_tables (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE CHECK (length(trim(name)) > 0),
  seat_count INTEGER NOT NULL CHECK (seat_count > 0),
  is_active INTEGER NOT NULL DEFAULT 1
    CHECK (is_active IN (0, 1))
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
  dietary_requirements TEXT NOT NULL DEFAULT ''
    CHECK (length(dietary_requirements) <= 1000),
  special_requests TEXT NOT NULL DEFAULT ''
    CHECK (length(special_requests) <= 1000),
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