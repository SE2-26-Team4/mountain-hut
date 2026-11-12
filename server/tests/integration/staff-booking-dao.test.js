import { randomUUID } from 'node:crypto';

import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { getUserByEmail } from '../../dao/auth-dao.js';
import {
  createBooking,
  createStaffBooking,
  getBookingsByDateAndSlot,
  getBookingsByHiker,
  registerHiker,
} from '../../dao/booking-dao.js';
import {
  allAsync,
  getAsync,
  initializeDatabase,
  runAsync,
} from '../../db.js';
import { initializeAccounts } from '../../init/init-accounts.js';
import { hashPassword, verifyPassword } from '../../services/password.js';

// staff enter bookings for existing, new or temporary hikers.

const uniqueSuffix = randomUUID();

const seededHikerEmail = (
  process.env.TEST_HIKER_EMAIL ?? 'hiker@example.com'
).trim().toLowerCase();

const seededEmployeeEmail = (
  process.env.TEST_EMPLOYEE_EMAIL ?? 'employee@example.com'
).trim().toLowerCase();

// A far date for the general rules, and a date used with a fake clock.
const bookingDate = '2099-11-20';
const timedDate = '2030-03-10';

// The timed slot starts at 12:00 in Rome, i.e. 11:00 UTC (winter time).
const timedSlotStart = '2030-03-10T11:00:00.000Z';

const initialPassword = 'Initial-Password-1';

let existingHikerId;
let employeeId;
let slotId;
let timedSlotId;
let fourSeatTableId;
let sixSeatTableId;
let passwordHash;

beforeAll(async () => {
  await initializeDatabase();
  await initializeAccounts();

  existingHikerId = (
    await getAsync('SELECT id FROM users WHERE email = ?', [
      seededHikerEmail,
    ])
  ).id;

  employeeId = (
    await getAsync('SELECT id FROM users WHERE email = ?', [
      seededEmployeeEmail,
    ])
  ).id;

  slotId = (
    await runAsync(
      `INSERT INTO meal_slots (slot_date, name, start_time, end_time)
       VALUES (?, ?, '12:00', '14:00')`,
      [bookingDate, `Staff booking slot ${uniqueSuffix}`]
    )
  ).lastID;

  timedSlotId = (
    await runAsync(
      `INSERT INTO meal_slots (slot_date, name, start_time, end_time)
       VALUES (?, ?, '12:00', '14:00')`,
      [timedDate, `Staff booking timed slot ${uniqueSuffix}`]
    )
  ).lastID;

  fourSeatTableId = (
    await runAsync(
      `INSERT INTO dining_tables (name, seat_count) VALUES (?, 4)`,
      [`Staff booking table A ${uniqueSuffix}`]
    )
  ).lastID;

  sixSeatTableId = (
    await runAsync(
      `INSERT INTO dining_tables (name, seat_count) VALUES (?, 6)`,
      [`Staff booking table B ${uniqueSuffix}`]
    )
  ).lastID;

  passwordHash = await hashPassword(initialPassword);
});

// Delete allocations before bookings to respect foreign keys.
async function clearBookings() {
  await runAsync(
    `DELETE FROM booking_table_allocations
     WHERE booking_id IN (
       SELECT id FROM bookings WHERE slot_id IN (?, ?)
     )`,
    [slotId, timedSlotId]
  );

  await runAsync(
    'DELETE FROM bookings WHERE slot_id IN (?, ?)',
    [slotId, timedSlotId]
  );
}

// Delete the hikers created by these tests, recognisable by the suffix.
async function clearCreatedHikers() {
  await runAsync(
    'DELETE FROM users WHERE full_name LIKE ?',
    [`%${uniqueSuffix}%`]
  );
}

// Every test starts with no bookings and only the four-seat table assigned.
beforeEach(async () => {
  await clearBookings();
  await clearCreatedHikers();

  await runAsync(
    'DELETE FROM slot_tables WHERE slot_id IN (?, ?)',
    [slotId, timedSlotId]
  );

  await runAsync(
    'UPDATE meal_slots SET is_active = 1 WHERE id IN (?, ?)',
    [slotId, timedSlotId]
  );

  for (const id of [slotId, timedSlotId]) {
    await runAsync(
      'INSERT INTO slot_tables (slot_id, table_id) VALUES (?, ?)',
      [id, fourSeatTableId]
    );
  }
});

afterEach(() => {
  vi.useRealTimers();
});

afterAll(async () => {
  await clearBookings();
  await clearCreatedHikers();

  await runAsync(
    'DELETE FROM slot_tables WHERE slot_id IN (?, ?)',
    [slotId, timedSlotId]
  );

  await runAsync(
    'DELETE FROM meal_slots WHERE id IN (?, ?)',
    [slotId, timedSlotId]
  );

  await runAsync(
    'DELETE FROM dining_tables WHERE id IN (?, ?)',
    [fourSeatTableId, sixSeatTableId]
  );
});

/* FIXTURES */

function newHikerRecord(overrides = {}) {
  return {
    fullName: `New Hiker ${uniqueSuffix}`,
    email: `new-hiker-${uniqueSuffix}@example.com`,
    phone: '+393331234567',
    notes: 'Registered mountain guide',
    emergencyContact: 'Anna +39 333 7654321',
    passwordHash,
    isTemporary: false,
    mustChangePassword: true,
    ...overrides,
  };
}

function temporaryHikerRecord(overrides = {}) {
  return {
    fullName: `Walk-in Hiker ${uniqueSuffix}`,
    email: null,
    phone: '+41791234567',
    notes: null,
    emergencyContact: null,
    passwordHash: null,
    isTemporary: true,
    mustChangePassword: false,
    ...overrides,
  };
}

function staffBooking(hiker, overrides = {}) {
  return {
    hiker,
    bookingDate,
    slotId,
    partySize: 3,
    ...overrides,
  };
}

async function countUsersNamed(fullName) {
  const { total } = await getAsync(
    'SELECT COUNT(*) AS total FROM users WHERE full_name = ?',
    [fullName]
  );

  return total;
}

function setNow(instant) {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(instant));
}

/* TESTS */

describe('staff bookings for an existing hiker', () => {
  it('associates the booking with the selected hiker', async () => {
    const { booking, hiker } = await createStaffBooking(
      staffBooking(
        { existingHikerId },
        { specialRequests: '  1 vegan, peanut allergy  ' }
      )
    );

    expect(booking).toMatchObject({
      hikerId: existingHikerId,
      bookingDate,
      slotId,
      partySize: 3,
      specialRequests: '1 vegan, peanut allergy',
      status: 'confirmed',
      allocations: [{ tableId: fourSeatTableId, seatsReserved: 3 }],
    });

    expect(hiker).toMatchObject({
      id: existingHikerId,
      email: seededHikerEmail,
      isTemporary: false,
    });

    // The hiker sees the booking among their own reservations.
    const hikerBookings = await getBookingsByHiker(existingHikerId);

    expect(hikerBookings.map(({ id }) => id)).toContain(booking.id);
  });

  it('can book an existing temporary hiker again', async () => {
    const { hiker: walkIn } = await createStaffBooking(
      staffBooking({ newHiker: temporaryHikerRecord() }, { partySize: 1 })
    );

    await clearBookings();

    const { booking, hiker } = await createStaffBooking(
      staffBooking({ existingHikerId: walkIn.id }, { partySize: 2 })
    );

    expect(booking.hikerId).toBe(walkIn.id);
    expect(hiker).toEqual(walkIn);
  });

  it.each([
    ['a staff account', () => employeeId],
    ['a missing account', () => Number.MAX_SAFE_INTEGER],
  ])('rejects %s as the hiker', async (_label, id) => {
    await expect(
      createStaffBooking(staffBooking({ existingHikerId: id() }))
    ).rejects.toMatchObject({ code: 'HIKER_NOT_FOUND' });

    expect(
      await getBookingsByDateAndSlot(bookingDate, slotId)
    ).toHaveLength(0);
  });

  // only one booking per hiker for each date and meal service.
  it('rejects a second booking of the same hiker for the slot', async () => {
    await createBooking({
      hikerId: existingHikerId,
      bookingDate,
      slotId,
      partySize: 1,
    });

    await expect(
      createStaffBooking(staffBooking({ existingHikerId }))
    ).rejects.toMatchObject({
      code: 'DUPLICATE_BOOKING',
      message:
        'This hiker already has a confirmed booking for this date and meal service.',
    });
  });
});

describe('staff bookings for a new registered hiker', () => {
  it('creates an account that can log in and must change the password', async () => {
    const { booking, hiker } = await createStaffBooking(
      staffBooking({ newHiker: newHikerRecord() })
    );

    expect(hiker).toEqual({
      id: expect.any(Number),
      fullName: `New Hiker ${uniqueSuffix}`,
      email: `new-hiker-${uniqueSuffix}@example.com`,
      phone: '+393331234567',
      notes: 'Registered mountain guide',
      emergencyContact: 'Anna +39 333 7654321',
      isTemporary: false,
      mustChangePassword: true,
    });

    expect(booking).toMatchObject({
      hikerId: hiker.id,
      partySize: 3,
      status: 'confirmed',
    });

    // The login finds the account and accepts the communicated password.
    const account = await getUserByEmail(hiker.email);

    expect(account).toMatchObject({ id: hiker.id, role: 'hiker' });

    await expect(
      verifyPassword(initialPassword, account.password_hash)
    ).resolves.toBe(true);
  });

  it('rejects an email already used by another account', async () => {
    await expect(
      createStaffBooking(
        staffBooking({
          newHiker: newHikerRecord({
            email: seededHikerEmail.toUpperCase(),
          }),
        })
      )
    ).rejects.toMatchObject({ code: 'EMAIL_ALREADY_REGISTERED' });

    expect(await countUsersNamed(`New Hiker ${uniqueSuffix}`)).toBe(0);

    expect(
      await getBookingsByDateAndSlot(bookingDate, slotId)
    ).toHaveLength(0);
  });
});

describe('staff bookings for a temporary hiker', () => {
  it('creates a hiker without email or password, who cannot log in', async () => {
    const { booking, hiker } = await createStaffBooking(
      staffBooking({ newHiker: temporaryHikerRecord() }, { partySize: 2 })
    );

    expect(hiker).toEqual({
      id: expect.any(Number),
      fullName: `Walk-in Hiker ${uniqueSuffix}`,
      email: null,
      phone: '+41791234567',
      notes: null,
      emergencyContact: null,
      isTemporary: true,
      mustChangePassword: false,
    });

    expect(booking).toMatchObject({
      hikerId: hiker.id,
      partySize: 2,
      status: 'confirmed',
    });

    expect(
      await getAsync(
        'SELECT email, password_hash, role FROM users WHERE id = ?',
        [hiker.id]
      )
    ).toEqual({ email: null, password_hash: null, role: 'hiker' });
  });

  it('accepts a temporary hiker without phone', async () => {
    const { hiker } = await createStaffBooking(
      staffBooking({ newHiker: temporaryHikerRecord({ phone: null }) })
    );

    expect(hiker).toMatchObject({ phone: null, isTemporary: true });
  });
});

describe('availability rules shared with hiker bookings', () => {
  it('splits a large party across tables like a hiker booking', async () => {
    await runAsync(
      'INSERT INTO slot_tables (slot_id, table_id) VALUES (?, ?)',
      [slotId, sixSeatTableId]
    );

    const { booking } = await createStaffBooking(
      staffBooking({ existingHikerId }, { partySize: 8 })
    );

    expect(booking.allocations).toEqual([
      { tableId: sixSeatTableId, seatsReserved: 6 },
      { tableId: fourSeatTableId, seatsReserved: 2 },
    ]);
  });

  it('counts seats booked by hikers and by staff together', async () => {
    await createBooking({
      hikerId: existingHikerId,
      bookingDate,
      slotId,
      partySize: 3,
    });

    await expect(
      createStaffBooking(
        staffBooking({ newHiker: temporaryHikerRecord() }, { partySize: 2 })
      )
    ).rejects.toMatchObject({ code: 'NO_AVAILABILITY' });

    // The remaining seat is shared at the same table.
    const { booking } = await createStaffBooking(
      staffBooking({ newHiker: temporaryHikerRecord() }, { partySize: 1 })
    );

    expect(booking.allocations).toEqual([
      { tableId: fourSeatTableId, seatsReserved: 1 },
    ]);
  });

  it.each([
    ['inactive', 'SLOT_INACTIVE'],
    ['on another date', 'INVALID_BOOKING'],
  ])('rejects a slot that is %s', async (condition, code) => {
    if (condition === 'inactive') {
      await runAsync(
        'UPDATE meal_slots SET is_active = 0 WHERE id = ?',
        [slotId]
      );
    }

    await expect(
      createStaffBooking(
        staffBooking(
          { existingHikerId },
          condition === 'inactive' ? {} : { bookingDate: '2099-11-21' }
        )
      )
    ).rejects.toMatchObject({ code });
  });

  it.each([
    ['party size', { partySize: 0 }, 'INVALID_PARTY_SIZE'],
    ['special requests', { specialRequests: 42 }, 'INVALID_BOOKING'],
  ])('validates the %s before creating the hiker', async (_label, changes, code) => {
    await expect(
      createStaffBooking(
        staffBooking({ newHiker: newHikerRecord() }, changes)
      )
    ).rejects.toMatchObject({ code });

    expect(await countUsersNamed(`New Hiker ${uniqueSuffix}`)).toBe(0);
  });
});

describe('atomic creation of hiker and booking', () => {
  // If the booking is rejected, no account must be left behind.
  it.each([
    ['a new registered hiker', () => newHikerRecord()],
    ['a temporary hiker', () => temporaryHikerRecord()],
  ])('does not keep %s when there are not enough seats', async (_label, record) => {
    const newHiker = record();

    await expect(
      createStaffBooking(staffBooking({ newHiker }, { partySize: 5 }))
    ).rejects.toMatchObject({ code: 'NO_AVAILABILITY' });

    expect(await countUsersNamed(newHiker.fullName)).toBe(0);

    // The rolled-back transaction does not block the next booking.
    const { booking } = await createStaffBooking(
      staffBooking({ newHiker }, { partySize: 4 })
    );

    expect(booking.status).toBe('confirmed');
  });
});

describe('time limit for staff bookings', () => {
  function timedBooking(hiker) {
    return staffBooking(hiker, {
      bookingDate: timedDate,
      slotId: timedSlotId,
    });
  }

  // Hikers must book two hours ahead; staff can still book at the door.
  it('accepts a staff booking within two hours of the meal service', async () => {
    setNow('2030-03-10T10:00:00.000Z');

    await expect(
      createBooking({
        hikerId: existingHikerId,
        bookingDate: timedDate,
        slotId: timedSlotId,
        partySize: 3,
      })
    ).rejects.toMatchObject({
      code: 'BOOKING_TOO_LATE',
      message: 'Bookings close two hours before the meal service starts.',
    });

    const { booking } = await createStaffBooking(
      timedBooking({ existingHikerId })
    );

    expect(booking).toMatchObject({
      hikerId: existingHikerId,
      slotId: timedSlotId,
      status: 'confirmed',
    });
  });

  it('accepts a staff booking until the last moment before the start', async () => {
    setNow(Date.parse(timedSlotStart) - 1);

    const { booking } = await createStaffBooking(
      timedBooking({ newHiker: temporaryHikerRecord() })
    );

    expect(booking.status).toBe('confirmed');
  });

  it.each([
    ['at the start', timedSlotStart],
    ['during the service', '2030-03-10T12:30:00.000Z'],
    ['after the service', '2030-03-10T15:00:00.000Z'],
  ])('rejects a staff booking %s of the meal service', async (_label, instant) => {
    setNow(instant);

    await expect(
      createStaffBooking(timedBooking({ existingHikerId }))
    ).rejects.toMatchObject({
      code: 'BOOKING_TOO_LATE',
      message: 'Bookings cannot be made after the meal service has started.',
    });

    expect(
      await getBookingsByDateAndSlot(timedDate, timedSlotId)
    ).toHaveLength(0);
  });

  it('does not create the hiker of a rejected late booking', async () => {
    setNow(timedSlotStart);

    await expect(
      createStaffBooking(timedBooking({ newHiker: newHikerRecord() }))
    ).rejects.toMatchObject({ code: 'BOOKING_TOO_LATE' });

    expect(await countUsersNamed(`New Hiker ${uniqueSuffix}`)).toBe(0);
  });
});

describe('registering a hiker without a booking', () => {
  it('registers a full hiker who must change the password', async () => {
    const hiker = await registerHiker(newHikerRecord());

    expect(hiker).toMatchObject({
      email: `new-hiker-${uniqueSuffix}@example.com`,
      isTemporary: false,
      mustChangePassword: true,
    });

    const bookings = await allAsync(
      'SELECT id FROM bookings WHERE hiker_id = ?',
      [hiker.id]
    );

    expect(bookings).toHaveLength(0);
  });

  it('registers temporary hikers with the same name separately', async () => {
    const first = await registerHiker(temporaryHikerRecord());
    const second = await registerHiker(temporaryHikerRecord());

    expect(second.id).not.toBe(first.id);
    expect(await countUsersNamed(`Walk-in Hiker ${uniqueSuffix}`)).toBe(2);
  });

  it('rejects an email already registered', async () => {
    await registerHiker(newHikerRecord());

    await expect(
      registerHiker(
        newHikerRecord({ fullName: `Duplicate Hiker ${uniqueSuffix}` })
      )
    ).rejects.toMatchObject({ code: 'EMAIL_ALREADY_REGISTERED' });

    expect(
      await countUsersNamed(`Duplicate Hiker ${uniqueSuffix}`)
    ).toBe(0);
  });
});
