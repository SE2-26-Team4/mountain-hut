
// [Employee access for capacity management]: Verify that only authenticated staff can access protected routes.
import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { requireStaff } from '../../middleware/require-role.js';

const app = express();

app.use((req, _res, next) => {
  const role = req.get('x-test-role');

  req.isAuthenticated = () => Boolean(role);

  if (role) {
    req.user = { role };
  }

  next();
});

app.get('/api/capacity', requireStaff, (_req, res) => {
  res.status(200).json({ access: 'granted' });
});

describe('staff-only capacity access', () => {
  it('rejects requests without authentication', async () => {
    const response = await request(app).get('/api/capacity');

    expect(response.status).toBe(401);
  });

  it('rejects authenticated hikers', async () => {
    const response = await request(app)
      .get('/api/capacity')
      .set('x-test-role', 'hiker');

    expect(response.status).toBe(403);
  });

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
});
