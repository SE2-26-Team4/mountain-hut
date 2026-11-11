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

// Create shared DAO mocks before the mocked modules are imported.
const mocks = vi.hoisted(() => ({
  getUserByEmail: vi.fn(),
  getUserById: vi.fn(),
}));

// Replace database account lookups with controlled test responses.
vi.mock('../../dao/auth-dao.js', () => ({
  getUserByEmail: mocks.getUserByEmail,
  getUserById: mocks.getUserById,
}));

import app from '../../app.js';
import passport from '../../config/passport.js';
import authRoutes from '../../routes/auth-routes.js';
import { hashPassword } from '../../services/password.js';

// Clear mock implementations and call history before each test.
beforeEach(() => {
  vi.resetAllMocks();
});

// Restore original methods replaced by spies after each test.
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

  // Parse JSON bodies before requests reach the authentication routes.
  testApp.use(express.json());

  // Inject methods and session properties required by each failure scenario.
  testApp.use((req, _res, next) => {
    Object.assign(req, requestProperties);
    next();
  });

  testApp.use('/api', authRoutes);

  // Capture forwarded errors and return a predictable test response.
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
  // Verify that a failed account lookup cannot create an authenticated session.
  it('returns 500 without creating a session when the user lookup fails', async () => {
    mocks.getUserByEmail.mockRejectedValueOnce(
      new Error('Simulated database failure'),
    );

    // Preserve cookies between login and the subsequent session check.
    const agent = request.agent(app);

    const loginResponse = await agent
      .post('/api/sessions')
      .send({
        email: 'auth-error-test@example.com',
        password: 'AuthErrorTest123!',
      });

    // Confirm that authentication attempted the expected account lookup.
    expect(mocks.getUserByEmail).toHaveBeenCalledExactlyOnceWith(
      'auth-error-test@example.com',
    );

    expect(loginResponse.status).toBe(500);
    expect(loginResponse.body).not.toHaveProperty('user');

    // A failed login must leave the agent unauthenticated.
    const sessionResponse = await agent.get(
      '/api/sessions/current',
    );

    expect(sessionResponse.status).toBe(401);
    expect(sessionResponse.body.error.code).toBe('UNAUTHENTICATED');

    expect(mocks.getUserById).not.toHaveBeenCalled();
  });

  // Verify error handling when Passport cannot restore an existing session.
  it('returns 500 when restoring the session fails', async () => {
    const email = 'session-error-test@example.com';
    const password = 'SessionErrorTest123!';

    // Provide a valid account so the initial login succeeds.
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

    // Fail the account lookup used to deserialize the saved session.
    mocks.getUserById.mockRejectedValueOnce(
      new Error('Simulated session lookup failure'),
    );

    const sessionResponse = await agent.get(
      '/api/sessions/current',
    );

    // Return a server error without exposing user data.
    expect(mocks.getUserById).toHaveBeenCalledExactlyOnceWith(123);
    expect(sessionResponse.status).toBe(500);
    expect(sessionResponse.body).not.toHaveProperty('user');
  });

  // Verify that session creation errors are forwarded to Express.
  it('forwards an error when creating the login session fails', async () => {
    const failure = new Error('Simulated login session failure');

    const user = {
      id: 456,
      full_name: 'Login Failure Test Hiker',
      email: 'login-failure@example.com',
      role: 'hiker',
    };

    // Bypass credential verification to isolate the session creation step.
    vi.spyOn(passport, 'authenticate').mockImplementation(
      (_strategy, callback) => {
        return (_req, _res, _next) => {
          callback(null, user);
        };
      },
    );

    // Simulate req.logIn failing after credentials have been accepted.
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

    // Ensure the route attempted login and forwarded the original error once.
    expect(logIn).toHaveBeenCalledExactlyOnceWith(
      user,
      expect.any(Function),
    );

    expect(errorHandler).toHaveBeenCalledTimes(1);
    expect(errorHandler.mock.calls[0][0]).toBe(failure);

    expect(response.status).toBe(500);
    expect(response.body).not.toHaveProperty('user');
  });

  // Verify that a logout failure stops the remaining session cleanup steps.
  it('forwards a logout error without continuing to destroy the session', async () => {
    const failure = new Error('Simulated logout failure');

    const logout = vi.fn((callback) => {
      callback(failure);
    });

    const destroy = vi.fn();

    // Provide an authenticated request whose logout operation fails.
    const { testApp, errorHandler } = createRouteTestApp({
      isAuthenticated: () => true,
      logout,
      session: { destroy },
    });

    const response = await request(testApp)
      .delete('/api/sessions/current');

    expect(logout).toHaveBeenCalledTimes(1);
    expect(destroy).not.toHaveBeenCalled();

    // Confirm that the original failure reaches the error handler.
    expect(errorHandler).toHaveBeenCalledTimes(1);
    expect(errorHandler.mock.calls[0][0]).toBe(failure);

    expect(response.status).toBe(500);
  });

  // Verify error handling when logout succeeds but session destruction fails.
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

    // Both steps should run, with the destruction error forwarded once.
    expect(logout).toHaveBeenCalledTimes(1);
    expect(destroy).toHaveBeenCalledTimes(1);

    expect(errorHandler).toHaveBeenCalledTimes(1);
    expect(errorHandler.mock.calls[0][0]).toBe(failure);

    expect(response.status).toBe(500);
  });

  // Verify that missing request bodies produce a validation response.
  it('handles an undefined request body without throwing', async () => {
    const testApp = express();

    // Omit JSON middleware so req.body remains undefined.
    testApp.use('/api', authRoutes);

    const response = await request(testApp)
      .post('/api/sessions');

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('INVALID_CREDENTIALS');
    expect(response.body).not.toHaveProperty('user');
  });
});

// Check that each role uses the correct login area without opening a session.
it.each([
  ['/api/sessions', 'employee', 'Please use the staff login.'],
  ['/api/sessions', 'warden', 'Please use the staff login.'],
  ['/api/staff/sessions', 'hiker', 'Please use the hiker login.'],
])(
  'rejects %s for role %s without opening a session',
  async (path, role, hint) => {
    const user = {
      id: 789,
      full_name: 'Wrong Area',
      email: 'area@example.com',
      role,
    };

    // Accept credentials so the test isolates the login-area role check.
    vi.spyOn(passport, 'authenticate').mockImplementation(
      (_strategy, callback) =>
        (_req, _res, _next) => callback(null, user)
    );

    const logIn = vi.fn();
    const { testApp } = createRouteTestApp({ logIn });

    const response = await request(testApp)
      .post(path)
      .send({
        email: user.email,
        password: 'AreaTest123!',
      });

    // Reject the role with a useful hint before attempting session creation.
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('WRONG_LOGIN_AREA');
    expect(response.body.error.message).toContain(hint);
    expect(logIn).not.toHaveBeenCalled();
  }
);