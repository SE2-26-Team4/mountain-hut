import {
  describe,
  expect,
  it,
} from 'vitest';

import request from 'supertest';

import app from '../../app.js';

describe('GET /api/health', () => {
  // The health endpoint must return JSON with an OK status and an ISO timestamp.
  it('responds 200 with status OK and an ISO timestamp', async () => {
    const res = await request(app).get('/api/health');

    // Verify the HTTP status and response content type.
    expect(res.status).toBe(200);

    expect(
      res.headers['content-type'],
    ).toMatch(/application\/json/);

    // Verify the health status and timestamp format.
    expect(res.body.status).toBe('OK');

    expect(
      new Date(res.body.timestamp).toISOString(),
    ).toBe(res.body.timestamp);
  });
});