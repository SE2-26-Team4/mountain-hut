import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

// validation of staff bookings, independent of the database.

const mocks = vi.hoisted(() => {
  class BookingError extends Error {
    constructor(code, message) {
      super(message);
      this.name = 'BookingError';
      this.code = code;
    }
  }

  return {
    BookingError,
    createBooking: vi.fn(),
    createStaffBooking: vi.fn(),
    registerHiker: vi.fn(),
    getBookingsByDateAndSlot: vi.fn(),
    searchHikers: vi.fn(),
    getMealSlotCapacity: vi.fn(),
    getMealSlots: vi.fn(),
    generateInitialPassword: vi.fn(),
    hashPassword: vi.fn(),
  };
});

vi.mock('../../dao/booking-dao.js', () => ({
  BookingError: mocks.BookingError,
  createBooking: mocks.createBooking,
  createStaffBooking: mocks.createStaffBooking,
  registerHiker: mocks.registerHiker,
  getBookingsByDateAndSlot: mocks.getBookingsByDateAndSlot,
}));

vi.mock('../../dao/auth-dao.js', () => ({
  searchHikers: mocks.searchHikers,
}));

vi.mock('../../dao/capacity-dao.js', () => ({
  getMealSlotCapacity: mocks.getMealSlotCapacity,
  getMealSlots: mocks.getMealSlots,
}));

vi.mock('../../services/password.js', () => ({
  generateInitialPassword: mocks.generateInitialPassword,
  hashPassword: mocks.hashPassword,
}));

import {
  createBookingByStaff,
  findHikers,
  registerHikerByStaff,
} from '../../services/booking-service.js';

const GENERATED_PASSWORD = 'Generated_Pass-01';
const PASSWORD_HASH = 'scrypt$generated-hash';

// Today in Rome is 2026-11-11 for every test.
const today = '2026-11-11';

const savedBooking = {
  id: 100,
  hikerId: 7,
  bookingDate: today,
  slotId: 1,
  partySize: 2,
  specialRequests: '',
  status: 'confirmed',
  allocations: [{ tableId: 10, seatsReserved: 2 }],
};

function hikerProfile(overrides = {}) {
  return {
    id: 7,
    fullName: 'Mario Rossi',
    email: 'mario.rossi@example.com',
    phone: '+393331234567',
    notes: null,
    emergencyContact: null,
    isTemporary: false,
    mustChangePassword: false,
    ...overrides,
  };
}

function bookingRequest(hiker, overrides = {}) {
  return {
    hiker,
    bookingDate: today,
    slotId: 1,
    partySize: 2,
    ...overrides,
  };
}

function newHikerInput(overrides = {}) {
  return {
    type: 'new',
    fullName: '  Mario Rossi  ',
    email: '  Mario.Rossi@Example.COM ',
    phone: '+39 333 123-4567',
    notes: '  Registered mountain guide ',
    emergencyContact: '',
    ...overrides,
  };
}

function temporaryHikerInput(overrides = {}) {
  return {
    type: 'temporary',
    fullName: ' Walk-in Party ',
    ...overrides,
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-11T09:00:00Z'));

  mocks.generateInitialPassword.mockReturnValue(GENERATED_PASSWORD);
  mocks.hashPassword.mockResolvedValue(PASSWORD_HASH);
  mocks.createStaffBooking.mockImplementation(async ({ hiker }) => ({
    booking: savedBooking,
    hiker:
      'newHiker' in hiker
        ? hikerProfile({ id: 8, ...hiker.newHiker })
        : hikerProfile({ id: hiker.existingHikerId }),
  }));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('createBookingByStaff', () => {
  it('books an existing hiker selected by ID', async () => {
    const result = await createBookingByStaff(
      bookingRequest(
        { type: 'existing', hikerId: 7 },
        { specialRequests: '  2 vegetarians  ' }
      )
    );

    expect(mocks.createStaffBooking).toHaveBeenCalledWith({
      hiker: { existingHikerId: 7 },
      bookingDate: today,
      slotId: 1,
      partySize: 2,
      specialRequests: '2 vegetarians',
    });

    expect(result).toEqual({
      booking: savedBooking,
      hiker: hikerProfile(),
    });

    expect(mocks.hashPassword).not.toHaveBeenCalled();
  });

  it('creates a new hiker with a generated password to communicate', async () => {
    const result = await createBookingByStaff(
      bookingRequest(newHikerInput())
    );

    // Values are trimmed, the email is lowercase and the phone has no separators.
    expect(mocks.createStaffBooking).toHaveBeenCalledWith({
      hiker: {
        newHiker: {
          fullName: 'Mario Rossi',
          email: 'mario.rossi@example.com',
          phone: '+393331234567',
          notes: 'Registered mountain guide',
          emergencyContact: null,
          passwordHash: PASSWORD_HASH,
          isTemporary: false,
          mustChangePassword: true,
        },
      },
      bookingDate: today,
      slotId: 1,
      partySize: 2,
      specialRequests: '',
    });

    // Only the hash is saved; the plain password is kept for email delivery.
    expect(mocks.hashPassword).toHaveBeenCalledWith(GENERATED_PASSWORD);
    expect(result.initialPassword).toBe(GENERATED_PASSWORD);
    expect(result.hiker).toMatchObject({ mustChangePassword: true });
  });

  it('accepts a new hiker without the optional fields', async () => {
    await createBookingByStaff(
      bookingRequest(
        newHikerInput({ notes: undefined, emergencyContact: null })
      )
    );

    expect(mocks.createStaffBooking).toHaveBeenCalledWith(
      expect.objectContaining({
        hiker: {
          newHiker: expect.objectContaining({
            notes: null,
            emergencyContact: null,
          }),
        },
      })
    );
  });

  it('creates a temporary hiker with only a name and a phone', async () => {
    const result = await createBookingByStaff(
      bookingRequest(temporaryHikerInput({ phone: ' (0165) 12.34.56 ' }))
    );

    expect(mocks.createStaffBooking).toHaveBeenCalledWith(
      expect.objectContaining({
        hiker: {
          newHiker: {
            fullName: 'Walk-in Party',
            email: null,
            phone: '0165123456',
            notes: null,
            emergencyContact: null,
            passwordHash: null,
            isTemporary: true,
            mustChangePassword: false,
          },
        },
      })
    );

    // Temporary hikers cannot log in, so no password is generated.
    expect(mocks.generateInitialPassword).not.toHaveBeenCalled();
    expect(mocks.hashPassword).not.toHaveBeenCalled();
    expect(result).not.toHaveProperty('initialPassword');
  });

  it.each([
    ['missing', undefined],
    ['null', null],
    ['blank', '   '],
  ])('accepts a temporary hiker with a %s phone', async (_label, phone) => {
    await createBookingByStaff(
      bookingRequest(temporaryHikerInput({ phone }))
    );

    expect(mocks.createStaffBooking).toHaveBeenCalledWith(
      expect.objectContaining({
        hiker: {
          newHiker: expect.objectContaining({ phone: null }),
        },
      })
    );
  });

  // The start time of the slot is checked by the DAO in the transaction.
  it('allows staff bookings for today', async () => {
    await createBookingByStaff(
      bookingRequest({ type: 'existing', hikerId: 7 })
    );

    expect(mocks.createStaffBooking).toHaveBeenCalledWith(
      expect.objectContaining({ bookingDate: today })
    );
  });

  it.each([
    ['a past date', { bookingDate: '2026-11-10' }, 'INVALID_BOOKING'],
    ['an impossible date', { bookingDate: '2026-02-30' }, 'INVALID_BOOKING'],
    ['an invalid slot', { slotId: 0 }, 'INVALID_BOOKING'],
    ['a zero party size', { partySize: 0 }, 'INVALID_PARTY_SIZE'],
    ['a fractional party size', { partySize: 1.5 }, 'INVALID_PARTY_SIZE'],
    ['non-text requests', { specialRequests: 3 }, 'INVALID_BOOKING'],
    [
      'too long requests',
      { specialRequests: 'a'.repeat(1001) },
      'INVALID_BOOKING',
    ],
  ])('rejects %s before creating any hiker', async (_label, changes, code) => {
    await expect(
      createBookingByStaff(bookingRequest(newHikerInput(), changes))
    ).rejects.toMatchObject({ code });

    expect(mocks.hashPassword).not.toHaveBeenCalled();
    expect(mocks.createStaffBooking).not.toHaveBeenCalled();
  });

  it.each([
    ['no hiker', undefined],
    ['a hiker that is not an object', 'Mario Rossi'],
    ['a hiker without type', { fullName: 'Mario Rossi' }],
    ['an unknown hiker type', { type: 'guest', fullName: 'Mario Rossi' }],
    ['an existing hiker without ID', { type: 'existing' }],
    ['an existing hiker with ID 0', { type: 'existing', hikerId: 0 }],
    ['an existing hiker with a text ID', { type: 'existing', hikerId: '7' }],
    ['an existing hiker with a fractional ID', { type: 'existing', hikerId: 1.5 }],
    ['a new hiker without name', newHikerInput({ fullName: undefined })],
    ['a new hiker with a blank name', newHikerInput({ fullName: '   ' })],
    ['a new hiker with a non-text name', newHikerInput({ fullName: 42 })],
    ['a new hiker with a too long name', newHikerInput({ fullName: 'a'.repeat(101) })],
    ['a new hiker without email', newHikerInput({ email: undefined })],
    ['a new hiker with an invalid email', newHikerInput({ email: 'mario.example.com' })],
    ['a new hiker with an email without domain', newHikerInput({ email: 'mario@example' })],
    [
      'a new hiker with a too long email',
      newHikerInput({ email: `${'a'.repeat(250)}@example.com` }),
    ],
    ['a new hiker with a too short phone', newHikerInput({ phone: '12345' })],
    ['a new hiker with a too long phone', newHikerInput({ phone: '1234567890123456' })],
    ['a new hiker with letters in the phone', newHikerInput({ phone: '333-ABC-4567' })],
    ['a new hiker with a phone over 30 characters', newHikerInput({ phone: `+39 ${' '.repeat(30)}3331234567` })],
    ['a new hiker with non-text notes', newHikerInput({ notes: 12 })],
    ['a new hiker with too long notes', newHikerInput({ notes: 'a'.repeat(501) })],
    [
      'a new hiker with a too long emergency contact',
      newHikerInput({ emergencyContact: 'a'.repeat(501) }),
    ],
    ['a temporary hiker without name', temporaryHikerInput({ fullName: '' })],
    ['a temporary hiker with an invalid phone', temporaryHikerInput({ phone: '12' })],
    ['a temporary hiker with a numeric phone', temporaryHikerInput({ phone: 3331234567 })],
  ])('rejects %s', async (_label, hiker) => {
    await expect(
      createBookingByStaff(bookingRequest(hiker))
    ).rejects.toMatchObject({ code: 'INVALID_HIKER' });

    expect(mocks.hashPassword).not.toHaveBeenCalled();
    expect(mocks.createStaffBooking).not.toHaveBeenCalled();
  });

  it('propagates errors reported by the DAO', async () => {
    const error = new mocks.BookingError(
      'EMAIL_ALREADY_REGISTERED',
      'An account with this email already exists.'
    );

    mocks.createStaffBooking.mockRejectedValue(error);

    await expect(
      createBookingByStaff(bookingRequest(newHikerInput()))
    ).rejects.toBe(error);
  });
});

describe('registerHikerByStaff', () => {
  it('registers a new hiker and returns the initial password', async () => {
    mocks.registerHiker.mockImplementation(async (record) =>
      hikerProfile({ id: 9, ...record })
    );

    const result = await registerHikerByStaff(newHikerInput());

    expect(mocks.registerHiker).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'mario.rossi@example.com',
        passwordHash: PASSWORD_HASH,
        mustChangePassword: true,
      })
    );

    expect(result).toMatchObject({
      hiker: { id: 9, email: 'mario.rossi@example.com' },
      initialPassword: GENERATED_PASSWORD,
    });
  });

  it('registers a temporary hiker without password', async () => {
    mocks.registerHiker.mockImplementation(async (record) =>
      hikerProfile({ id: 10, ...record })
    );

    const result = await registerHikerByStaff(
      temporaryHikerInput({ phone: '+41 79 123 45 67' })
    );

    expect(mocks.registerHiker).toHaveBeenCalledWith(
      expect.objectContaining({
        phone: '+41791234567',
        isTemporary: true,
        passwordHash: null,
      })
    );

    expect(result).toEqual({
      hiker: expect.objectContaining({ id: 10, isTemporary: true }),
    });
  });

  it.each([
    ['an existing hiker', { type: 'existing', hikerId: 7 }],
    ['a missing hiker', null],
    ['an unknown type', { type: 'guest', fullName: 'Mario Rossi' }],
    ['an invalid new hiker', newHikerInput({ email: 'invalid' })],
  ])('rejects %s', async (_label, hiker) => {
    await expect(
      registerHikerByStaff(hiker)
    ).rejects.toMatchObject({ code: 'INVALID_HIKER' });

    expect(mocks.registerHiker).not.toHaveBeenCalled();
  });
});

describe('findHikers', () => {
  it('searches with the trimmed term', async () => {
    const hikers = [hikerProfile()];

    mocks.searchHikers.mockResolvedValue(hikers);

    await expect(findHikers('  rossi ')).resolves.toBe(hikers);
    expect(mocks.searchHikers).toHaveBeenCalledWith('rossi');
  });

  it.each([
    ['a missing term', undefined],
    ['a non-text term', 42],
    ['a one-character term', ' r '],
    ['a too long term', 'a'.repeat(101)],
  ])('rejects %s', async (_label, term) => {
    await expect(findHikers(term)).rejects.toMatchObject({
      code: 'INVALID_HIKER',
    });

    expect(mocks.searchHikers).not.toHaveBeenCalled();
  });
});
