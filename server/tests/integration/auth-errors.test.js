import express from 'express';
import request from 'supertest';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

const mocks = vi.hoisted(() => ({
  getUserByEmail: vi.fn(),
  getUserById: vi.fn(),
}));

vi.mock('../../dao/auth-dao.js', () => ({
  getUserByEmail: mocks.getUserByEmail,
  getUserById: mocks.getUserById,
}));

import app from '../../app.js';
import passport from '../../config/passport.js';
import authRoutes from '../../routes/auth-routes.js';
import { hashPassword } from '../../services/password.js';

beforeEach(() => {
  vi.resetAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

/**
 * Mounts the real routes with controlled request methods to simulate failures.
 *
 * @param {Record<string, unknown>} requestProperties
 */
function createRouteTestApp(requestProperties) {
  const testApp = express();

  testApp.use(express.json());

  testApp.use((req, _res, next) => {
    Object.assign(req, requestProperties);
    next();
  });

  testApp.use('/api', authRoutes);

  const errorHandler = vi.fn((error, _req, res, _next) => {
    return res.status(500).json({
      error: {
        code: 'TEST_INTERNAL_ERROR',
      },
    });
  });

  testApp.use(errorHandler);

  return { testApp, errorHandler };
}

describe('authentication errors', () => {
  it('returns 500 without creating a session when the user lookup fails', async () => {
    mocks.getUserByEmail.mockRejectedValueOnce(
      new Error('Simulated database failure'),
    );

    const agent = request.agent(app);

    const loginResponse = await agent
      .post('/api/sessions')
      .send({
        email: 'auth-error-test@example.com',
        password: 'AuthErrorTest123!',
      });

    expect(mocks.getUserByEmail).toHaveBeenCalledExactlyOnceWith(
      'auth-error-test@example.com',
    );

    expect(loginResponse.status).toBe(500);
    expect(loginResponse.body).not.toHaveProperty('user');

    const sessionResponse = await agent.get(
      '/api/sessions/current',
    );

    expect(sessionResponse.status).toBe(401);
    expect(sessionResponse.body.error.code).toBe('UNAUTHENTICATED');

    expect(mocks.getUserById).not.toHaveBeenCalled();
  });

  it('returns 500 when restoring the session fails', async () => {
    const email = 'session-error-test@example.com';
    const password = 'SessionErrorTest123!';

    mocks.getUserByEmail.mockResolvedValueOnce({
      id: 123,
      full_name: 'Session Error Test Hiker',
      email,
      password_hash: await hashPassword(password),
      role: 'hiker',
    });

    const agent = request.agent(app);

    const loginResponse = await agent
      .post('/api/sessions')
      .send({ email, password });

    expect(loginResponse.status).toBe(201);
    expect(loginResponse.body.user).toMatchObject({
      id: 123,
      email,
      role: 'hiker',
    });

    mocks.getUserById.mockRejectedValueOnce(
      new Error('Simulated session lookup failure'),
    );

    const sessionResponse = await agent.get(
      '/api/sessions/current',
    );

    expect(mocks.getUserById).toHaveBeenCalledExactlyOnceWith(123);
    expect(sessionResponse.status).toBe(500);
    expect(sessionResponse.body).not.toHaveProperty('user');
  });

  it('forwards an error when creating the login session fails', async () => {
    const failure = new Error('Simulated login session failure');

    const user = {
      id: 456,
      full_name: 'Login Failure Test Hiker',
      email: 'login-failure@example.com',
      role: 'hiker',
    };

    vi.spyOn(passport, 'authenticate').mockImplementation(
      (_strategy, callback) => {
        return (_req, _res, _next) => {
          callback(null, user);
        };
      },
    );

    const logIn = vi.fn((_user, callback) => {
      callback(failure);
    });

    const { testApp, errorHandler } = createRouteTestApp({
      logIn,
    });

    const response = await request(testApp)
      .post('/api/sessions')
      .send({
        email: user.email,
        password: 'LoginFailureTest123!',
      });

    expect(logIn).toHaveBeenCalledExactlyOnceWith(
      user,
      expect.any(Function),
    );

    expect(errorHandler).toHaveBeenCalledTimes(1);
    expect(errorHandler.mock.calls[0][0]).toBe(failure);

    expect(response.status).toBe(500);
    expect(response.body).not.toHaveProperty('user');
  });

  it('forwards a logout error without continuing to destroy the session', async () => {
    const failure = new Error('Simulated logout failure');

    const logout = vi.fn((callback) => {
      callback(failure);
    });

    const destroy = vi.fn();

    const { testApp, errorHandler } = createRouteTestApp({
      isAuthenticated: () => true,
      logout,
      session: { destroy },
    });

    const response = await request(testApp)
      .delete('/api/sessions/current');

    expect(logout).toHaveBeenCalledTimes(1);
    expect(destroy).not.toHaveBeenCalled();

    expect(errorHandler).toHaveBeenCalledTimes(1);
    expect(errorHandler.mock.calls[0][0]).toBe(failure);

    expect(response.status).toBe(500);
  });

  it('forwards an error when destroying the session fails', async () => {
    const failure = new Error('Simulated session destruction failure');

    const logout = vi.fn((callback) => {
      callback();
    });

    const destroy = vi.fn((callback) => {
      callback(failure);
    });

    const { testApp, errorHandler } = createRouteTestApp({
      isAuthenticated: () => true,
      logout,
      session: { destroy },
    });

    const response = await request(testApp)
      .delete('/api/sessions/current');

    expect(logout).toHaveBeenCalledTimes(1);
    expect(destroy).toHaveBeenCalledTimes(1);

    expect(errorHandler).toHaveBeenCalledTimes(1);
    expect(errorHandler.mock.calls[0][0]).toBe(failure);

    expect(response.status).toBe(500);
  });

  it('handles an undefined request body without throwing', async () => {
    const testApp = express();

    testApp.use('/api', authRoutes);

    const response = await request(testApp)
      .post('/api/sessions');

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('INVALID_CREDENTIALS');
    expect(response.body).not.toHaveProperty('user');
  });
});