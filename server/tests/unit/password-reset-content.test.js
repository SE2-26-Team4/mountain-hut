import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  buildPasswordChangedEmail,
  buildPasswordResetEmail,
} from '../../services/password-reset-content.js';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('password reset email content', () => {
  it('includes the reset link and its 24-hour limit in both formats', () => {
    const email = buildPasswordResetEmail({
      fullName: '  Mario <Rossi>  ',
      email: '  mario@example.com  ',
      token: 'abc_DEF-123',
    });

    const link = 'http://localhost:5173/reset-password?token=abc_DEF-123';

    expect(email.to).toBe('mario@example.com');
    expect(email.subject).toBe('Reset your Mountain Hut password');
    expect(email.text).toContain('Hello Mario <Rossi>,');
    expect(email.text).toContain(`Choose a new password: ${link}`);
    expect(email.text).toContain(
      'This link expires in 24 hours and can be used only once.',
    );
    expect(email.html).toContain('Mario &lt;Rossi&gt;');
    expect(email.html).toContain(`href="${link}"`);
    expect(email.html).toContain('expires in 24 hours');
  });

  it('links to the configured client origin', () => {
    vi.stubEnv('CLIENT_ORIGIN', 'https://hut.example.com');

    const email = buildPasswordResetEmail({
      fullName: 'Mario Rossi',
      email: 'mario@example.com',
      token: 'token',
    });

    expect(email.text).toContain(
      'https://hut.example.com/reset-password?token=token',
    );
  });

  it.each([
    ['a name', { fullName: ' ', email: 'mario@example.com', token: 't' }],
    ['an email', { fullName: 'Mario', email: '', token: 't' }],
  ])('requires %s', (_label, input) => {
    expect(() => buildPasswordResetEmail(input)).toThrow(
      'Hiker name and email are required.',
    );
  });

  it('requires a token', () => {
    expect(() =>
      buildPasswordResetEmail({
        fullName: 'Mario',
        email: 'mario@example.com',
        token: '',
      }),
    ).toThrow('A password reset token is required.');
  });
});

describe('password changed email content', () => {
  it('tells the hiker that the password was reset', () => {
    const email = buildPasswordChangedEmail({
      fullName: 'Mario & Anna',
      email: 'mario@example.com',
    });

    expect(email.to).toBe('mario@example.com');
    expect(email.subject).toBe('Your Mountain Hut password was changed');
    expect(email.text).toContain(
      'If you did not make this change, please contact the Mountain Hut staff.',
    );
    expect(email.html).toContain('Mario &amp; Anna');
    expect(email.html).not.toContain('reset-password');
  });

  it('requires the hiker name and email', () => {
    expect(() =>
      buildPasswordChangedEmail({ fullName: 'Mario', email: undefined }),
    ).toThrow('Hiker name and email are required.');
  });
});
