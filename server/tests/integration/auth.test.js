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

describe('hiker session', () => {
  it('rejects restoring a session when no session exists', async () => {
    const response = await request(app).get('/api/sessions/current');

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHENTICATED');
  });

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
});
