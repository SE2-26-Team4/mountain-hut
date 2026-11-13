import { describe, expect, it } from 'vitest';

import { buildInitialPasswordEmail } from '../../services/initial-password-content.js';

describe('initial password email content', () => {
  it('includes the credentials and sign-in link in both formats', () => {
    const email = buildInitialPasswordEmail({
      fullName: 'Mario <Rossi>',
      email: 'mario@example.com',
      initialPassword: 'a&temporary-password',
    });

    expect(email.to).toBe('mario@example.com');
    expect(email.subject).toBe('Your Mountain Hut account is ready');
    expect(email.text).toContain(
      'Temporary password: a&temporary-password',
    );
    expect(email.text).toContain(
      'Sign in to Mountain Hut: http://localhost:5173/?signIn=1',
    );
    expect(email.html).toContain('a&amp;temporary-password');
    expect(email.html).toContain('Mario &lt;Rossi&gt;');
    expect(email.html).toContain('href="http://localhost:5173/?signIn=1"');
  });

  it('rejects incomplete account credentials', () => {
    expect(() =>
      buildInitialPasswordEmail({
        fullName: '',
        email: 'mario@example.com',
        initialPassword: 'temporary',
      }),
    ).toThrow('Hiker name, email, and initial password are required.');
  });
});
