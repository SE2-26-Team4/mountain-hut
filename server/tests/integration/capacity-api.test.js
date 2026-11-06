import request from 'supertest';
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import app from '../../app.js';
import capacityRoutes from '../../routes/capacity-routes.js';
import * as CapacityDAO from '../../dao/capacity-dao.js';
import * as CapacityValidation from '../../services/capacity-validation.js';
import {
  createDiningTable,
  createMealSlot,
  setMealSlotTables,
} from '../../dao/capacity-dao.js';
import { initializeDatabase, runAsync } from '../../db.js';
import { initializeAccounts } from '../../init/init-accounts.js';
import { hashPassword } from '../../services/password.js';

// Read the seeded hiker credentials and normalize the email.
const hikerEmail = (
  process.env.TEST_HIKER_EMAIL ?? 'hiker@example.com'
).trim().toLowerCase();

const hikerPassword =
  process.env.TEST_HIKER_PASSWORD ?? 'HikerTest123!';

// Read the seeded employee credentials and normalize the email.
const employeeEmail = (
  process.env.TEST_EMPLOYEE_EMAIL ?? 'employee@example.com'
).trim().toLowerCase();

const employeePassword =
  process.env.TEST_EMPLOYEE_PASSWORD ?? 'EmployeeTest123!';

// Simulate upstream middleware replacing a string route parameter with a number.
// This allows a test to verify that route ID validation rejects that value.
capacityRoutes.param('slotId', (req, _res, next, value) => {
  if (value === '__normalized_id__') req.params.slotId = 1;
  next();
});

// Restore methods replaced by spies after each test.
afterEach(() => {
  vi.restoreAllMocks();
});

// Use unique names and credentials for fixtures created by this suite.
const uniqueSuffix = `${Date.now()}-${Math.random()}`;
const wardenEmail = `warden-${uniqueSuffix}@example.com`;
const wardenPassword = 'WardenTest123!';

// Keep shared fixture IDs and authenticated agents available across tests.
let activeSlotId;
let inactiveSlotId;
let tableId;
let hikerAgent;
let employeeAgent;
let wardenAgent;

// Track records created by individual tests for final cleanup.
const createdSlotIds = [];
const createdTableIds = [];

// Authenticate an account and preserve its session cookie for later requests.
async function loginAgent(email, password, area = 'hiker') {
  const agent = request.agent(app);

  const response = await agent
    .post(area === 'staff' ? '/api/staff/sessions' : '/api/sessions')
    .send({ email, password });

  if (response.status !== 201) {
    throw new Error(`Could not sign in test account: ${email}`);
  }

  return agent;
}

// Create shared configuration and authenticate all roles used by the suite.
beforeAll(async () => {
  await initializeDatabase();
  await initializeAccounts();

  // Add a warden account alongside the seeded employee and hiker.
  const wardenPasswordHash = await hashPassword(wardenPassword);

  await runAsync(
    `INSERT INTO users (full_name, email, password_hash, role)
     VALUES (?, ?, ?, 'warden')`,
    ['Capacity API Test Warden', wardenEmail, wardenPasswordHash],
  );

  // Create an active slot for public listing and capacity configuration tests.
  const activeSlot = await createMealSlot({
    slotDate: '2099-12-30',
    name: `Active API test slot ${uniqueSuffix}`,
    startTime: '18:00',
    endTime: '20:00',
  });

  activeSlotId = activeSlot.id;

  // Create an inactive slot to compare public and staff listings.
  const inactiveSlot = await createMealSlot({
    slotDate: '2099-12-30',
    name: `Inactive API test slot ${uniqueSuffix}`,
    startTime: '20:00',
    endTime: '22:00',
    isActive: false,
  });

  inactiveSlotId = inactiveSlot.id;

  // Assign one active four-seat table to the active slot.
  const table = await createDiningTable({
    name: `API test table ${uniqueSuffix}`,
    seatCount: 4,
  });

  tableId = table.id;

  await setMealSlotTables(activeSlotId, [tableId]);

  // Keep separate sessions for hiker, employee, and warden requests.
  hikerAgent = await loginAgent(hikerEmail, hikerPassword);
  employeeAgent = await loginAgent(
    employeeEmail,
    employeePassword,
    'staff'
  );
  wardenAgent = await loginAgent(
    wardenEmail,
    wardenPassword,
    'staff'
  );
});

// Remove shared fixtures and records created by individual tests.
afterAll(async () => {
  const slotIds = [
    activeSlotId,
    inactiveSlotId,
    ...createdSlotIds,
  ].filter(Boolean);

  const tableIds = [tableId, ...createdTableIds].filter(Boolean);

  // Delete assignments before their referenced slots and tables.
  for (const slotId of slotIds) {
    await runAsync(
      'DELETE FROM slot_tables WHERE slot_id = ?',
      [slotId]
    );
  }

  for (const id of tableIds) {
    await runAsync(
      'DELETE FROM slot_tables WHERE table_id = ?',
      [id]
    );

    await runAsync(
      'DELETE FROM dining_tables WHERE id = ?',
      [id]
    );
  }

  for (const slotId of slotIds) {
    await runAsync(
      'DELETE FROM meal_slots WHERE id = ?',
      [slotId]
    );
  }

  // Preserve seeded accounts and remove only the additional warden.
  await runAsync(
    'DELETE FROM users WHERE email = ?',
    [wardenEmail]
  );
});

describe('meal-slot and capacity API', () => {
  // Public users should see active slots but not inactive ones.
  it('lists active meal slots publicly and excludes inactive slots', async () => {
    const response = await request(app).get('/api/meal-slots');

    expect(response.status).toBe(200);

    expect(
      response.body.mealSlots.some((slot) => slot.id === activeSlotId),
    ).toBe(true);

    expect(
      response.body.mealSlots.some((slot) => slot.id === inactiveSlotId),
    ).toBe(false);
  });

  // Anonymous users cannot read staff configuration.
  it('requires authentication to read staff capacity data', async () => {
    const response = await request(app).get('/api/capacity');

    expect(response.status).toBe(401);
  });

  // An authenticated hiker still lacks staff permissions.
  it('denies hikers access to staff capacity data', async () => {
    const response = await hikerAgent.get('/api/capacity');

    expect(response.status).toBe(403);
  });

  // Both employee and warden roles can read capacity configuration.
  it.each([
    ['employee', () => employeeAgent],
    ['warden', () => wardenAgent],
  ])('allows a %s to read capacity data', async (_role, getAgent) => {
    const response = await getAgent().get('/api/capacity');

    expect(response.status).toBe(200);

    expect(
      response.body.mealSlots.some((slot) => slot.id === activeSlotId),
    ).toBe(true);

    expect(
      response.body.diningTables.some((table) => table.id === tableId),
    ).toBe(true);
  });

  // Reject a slot whose end time precedes its start time.
  it('rejects invalid meal-slot data', async () => {
    const response = await employeeAgent
      .post('/api/capacity/meal-slots')
      .send({
        slotDate: '2099-12-30',
        name: 'Invalid API slot',
        startTime: '20:00',
        endTime: '18:00',
      });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('INVALID_INPUT');
  });

  // Verify slot creation defaults and subsequent updates.
  it('allows staff to create and update a meal slot', async () => {
    const createdResponse = await employeeAgent
      .post('/api/capacity/meal-slots')
      .send({
        slotDate: '2099-12-30',
        name: `Created API slot ${uniqueSuffix}`,
        startTime: '16:00',
        endTime: '18:00',
      });

    // Newly created slots are active unless specified otherwise.
    expect(createdResponse.status).toBe(201);
    expect(createdResponse.body.mealSlot).toMatchObject({
      slotDate: '2099-12-30',
      name: `Created API slot ${uniqueSuffix}`,
      startTime: '16:00',
      endTime: '18:00',
      isActive: true,
    });

    const createdSlotId = createdResponse.body.mealSlot.id;
    createdSlotIds.push(createdSlotId);

    // Update the name, time range, and active status.
    const updatedResponse = await employeeAgent
      .put(`/api/capacity/meal-slots/${createdSlotId}`)
      .send({
        slotDate: '2099-12-30',
        name: `Updated API slot ${uniqueSuffix}`,
        startTime: '17:00',
        endTime: '19:00',
        isActive: false,
      });

    expect(updatedResponse.status).toBe(200);
    expect(updatedResponse.body.mealSlot).toMatchObject({
      id: createdSlotId,
      slotDate: '2099-12-30',
      name: `Updated API slot ${uniqueSuffix}`,
      startTime: '17:00',
      endTime: '19:00',
      isActive: false,
    });
  });

  // Verify that wardens can create and modify reusable dining tables.
  it('allows a warden to create and update a dining table', async () => {
    const createdResponse = await wardenAgent
      .post('/api/capacity/dining-tables')
      .send({
        name: `Created API table ${uniqueSuffix}`,
        seatCount: 3,
      });

    expect(createdResponse.status).toBe(201);
    expect(createdResponse.body.diningTable).toMatchObject({
      name: `Created API table ${uniqueSuffix}`,
      seatCount: 3,
      isActive: true,
    });

    const createdTableId = createdResponse.body.diningTable.id;
    createdTableIds.push(createdTableId);

    const updatedResponse = await wardenAgent
      .put(`/api/capacity/dining-tables/${createdTableId}`)
      .send({
        name: `Updated API table ${uniqueSuffix}`,
        seatCount: 5,
        isActive: true,
      });

    expect(updatedResponse.status).toBe(200);
    expect(updatedResponse.body.diningTable).toMatchObject({
      id: createdTableId,
      name: `Updated API table ${uniqueSuffix}`,
      seatCount: 5,
      isActive: true,
    });
  });

  // Table capacity must be a positive integer.
  it('rejects a dining table with an invalid seat count', async () => {
    const response = await employeeAgent
      .post('/api/capacity/dining-tables')
      .send({
        name: 'Invalid API table',
        seatCount: 0,
      });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('INVALID_INPUT');
  });

  // Assignment updates return the configured tables and total active seats.
  it('assigns tables to a meal slot and returns its capacity', async () => {
    const response = await employeeAgent
      .put(`/api/capacity/meal-slots/${activeSlotId}/tables`)
      .send({ tableIds: [tableId] });

    expect(response.status).toBe(200);
    expect(response.body.capacity).toMatchObject({
      slotId: activeSlotId,
      tables: [
        {
          id: tableId,
          seatCount: 4,
          isActive: true,
        },
      ],
      totalSeatCapacity: 4,
    });
  });

  // Unknown table IDs produce a validation error with the missing IDs.
  it('rejects assignments containing a table that does not exist', async () => {
    const response = await employeeAgent
      .put(`/api/capacity/meal-slots/${activeSlotId}/tables`)
      .send({ tableIds: [999999] });

    expect(response.status).toBe(400);
    expect(response.body.error).toEqual({
      code: 'INVALID_INPUT',
      message: 'One or more dining tables were not found.',
      missingTableIds: [999999],
    });
  });

  // A valid but nonexistent slot ID produces a not-found response.
  it('returns not found for an unknown meal slot capacity', async () => {
    const response = await employeeAgent.get(
      '/api/capacity/meal-slots/999999',
    );

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('NOT_FOUND');
  });
});

describe('capacity API edge cases', () => {
  // Reuse valid request bodies while varying individual fields in edge cases.
  const slotInput = {
    slotDate: '2099-12-30',
    name: `Updated API test slot ${uniqueSuffix}`,
    startTime: '18:00',
    endTime: '20:00',
    isActive: true,
  };

  const tableInput = {
    name: `Updated API test table ${uniqueSuffix}`,
    seatCount: 4,
    isActive: true,
  };

  // Enumerate every staff-only capacity endpoint for authorization checks.
  function staffEndpoints() {
    return [
      ['get', '/api/capacity', undefined],
      ['get', `/api/capacity/meal-slots/${activeSlotId}`, undefined],
      ['post', '/api/capacity/meal-slots', slotInput],
      ['post', '/api/capacity/dining-tables', tableInput],
      ['put', `/api/capacity/meal-slots/${activeSlotId}`, slotInput],
      ['put', `/api/capacity/dining-tables/${tableId}`, tableInput],
      [
        'put',
        `/api/capacity/meal-slots/${activeSlotId}/tables`,
        { tableIds: [tableId] },
      ],
    ];
  }

  // All staff endpoints must reject anonymous users and authenticated hikers.
  it('protects every staff endpoint from anonymous and hiker requests', async () => {
    for (const [method, url, body] of staffEndpoints()) {
      const anonymous = await request(app)[method](url).send(body);

      expect(anonymous.status).toBe(401);

      const hiker = await hikerAgent[method](url).send(body);

      expect(hiker.status).toBe(403);
    }
  });

  // Unlike public listings, staff configuration includes inactive slots.
  it('includes inactive slots in staff configuration', async () => {
    const response = await employeeAgent.get('/api/capacity');

    expect(response.status).toBe(200);
    expect(response.body.mealSlots).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: inactiveSlotId,
          isActive: false,
        }),
      ])
    );
  });

  // Both staff roles can inspect an individual slot's capacity.
  it('lets both staff roles read a slot capacity', async () => {
    await setMealSlotTables(activeSlotId, [tableId]);

    for (const agent of [employeeAgent, wardenAgent]) {
      const response = await agent.get(
        `/api/capacity/meal-slots/${activeSlotId}`
      );

      expect(response.status).toBe(200);
      expect(response.body.capacity).toMatchObject({
        slotId: activeSlotId,
        totalSeatCapacity: 4,
      });
    }
  });

  // Validate route IDs consistently across reads, updates, and assignments.
  it.each(['abc', '0', '-1', '1.5'])(
    'rejects invalid route ID %s',
    async (id) => {
      const responses = [
        await employeeAgent.get(
          `/api/capacity/meal-slots/${id}`
        ),
        await employeeAgent
          .put(`/api/capacity/meal-slots/${id}`)
          .send(slotInput),
        await employeeAgent
          .put(`/api/capacity/dining-tables/${id}`)
          .send(tableInput),
        await employeeAgent
          .put(`/api/capacity/meal-slots/${id}/tables`)
          .send({ tableIds: [] }),
      ];

      for (const response of responses) {
        expect(response.status).toBe(400);
        expect(response.body.error.code).toBe('INVALID_INPUT');
      }
    }
  );

  // Route parameter parsing must reject non-string values from middleware.
  it('rejects a route ID converted to a number by upstream parameter middleware', async () => {
    const response = await employeeAgent.get(
      '/api/capacity/meal-slots/__normalized_id__'
    );

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('INVALID_INPUT');
  });

  // Update routes must apply the same field validation as creation routes.
  it('rejects invalid update bodies', async () => {
    const slot = await employeeAgent
      .put(`/api/capacity/meal-slots/${activeSlotId}`)
      .send({ ...slotInput, endTime: '17:00' });

    const table = await employeeAgent
      .put(`/api/capacity/dining-tables/${tableId}`)
      .send({ ...tableInput, seatCount: 0 });

    for (const response of [slot, table]) {
      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('INVALID_INPUT');
    }
  });

  // Updates must explicitly include the active flag instead of using a default.
  it('requires explicit active status for updates', async () => {
    const { isActive: _slotActive, ...slotBody } = slotInput;
    const { isActive: _tableActive, ...tableBody } = tableInput;

    const slot = await employeeAgent
      .put(`/api/capacity/meal-slots/${activeSlotId}`)
      .send(slotBody);

    const table = await employeeAgent
      .put(`/api/capacity/dining-tables/${tableId}`)
      .send(tableBody);

    expect(slot.status).toBe(400);
    expect(slot.body.error.message).toBe(
      'Meal slot active status is required for updates.'
    );

    expect(table.status).toBe(400);
    expect(table.body.error.message).toBe(
      'Dining table active status is required for updates.'
    );
  });

  // Valid input cannot update or assign tables to nonexistent records.
  it('returns 404 for updates and assignments to missing records', async () => {
    const responses = [
      await employeeAgent
        .put('/api/capacity/meal-slots/999999')
        .send(slotInput),
      await employeeAgent
        .put('/api/capacity/dining-tables/999999')
        .send(tableInput),
      await employeeAgent
        .put('/api/capacity/meal-slots/999999/tables')
        .send({ tableIds: [] }),
    ];

    for (const response of responses) {
      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe('NOT_FOUND');
    }
  });

  // Assignment input must be an array of unique positive integer IDs.
  it('rejects missing, malformed, duplicate, or invalid assignment IDs', async () => {
    for (const body of [
      {},
      { tableIds: '1' },
      { tableIds: [tableId, tableId] },
      { tableIds: [0] },
    ]) {
      const response = await employeeAgent
        .put(`/api/capacity/meal-slots/${activeSlotId}/tables`)
        .send(body);

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('INVALID_INPUT');
    }

    // A request without a body must also be rejected safely.
    const noBody = await employeeAgent.put(
      `/api/capacity/meal-slots/${activeSlotId}/tables`
    );

    expect(noBody.status).toBe(400);
  });

  // Verify that assignment changes survive a separate read request.
  it('persists assignments and allows a warden to clear them', async () => {
    const url = `/api/capacity/meal-slots/${activeSlotId}`;

    const assigned = await wardenAgent
      .put(`${url}/tables`)
      .send({ tableIds: [tableId] });

    expect(assigned.status).toBe(200);

    const saved = await employeeAgent.get(url);

    expect(saved.body.capacity).toEqual(assigned.body.capacity);

    // An empty assignment must persist as zero configured seats.
    const cleared = await wardenAgent
      .put(`${url}/tables`)
      .send({ tableIds: [] });

    expect(cleared.status).toBe(200);
    expect(cleared.body.capacity).toMatchObject({
      tables: [],
      totalSeatCapacity: 0,
    });

    const reloaded = await employeeAgent.get(url);

    expect(reloaded.body.capacity).toEqual(cleared.body.capacity);
  });

  // Invalid replacement requests must preserve the previous assignment.
  it('preserves assignments when an unknown table is requested', async () => {
    await setMealSlotTables(activeSlotId, [tableId]);

    const url = `/api/capacity/meal-slots/${activeSlotId}`;

    const response = await employeeAgent
      .put(`${url}/tables`)
      .send({ tableIds: [tableId, 999999] });

    expect(response.status).toBe(400);
    expect(response.body.error.missingTableIds).toEqual([999999]);

    const saved = await employeeAgent.get(url);

    expect(
      saved.body.capacity.tables.map((table) => table.id)
    ).toEqual([tableId]);
  });

  // Non-Error validation failures should receive a generic validation message.
  it('uses a generic message if validation throws a non-Error value', async () => {
    vi.spyOn(
      CapacityValidation,
      'validateMealSlot'
    ).mockImplementationOnce(() => {
      throw 'Unexpected validation failure';
    });

    const response = await employeeAgent
      .post('/api/capacity/meal-slots')
      .send(slotInput);

    expect(response.status).toBe(400);
    expect(response.body.error).toEqual({
      code: 'INVALID_INPUT',
      message: 'Invalid input.',
    });
  });

  // Unexpected database errors must not expose private details to clients.
  it('returns a generic 500 response when a database read fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});

    vi.spyOn(
      CapacityDAO,
      'getMealSlots'
    ).mockRejectedValueOnce(new Error('Private database detail'));

    const response = await request(app).get('/api/meal-slots');

    expect(response.status).toBe(500);
    expect(response.body.error).toEqual({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred.',
    });

    expect(response.text).not.toContain('Private database detail');
  });

  // Assignment failures must reach the error handler regardless of error type.
  it.each([new Error('Database failure'), 'Unexpected rejection'])(
    'forwards unexpected assignment failures to the error handler: %s',
    async (failure) => {
      vi.spyOn(console, 'error').mockImplementation(() => {});

      vi.spyOn(
        CapacityDAO,
        'setMealSlotTables'
      ).mockRejectedValueOnce(failure);

      const response = await employeeAgent
        .put(`/api/capacity/meal-slots/${activeSlotId}/tables`)
        .send({ tableIds: [tableId] });

      expect(response.status).toBe(500);
      expect(response.body.error.code).toBe('INTERNAL_SERVER_ERROR');
    },
  );
});

describe('capacity API name conflicts', () => {
  // A service name can be reused with different times, but not for an exact copy.
  it('allows repeated slot names with different times but rejects exact duplicates', async () => {
    const name = `Conflict API slot ${uniqueSuffix}`;

    const first = await employeeAgent
      .post('/api/capacity/meal-slots')
      .send({
        slotDate: '2099-12-30',
        name,
        startTime: '07:00',
        endTime: '08:00',
      });

    expect(first.status).toBe(201);
    createdSlotIds.push(first.body.mealSlot.id);

    // The same name with a different time range remains valid.
    const differentTimes = await employeeAgent
      .post('/api/capacity/meal-slots')
      .send({
        slotDate: '2099-12-30',
        name,
        startTime: '08:00',
        endTime: '09:00',
      });

    expect(differentTimes.status).toBe(201);
    createdSlotIds.push(differentTimes.body.mealSlot.id);

    // Exact duplicates are rejected regardless of name letter case.
    for (const duplicateName of [name, name.toUpperCase()]) {
      const duplicate = await employeeAgent
        .post('/api/capacity/meal-slots')
        .send({
          slotDate: '2099-12-30',
          name: duplicateName,
          startTime: '07:00',
          endTime: '08:00',
        });

      expect(duplicate.status).toBe(409);
      expect(duplicate.body.error.code).toBe(
        'DUPLICATE_MEAL_SLOT',
      );
    }
  });

  // Renaming is valid unless all identifying slot fields become duplicates.
  it('allows renaming to an existing name with different times but rejects an exact duplicate', async () => {
    const takenName = `Taken API slot ${uniqueSuffix}`;

    const first = await employeeAgent
      .post('/api/capacity/meal-slots')
      .send({
        slotDate: '2099-12-30',
        name: takenName,
        startTime: '09:00',
        endTime: '10:00',
      });

    expect(first.status).toBe(201);
    createdSlotIds.push(first.body.mealSlot.id);

    const second = await employeeAgent
      .post('/api/capacity/meal-slots')
      .send({
        slotDate: '2099-12-30',
        name: `Renamed API slot ${uniqueSuffix}`,
        startTime: '10:00',
        endTime: '11:00',
      });

    expect(second.status).toBe(201);
    createdSlotIds.push(second.body.mealSlot.id);

    // Reuse the first slot's name while retaining different times.
    const renamed = await employeeAgent
      .put(`/api/capacity/meal-slots/${second.body.mealSlot.id}`)
      .send({
        slotDate: '2099-12-30',
        name: takenName,
        startTime: '10:00',
        endTime: '11:00',
        isActive: true,
      });

    expect(renamed.status).toBe(200);
    expect(renamed.body.mealSlot.name).toBe(takenName);

    // Changing the times to match the first slot must be rejected.
    const duplicate = await employeeAgent
      .put(`/api/capacity/meal-slots/${second.body.mealSlot.id}`)
      .send({
        slotDate: '2099-12-30',
        name: takenName,
        startTime: '09:00',
        endTime: '10:00',
        isActive: true,
      });

    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error.code).toBe(
      'DUPLICATE_MEAL_SLOT',
    );

    // A rejected update must preserve the previously saved name and times.
    const configuration = await employeeAgent.get('/api/capacity');

    expect(configuration.body.mealSlots).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: second.body.mealSlot.id,
          name: takenName,
          startTime: '10:00',
          endTime: '11:00',
        }),
      ]),
    );
  });

  // A record must not conflict with itself when retaining or recasing its name.
  it('lets a meal slot keep its own name or change its letter case', async () => {
    const name = `Own name API slot ${uniqueSuffix}`;

    const created = await employeeAgent
      .post('/api/capacity/meal-slots')
      .send({
        slotDate: '2099-12-30',
        name,
        startTime: '11:00',
        endTime: '12:00',
      });

    expect(created.status).toBe(201);
    createdSlotIds.push(created.body.mealSlot.id);

    for (const sameName of [name, name.toUpperCase()]) {
      const response = await employeeAgent
        .put(`/api/capacity/meal-slots/${created.body.mealSlot.id}`)
        .send({
          slotDate: '2099-12-30',
          name: sameName,
          startTime: '11:00',
          endTime: '12:30',
          isActive: true,
        });

      expect(response.status).toBe(200);
      expect(response.body.mealSlot.name).toBe(sameName);
    }
  });

  // Dining-table names must remain unique on both creation and update.
  it('rejects duplicate dining-table names on creation and update', async () => {
    const name = `Conflict API table ${uniqueSuffix}`;

    const created = await wardenAgent
      .post('/api/capacity/dining-tables')
      .send({ name, seatCount: 4 });

    const other = await wardenAgent
      .post('/api/capacity/dining-tables')
      .send({
        name: `Other API table ${uniqueSuffix}`,
        seatCount: 2,
      });

    createdTableIds.push(
      created.body.diningTable.id,
      other.body.diningTable.id
    );

    // Creating a differently cased copy of an existing name must fail.
    const duplicateCreate = await wardenAgent
      .post('/api/capacity/dining-tables')
      .send({ name: name.toLowerCase(), seatCount: 6 });

    expect(duplicateCreate.status).toBe(409);
    expect(duplicateCreate.body.error).toEqual({
      code: 'DUPLICATE_NAME',
      message: `A dining table named "${name.toLowerCase()}" already exists.`,
    });

    // Renaming another table to the existing name must also fail.
    const duplicateUpdate = await wardenAgent
      .put(`/api/capacity/dining-tables/${other.body.diningTable.id}`)
      .send({ name, seatCount: 2, isActive: true });

    expect(duplicateUpdate.status).toBe(409);
    expect(duplicateUpdate.body.error.code).toBe('DUPLICATE_NAME');
  });

  // Missing-record detection takes precedence over a potential name conflict.
  it('reports a missing record before a name conflict', async () => {
    const existing = await employeeAgent
      .post('/api/capacity/dining-tables')
      .send({
        name: `Existing API table ${uniqueSuffix}`,
        seatCount: 2,
      });

    createdTableIds.push(existing.body.diningTable.id);

    const response = await employeeAgent
      .put('/api/capacity/dining-tables/999999')
      .send({
        name: `Existing API table ${uniqueSuffix}`,
        seatCount: 2,
        isActive: true,
      });

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('NOT_FOUND');
  });
});