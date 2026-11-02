import { randomUUID } from 'node:crypto';

import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';

import app from '../../app.js';
import { initializeDatabase, runAsync } from '../../db.js';
import { initializeAccounts } from '../../init/init-accounts.js';
import { hashPassword } from '../../services/password.js';

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
  it('logs in, restores the session, and logs out', async () => {
    // Preserve the session cookie across requests.
    const hikerAgent = request.agent(app);

    const loginResponse = await hikerAgent
      .post('/api/sessions')
      .send({
        email: testEmail,
        password: testPassword,
      });

    expect(loginResponse.status).toBe(201);
    expect(loginResponse.body.user).toMatchObject({
      id: expect.any(Number),
      full_name: expect.any(String),
      email: testEmail,
      role: 'hiker',
    });
    expect(loginResponse.body.user).not.toHaveProperty('password_hash');

    const currentUserResponse = await hikerAgent.get(
      '/api/sessions/current',
    );

    expect(currentUserResponse.status).toBe(200);
    expect(currentUserResponse.body.user).toMatchObject({
      id: loginResponse.body.user.id,
      full_name: loginResponse.body.user.full_name,
      email: testEmail,
      role: 'hiker',
    });
    expect(currentUserResponse.body.user).not.toHaveProperty('password_hash');

    const logoutResponse = await hikerAgent.delete(
      '/api/sessions/current',
    );

    expect(logoutResponse.status).toBe(204);
    expect(logoutResponse.text).toBe('');

    const afterLogoutResponse = await hikerAgent.get(
      '/api/sessions/current',
    );

    expect(afterLogoutResponse.status).toBe(401);
    expect(afterLogoutResponse.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('rejects an incorrect password without creating a session', async () => {
    const agent = request.agent(app);

    const response = await agent
      .post('/api/sessions')
      .send({
        email: testEmail,
        password: 'incorrect-password',
      });

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('INVALID_CREDENTIALS');
    expect(response.body).not.toHaveProperty('user');

    const sessionResponse = await agent.get('/api/sessions/current');

    expect(sessionResponse.status).toBe(401);
  });

  it('rejects an unknown email without creating a session', async () => {
    const agent = request.agent(app);

    const response = await agent
      .post('/api/sessions')
      .send({
        email: `missing-${randomUUID()}@example.com`,
        password: testPassword,
      });

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('INVALID_CREDENTIALS');
    expect(response.body).not.toHaveProperty('user');

    const sessionResponse = await agent.get('/api/sessions/current');

    expect(sessionResponse.status).toBe(401);
  });

  it.each([
    ['missing both fields', {}],
    ['missing email', { password: testPassword }],
    ['missing password', { email: testEmail }],
    ['empty email', { email: '', password: testPassword }],
    ['blank email', { email: '   ', password: testPassword }],
    ['empty password', { email: testEmail, password: '' }],
    ['non-string email', { email: 123, password: testPassword }],
    ['non-string password', { email: testEmail, password: 123 }],
    ['null email', { email: null, password: testPassword }],
    ['null password', { email: testEmail, password: null }],
  ])('rejects credentials with %s', async (_description, credentials) => {
    const response = await request(app)
      .post('/api/sessions')
      .send(credentials);

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('INVALID_CREDENTIALS');
    expect(response.body).not.toHaveProperty('user');
  });

  it('rejects a session request without authentication', async () => {
    const response = await request(app).get('/api/sessions/current');

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHENTICATED');
    expect(response.body).not.toHaveProperty('user');
  });

  it('allows logout without authentication', async () => {
    const response = await request(app)
      .delete('/api/sessions/current');

    expect(response.status).toBe(204);
    expect(response.text).toBe('');
  });
});

describe('session for a deleted account', () => {
  it('rejects the session when the authenticated user no longer exists', async () => {
    const email = `deleted-account-${randomUUID()}@example.com`;
    const password = 'DeletedAccountTest123!';
    const passwordHash = await hashPassword(password);

    const result = await runAsync(
      `INSERT INTO users (full_name, email, password_hash, role)
       VALUES (?, ?, ?, ?)`,
      ['Temporary Hiker', email, passwordHash, 'hiker'],
    );

    const userId = result.lastID;

    try {
      const agent = request.agent(app);

      const loginResponse = await agent
        .post('/api/sessions')
        .send({ email, password });

      expect(loginResponse.status).toBe(201);
      expect(loginResponse.body.user.id).toBe(userId);

      const activeSessionResponse = await agent.get(
        '/api/sessions/current',
      );

      expect(activeSessionResponse.status).toBe(200);

      await runAsync(
        'DELETE FROM users WHERE id = ?',
        [userId],
      );

      const deletedAccountResponse = await agent.get(
        '/api/sessions/current',
      );

      expect(deletedAccountResponse.status).toBe(401);
      expect(deletedAccountResponse.body.error.code).toBe(
        'UNAUTHENTICATED',
      );
      expect(deletedAccountResponse.body).not.toHaveProperty('user');
    } finally {
      await runAsync(
        'DELETE FROM users WHERE id = ?',
        [userId],
      );
    }
  });

  it('rejects a login request without a body', async () => {
    const response = await request(app)
      .post('/api/sessions');

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('INVALID_CREDENTIALS');
    expect(response.body).not.toHaveProperty('user');
  });
});
