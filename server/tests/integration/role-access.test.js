import express from 'express';
import request from 'supertest';

import {
  describe,
  expect,
  it,
} from 'vitest';

import { requireStaff } from '../../middleware/require-role.js';

// Create a minimal application for testing staff authorization.
const app = express();

// Simulate authentication using the role provided in the test request header.
app.use((req, _res, next) => {
  const role = req.get('x-test-role');

  req.isAuthenticated = () => Boolean(role);

  if (role) {
    req.user = { role };
  }

  next();
});

// Protect the capacity endpoint with the staff authorization middleware.
app.get('/api/capacity', requireStaff, (_req, res) => {
  res.status(200).json({ access: 'granted' });
});

describe('staff-only capacity access', () => {
  // Requests without authentication must receive an unauthorized response.
  it('rejects requests without authentication', async () => {
    const response = await request(app).get('/api/capacity');

    expect(response.status).toBe(401);
  });

  // Authenticated hikers must not access staff-only resources.
  it('rejects authenticated hikers', async () => {
    const response = await request(app)
      .get('/api/capacity')
      .set('x-test-role', 'hiker');

    expect(response.status).toBe(403);
  });

  // Both supported staff roles must be allowed through the middleware.
  it.each(['employee', 'warden'])(
    'allows authenticated %s users',
    async (role) => {
      const response = await request(app)
        .get('/api/capacity')
        .set('x-test-role', role);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ access: 'granted' });
    },
  );

  // Missing authentication helpers must be handled as unauthenticated requests.
  it('rejects requests when the authentication function is missing', async () => {
    const testApp = express();

    testApp.get('/api/capacity', requireStaff, (_req, res) => {
      res.json({ access: 'granted' });
    });

    const response = await request(testApp).get('/api/capacity');

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHENTICATED');
  });

  // Authentication alone is insufficient when the user object is missing.
  it('rejects authenticated requests without a user', async () => {
    const testApp = express();

    testApp.use((req, _res, next) => {
      req.isAuthenticated = () => true;

      next();
    });

    testApp.get('/api/capacity', requireStaff, (_req, res) => {
      res.json({ access: 'granted' });
    });

    const response = await request(testApp).get('/api/capacity');

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHENTICATED');
  });

  // Authenticated users with unsupported roles must receive a forbidden response.
  it('rejects authenticated users with an unrecognized role', async () => {
    const response = await request(app)
      .get('/api/capacity')
      .set('x-test-role', 'guest');

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('FORBIDDEN');
  });

  // An existing user object without a role must not grant staff access.
  it('rejects authenticated users with a missing role property', async () => {
    const testApp = express();

    testApp.use((req, _res, next) => {
      req.isAuthenticated = () => true;
      req.user = {};

      next();
    });

    testApp.get('/api/capacity', requireStaff, (_req, res) => {
      res.json({ access: 'granted' });
    });

    const response = await request(testApp).get('/api/capacity');

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('FORBIDDEN');
  });
});

// Preserve the original standalone test for unsupported roles.
it('rejects authenticated users with an unrecognized role', async () => {
  const response = await request(app)
    .get('/api/capacity')
    .set('x-test-role', 'guest');

  expect(response.status).toBe(403);
  expect(response.body.error.code).toBe('FORBIDDEN');
});

// Preserve the original standalone test for a missing user role.
it('rejects authenticated users with a missing role property', async () => {
  const testApp = express();

  testApp.use((req, _res, next) => {
    req.isAuthenticated = () => true;

    // The user object exists but has no role property.
    req.user = {};

    next();
  });

  testApp.get('/api/capacity', requireStaff, (_req, res) => {
    res.json({ access: 'granted' });
  });

  const response = await request(testApp).get('/api/capacity');

  expect(response.status).toBe(403);
  expect(response.body.error.code).toBe('FORBIDDEN');
});