
// [Minimal login setup (backend)]: Verify hiker login, session restoration, and logout.
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';

import app from '../../app.js';
import { initializeDatabase } from '../../db.js';
import { initializeAccounts } from '../../init/init-accounts.js';

const testEmail = (
  process.env.TEST_HIKER_EMAIL ?? 'hiker@example.com'
).trim().toLowerCase();

const testPassword =
  process.env.TEST_HIKER_PASSWORD ?? 'HikerTest123!';

beforeAll(async () => {
  await initializeDatabase();
  await initializeAccounts();
});

// [Employee access for capacity management]: Set credentials for the local employee integration test.
const employeeEmail = (
  process.env.TEST_EMPLOYEE_EMAIL ?? 'employee@example.com'
).trim().toLowerCase();

const employeePassword =
  process.env.TEST_EMPLOYEE_PASSWORD ?? 'EmployeeTest123!';

describe('hiker session', () => {
  it('logs in, restores the hiker from the session, and logs out', async () => {
    const hikerAgent = request.agent(app);

    const loginResponse = await hikerAgent
      .post('/api/sessions')
      .send({ email: testEmail, password: testPassword });

    expect(loginResponse.status).toBe(201);
    expect(loginResponse.body.user).toMatchObject({
      email: testEmail,
      role: 'hiker',
    });

    const currentUserResponse = await hikerAgent.get(
      '/api/sessions/current',
    );

    expect(currentUserResponse.status).toBe(200);
    expect(currentUserResponse.body.user).toMatchObject({
      email: testEmail,
      role: 'hiker',
    });

    const logoutResponse = await hikerAgent.delete(
      '/api/sessions/current',
    );

    expect(logoutResponse.status).toBe(204);

    const afterLogoutResponse = await hikerAgent.get(
      '/api/sessions/current',
    );

    expect(afterLogoutResponse.status).toBe(401);
  });

  it('rejects an incorrect password', async () => {
    const response = await request(app)
      .post('/api/sessions')
      .send({ email: testEmail, password: 'incorrect-password' });

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  // [Employee access for capacity management]: Verify that the local employee account can sign in.
  it('allows the local employee test account to sign in', async () => {
    const employeeAgent = request.agent(app);

    const response = await employeeAgent
      .post('/api/sessions')
      .send({ email: employeeEmail, password: employeePassword });

    expect(response.status).toBe(201);
    expect(response.body.user).toMatchObject({
      email: employeeEmail,
      role: 'employee',
    });
  });
});