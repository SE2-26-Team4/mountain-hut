import { Resend } from 'resend';

/**
 * Sends a prepared booking confirmation email through Resend.
 * Configuration is read when invoked, so tests and deployments can supply it
 * through environment variables without hard-coding secrets.
 *
 * @param {{to: string, subject: string, html: string, text: string}} message
 * @returns {Promise<{id: string | undefined}>}
 */
export async function sendBookingConfirmationEmail(message) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.EMAIL_FROM?.trim();

  if (!apiKey || !from) {
    throw new Error('RESEND_API_KEY and EMAIL_FROM must be configured to send booking emails.');
  }

  if (!message?.to?.trim() || !message?.subject?.trim() || !message?.html?.trim() || !message?.text?.trim()) {
    throw new Error('A recipient, subject, HTML body, and text body are required.');
  }

  const resend = new Resend(apiKey);
  const { data, error } = await resend.emails.send({
    from,
    to: message.to,
    subject: message.subject,
    html: message.html,
    text: message.text,
  });

  // The Resend SDK may resolve with an error instead of rejecting.
  if (error) {
    throw new Error(`Resend email failed: ${error.message ?? 'Unknown error'}`);
  }

  return { id: data?.id };
}
