import request from 'supertest';
import { describe, expect, it } from 'vitest';

import app from '../../app.js';

describe('development root endpoint', () => {
  it('returns the backend status message', async () => {
    const response = await request(app).get('/');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      message: 'this is the mountain hut server',
    });
  });
});