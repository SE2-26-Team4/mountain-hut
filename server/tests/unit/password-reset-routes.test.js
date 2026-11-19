import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';

// Replace the reset service to simulate unexpected failures.
const mocks = vi.hoisted(() => ({
  checkPasswordResetToken: vi.fn(),
  createPasswordResetRequest: vi.fn(),
  resetPassword: vi.fn(),
}));

vi.mock('../../services/password-reset-service.js', async (importOriginal) => ({
  ...(await importOriginal()),
  checkPasswordResetToken: mocks.checkPasswordResetToken,
  createPasswordResetRequest: mocks.createPasswordResetRequest,
  resetPassword: mocks.resetPassword,
}));

import app from '../../app.js';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('password reset routes', () => {
  it.each([
    ['requesting a link', '/api/password-reset-requests', mocks.createPasswordResetRequest],
    ['checking a link', '/api/password-reset-checks', mocks.checkPasswordResetToken],
    ['setting the new password', '/api/password-resets', mocks.resetPassword],
  ])('reports an unexpected failure while %s as a server error', async (_label, path, mock) => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    mock.mockRejectedValueOnce(new Error('Simulated database failure'));

    const response = await request(app)
      .post(path)
      .send({ email: 'hiker@example.com', token: 'token' });

    expect(response.status).toBe(500);
    expect(response.body.error).toEqual({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred.',
    });
    expect(consoleError).toHaveBeenCalledWith(
      'Password reset API error:',
      expect.any(Error),
    );
  });
});
