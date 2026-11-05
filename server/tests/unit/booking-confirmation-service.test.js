import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  send: vi.fn(),
  constructor: vi.fn(),
}));

vi.mock('resend', () => ({
  Resend: class {
    constructor(apiKey) {
      mocks.constructor(apiKey);
      this.emails = { send: mocks.send };
    }
  },
}));

import { sendBookingConfirmationEmail } from '../../services/booking-confirmation-service.js';

const message = {
  to: 'hiker@example.com',
  subject: 'Your mountain hut reservation',
  html: '<p>Confirmed</p>',
  text: 'Confirmed',
};

beforeEach(() => {
  vi.stubEnv('RESEND_API_KEY', 'test-key');
  vi.stubEnv('EMAIL_FROM', 'Mountain Hut <bookings@example.com>');
  mocks.send.mockReset();
  mocks.constructor.mockReset();
  mocks.send.mockResolvedValue({ data: { id: 'email-123' }, error: null });
});

afterEach(() => vi.unstubAllEnvs());

describe('booking confirmation email service', () => {
  it('sends to the hiker using the configured sender and API key', async () => {
    await expect(sendBookingConfirmationEmail(message)).resolves.toEqual({ id: 'email-123' });
    expect(mocks.constructor).toHaveBeenCalledWith('test-key');
    expect(mocks.send).toHaveBeenCalledWith({
      from: 'Mountain Hut <bookings@example.com>',
      ...message,
    });
  });

  it('rejects missing configuration without calling Resend', async () => {
    vi.stubEnv('RESEND_API_KEY', '');
    await expect(sendBookingConfirmationEmail(message)).rejects.toThrow('RESEND_API_KEY');
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it('rejects missing sender configuration', async () => {
    vi.stubEnv('EMAIL_FROM', '');
    await expect(sendBookingConfirmationEmail(message)).rejects.toThrow('EMAIL_FROM');
  });

  it('rejects incomplete messages', async () => {
    await expect(sendBookingConfirmationEmail({ ...message, to: '' })).rejects.toThrow('recipient');
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it('raises Resend API errors', async () => {
    mocks.send.mockResolvedValue({ data: null, error: { message: 'Invalid sender' } });
    await expect(sendBookingConfirmationEmail(message)).rejects.toThrow('Invalid sender');
  });

  it('rejects a successful API response without an email ID', async () => {
    mocks.send.mockResolvedValue({ data: {}, error: null });
    await expect(sendBookingConfirmationEmail(message)).rejects.toThrow(
      'did not include an email ID'
    );
  });

  it('rejects non-string message fields before calling Resend', async () => {
    await expect(
      sendBookingConfirmationEmail({ ...message, text: 123 })
    ).rejects.toThrow('recipient, subject, HTML body, and text body');
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it('propagates network errors', async () => {
    mocks.send.mockRejectedValue(new Error('Connection unavailable'));
    await expect(sendBookingConfirmationEmail(message)).rejects.toThrow('Connection unavailable');
  });
});
