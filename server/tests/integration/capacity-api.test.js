import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

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

const hikerEmail = (
  process.env.TEST_HIKER_EMAIL ?? 'hiker@example.com'
).trim().toLowerCase();

const hikerPassword =
  process.env.TEST_HIKER_PASSWORD ?? 'HikerTest123!';

const employeeEmail = (
  process.env.TEST_EMPLOYEE_EMAIL ?? 'employee@example.com'
).trim().toLowerCase();

const employeePassword =
  process.env.TEST_EMPLOYEE_PASSWORD ?? 'EmployeeTest123!';

capacityRoutes.param('slotId', (req, _res, next, value) => {
  if (value === '__normalized_id__') req.params.slotId = 1;
  next();
});

afterEach(() => {
  vi.restoreAllMocks();
});

const uniqueSuffix = `${Date.now()}-${Math.random()}`;
const wardenEmail = `warden-${uniqueSuffix}@example.com`;
const wardenPassword = 'WardenTest123!';

let activeSlotId;
let inactiveSlotId;
let tableId;
let hikerAgent;
let employeeAgent;
let wardenAgent;

const createdSlotIds = [];
const createdTableIds = [];

async function loginAgent(email, password) {
  const agent = request.agent(app);

  const response = await agent
    .post('/api/sessions')
    .send({ email, password });

  if (response.status !== 201) {
    throw new Error(`Could not sign in test account: ${email}`);
  }

  return agent;
}

beforeAll(async () => {
  await initializeDatabase();
  await initializeAccounts();

  const wardenPasswordHash = await hashPassword(wardenPassword);

  await runAsync(
    `INSERT INTO users (full_name, email, password_hash, role)
     VALUES (?, ?, ?, 'warden')`,
    ['Capacity API Test Warden', wardenEmail, wardenPasswordHash],
  );

  const activeSlot = await createMealSlot({
    name: `Active API test slot ${uniqueSuffix}`,
    startTime: '18:00',
    endTime: '20:00',
  });

  activeSlotId = activeSlot.id;

  const inactiveSlot = await createMealSlot({
    name: `Inactive API test slot ${uniqueSuffix}`,
    startTime: '20:00',
    endTime: '22:00',
    isActive: false,
  });

  inactiveSlotId = inactiveSlot.id;

  const table = await createDiningTable({
    name: `API test table ${uniqueSuffix}`,
    seatCount: 4,
  });

  tableId = table.id;

  await setMealSlotTables(activeSlotId, [tableId]);

  hikerAgent = await loginAgent(hikerEmail, hikerPassword);
  employeeAgent = await loginAgent(employeeEmail, employeePassword);
  wardenAgent = await loginAgent(wardenEmail, wardenPassword);
});

afterAll(async () => {
  const slotIds = [activeSlotId, inactiveSlotId, ...createdSlotIds]
    .filter(Boolean);

  const tableIds = [tableId, ...createdTableIds].filter(Boolean);

  for (const slotId of slotIds) {
    await runAsync('DELETE FROM slot_tables WHERE slot_id = ?', [slotId]);
  }

  for (const id of tableIds) {
    await runAsync('DELETE FROM slot_tables WHERE table_id = ?', [id]);
    await runAsync('DELETE FROM dining_tables WHERE id = ?', [id]);
  }

  for (const slotId of slotIds) {
    await runAsync('DELETE FROM meal_slots WHERE id = ?', [slotId]);
  }

  await runAsync('DELETE FROM users WHERE email = ?', [wardenEmail]);
});

describe('meal-slot and capacity API', () => {
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

  it('requires authentication to read staff capacity data', async () => {
    const response = await request(app).get('/api/capacity');

    expect(response.status).toBe(401);
  });

  it('denies hikers access to staff capacity data', async () => {
    const response = await hikerAgent.get('/api/capacity');

    expect(response.status).toBe(403);
  });

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

  it('rejects invalid meal-slot data', async () => {
    const response = await employeeAgent
      .post('/api/capacity/meal-slots')
      .send({
        name: 'Invalid API slot',
        startTime: '20:00',
        endTime: '18:00',
      });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('INVALID_INPUT');
  });

  it('allows staff to create and update a meal slot', async () => {
    const createdResponse = await employeeAgent
      .post('/api/capacity/meal-slots')
      .send({
        name: `Created API slot ${uniqueSuffix}`,
        startTime: '16:00',
        endTime: '18:00',
      });

    expect(createdResponse.status).toBe(201);
    expect(createdResponse.body.mealSlot).toMatchObject({
      name: `Created API slot ${uniqueSuffix}`,
      startTime: '16:00',
      endTime: '18:00',
      isActive: true,
    });

    const createdSlotId = createdResponse.body.mealSlot.id;
    createdSlotIds.push(createdSlotId);

    const updatedResponse = await employeeAgent
      .put(`/api/capacity/meal-slots/${createdSlotId}`)
      .send({
        name: `Updated API slot ${uniqueSuffix}`,
        startTime: '17:00',
        endTime: '19:00',
        isActive: false,
      });

    expect(updatedResponse.status).toBe(200);
    expect(updatedResponse.body.mealSlot).toMatchObject({
      id: createdSlotId,
      name: `Updated API slot ${uniqueSuffix}`,
      startTime: '17:00',
      endTime: '19:00',
      isActive: false,
    });
  });

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

  it('rejects assignments containing a table that does not exist', async () => {
    const response = await employeeAgent
      .put(`/api/capacity/meal-slots/${activeSlotId}/tables`)
      .send({ tableIds: [999999] });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('INVALID_INPUT');
  });

  it('returns not found for an unknown meal slot capacity', async () => {
    const response = await employeeAgent.get(
      '/api/capacity/meal-slots/999999',
    );

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('NOT_FOUND');
  });
});

// Additional validation, authorization, persistence, and failure scenarios.
describe('capacity API edge cases', () => {
  const slotInput = {
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

  function staffEndpoints() {
    return [
      ['get', '/api/capacity', undefined],
      ['get', `/api/capacity/meal-slots/${activeSlotId}`, undefined],
      ['post', '/api/capacity/meal-slots', slotInput],
      ['post', '/api/capacity/dining-tables', tableInput],
      ['put', `/api/capacity/meal-slots/${activeSlotId}`, slotInput],
      ['put', `/api/capacity/dining-tables/${tableId}`, tableInput],
      ['put', `/api/capacity/meal-slots/${activeSlotId}/tables`, { tableIds: [tableId] }],
    ];
  }

  it('protects every staff endpoint from anonymous and hiker requests', async () => {
    for (const [method, url, body] of staffEndpoints()) {
      const anonymous = await request(app)[method](url).send(body);
      expect(anonymous.status).toBe(401);
      const hiker = await hikerAgent[method](url).send(body);
      expect(hiker.status).toBe(403);
    }
  });

  it('includes inactive slots in staff configuration', async () => {
    const response = await employeeAgent.get('/api/capacity');
    expect(response.status).toBe(200);
    expect(response.body.mealSlots).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: inactiveSlotId, isActive: false }),
    ]));
  });

  it('lets both staff roles read a slot capacity', async () => {
    await setMealSlotTables(activeSlotId, [tableId]);
    for (const agent of [employeeAgent, wardenAgent]) {
      const response = await agent.get(`/api/capacity/meal-slots/${activeSlotId}`);
      expect(response.status).toBe(200);
      expect(response.body.capacity).toMatchObject({ slotId: activeSlotId, totalSeatCapacity: 4 });
    }
  });

  it.each(['abc', '0', '-1', '1.5'])('rejects invalid route ID %s', async (id) => {
    const responses = [
      await employeeAgent.get(`/api/capacity/meal-slots/${id}`),
      await employeeAgent.put(`/api/capacity/meal-slots/${id}`).send(slotInput),
      await employeeAgent.put(`/api/capacity/dining-tables/${id}`).send(tableInput),
      await employeeAgent.put(`/api/capacity/meal-slots/${id}/tables`).send({ tableIds: [] }),
    ];
    for (const response of responses) {
      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('INVALID_INPUT');
    }
  });

  it('rejects a route ID converted to a number by upstream parameter middleware', async () => {
    const response = await employeeAgent.get('/api/capacity/meal-slots/__normalized_id__');
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('INVALID_INPUT');
  });

  it('rejects invalid update bodies', async () => {
    const slot = await employeeAgent.put(`/api/capacity/meal-slots/${activeSlotId}`)
      .send({ ...slotInput, endTime: '17:00' });
    const table = await employeeAgent.put(`/api/capacity/dining-tables/${tableId}`)
      .send({ ...tableInput, seatCount: 0 });
    for (const response of [slot, table]) {
      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('INVALID_INPUT');
    }
  });

  it('requires explicit active status for updates', async () => {
    const { isActive: _slotActive, ...slotBody } = slotInput;
    const { isActive: _tableActive, ...tableBody } = tableInput;
    const slot = await employeeAgent.put(`/api/capacity/meal-slots/${activeSlotId}`).send(slotBody);
    const table = await employeeAgent.put(`/api/capacity/dining-tables/${tableId}`).send(tableBody);
    expect(slot.status).toBe(400);
    expect(slot.body.error.message).toBe('Meal slot active status is required for updates.');
    expect(table.status).toBe(400);
    expect(table.body.error.message).toBe('Dining table active status is required for updates.');
  });

  it('returns 404 for updates and assignments to missing records', async () => {
    const responses = [
      await employeeAgent.put('/api/capacity/meal-slots/999999').send(slotInput),
      await employeeAgent.put('/api/capacity/dining-tables/999999').send(tableInput),
      await employeeAgent.put('/api/capacity/meal-slots/999999/tables').send({ tableIds: [] }),
    ];
    for (const response of responses) {
      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe('NOT_FOUND');
    }
  });

  it('rejects missing, malformed, duplicate, or invalid assignment IDs', async () => {
    for (const body of [{}, { tableIds: '1' }, { tableIds: [tableId, tableId] }, { tableIds: [0] }]) {
      const response = await employeeAgent.put(`/api/capacity/meal-slots/${activeSlotId}/tables`).send(body);
      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('INVALID_INPUT');
    }
    const noBody = await employeeAgent.put(`/api/capacity/meal-slots/${activeSlotId}/tables`);
    expect(noBody.status).toBe(400);
  });

  it('persists assignments and allows a warden to clear them', async () => {
    const url = `/api/capacity/meal-slots/${activeSlotId}`;
    const assigned = await wardenAgent.put(`${url}/tables`).send({ tableIds: [tableId] });
    expect(assigned.status).toBe(200);
    const saved = await employeeAgent.get(url);
    expect(saved.body.capacity).toEqual(assigned.body.capacity);

    const cleared = await wardenAgent.put(`${url}/tables`).send({ tableIds: [] });
    expect(cleared.status).toBe(200);
    expect(cleared.body.capacity).toMatchObject({ tables: [], totalSeatCapacity: 0 });
    const reloaded = await employeeAgent.get(url);
    expect(reloaded.body.capacity).toEqual(cleared.body.capacity);
  });

  it('preserves assignments when an unknown table is requested', async () => {
    await setMealSlotTables(activeSlotId, [tableId]);
    const url = `/api/capacity/meal-slots/${activeSlotId}`;
    const response = await employeeAgent.put(`${url}/tables`).send({ tableIds: [tableId, 999999] });
    expect(response.status).toBe(400);
    const saved = await employeeAgent.get(url);
    expect(saved.body.capacity.tables.map((table) => table.id)).toEqual([tableId]);
  });

  it('uses a generic message if validation throws a non-Error value', async () => {
    vi.spyOn(CapacityValidation, 'validateMealSlot').mockImplementationOnce(() => {
      throw 'Unexpected validation failure';
    });
    const response = await employeeAgent.post('/api/capacity/meal-slots').send(slotInput);
    expect(response.status).toBe(400);
    expect(response.body.error).toEqual({ code: 'INVALID_INPUT', message: 'Invalid input.' });
  });

  it('returns a generic 500 response when a database read fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(CapacityDAO, 'getMealSlots').mockRejectedValueOnce(new Error('Private database detail'));
    const response = await request(app).get('/api/meal-slots');
    expect(response.status).toBe(500);
    expect(response.body.error).toEqual({ code: 'INTERNAL_SERVER_ERROR', message: 'An unexpected error occurred.' });
    expect(response.text).not.toContain('Private database detail');
  });

  it.each([new Error('Database failure'), 'Unexpected rejection'])(
    'forwards unexpected assignment failures to the error handler: %s',
    async (failure) => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      vi.spyOn(CapacityDAO, 'setMealSlotTables').mockRejectedValueOnce(failure);
      const response = await employeeAgent.put(`/api/capacity/meal-slots/${activeSlotId}/tables`)
        .send({ tableIds: [tableId] });
      expect(response.status).toBe(500);
      expect(response.body.error.code).toBe('INTERNAL_SERVER_ERROR');
    },
  );
});
