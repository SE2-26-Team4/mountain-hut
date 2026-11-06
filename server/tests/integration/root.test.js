import request from 'supertest';

import {
  describe,
  expect,
  it,
} from 'vitest';

import app from '../../app.js';

describe('development root endpoint', () => {
  // The development root endpoint must return the backend status message.
  it('returns the backend status message', async () => {
    const response = await request(app).get('/');

    expect(response.status).toBe(200);

    expect(response.body).toEqual({
      message: 'this is the mountain hut server',
    });
  });
});