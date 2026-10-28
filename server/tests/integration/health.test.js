import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../../app.js';

describe('GET /api/health', () => {
  it('responds 200 with status OK and an ISO timestamp', async () => {
    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/application\/json/);
    expect(res.body.status).toBe('OK');
    expect(new Date(res.body.timestamp).toISOString()).toBe(res.body.timestamp);
  });
});
