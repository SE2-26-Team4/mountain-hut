/**
 * @typedef {Object} AccountEmail
 * @property {string} to
 * @property {string} subject
 * @property {string} html
 * @property {string} text
 */

/**
 * Escapes values before inserting them into the HTML body.
 *
 * @param {string} value
 * @returns {string}
 */
function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

/**
 * Returns the trimmed name and recipient, rejecting missing values.
 *
 * @param {{ fullName?: string, email?: string }} account
 * @returns {{ name: string, recipient: string }}
 */
function readRecipient({ fullName, email }) {
  if (!fullName?.trim() || !email?.trim()) {
    throw new Error('Hiker name and email are required.');
  }

  return { name: fullName.trim(), recipient: email.trim() };
}

/**
 * Wraps the message body in the layout shared by Mountain Hut account emails.
 * The logo uses the content ID attached by the sending service.
 *
 * @param {{ title: string, label: string, heading: string, preview: string, body: string }} parts
 * @returns {string}
 */
function layout({ title, label, heading, preview, body }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background:#f3f1ec;color:#172c38;font-family:Arial,Helvetica,sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">
    ${escapeHtml(preview)}
  </div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td align="center" style="padding:32px 12px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0"
          style="width:100%;max-width:600px;border-spacing:0;">
          <tr>
            <td bgcolor="#102b3a"
              style="padding:30px 28px 32px;border-radius:20px 20px 0 0;background:#102b3a;">
              <p style="margin:0 0 22px;color:#ffffff;font-size:12px;font-weight:700;letter-spacing:2px;">
                MOUNTAIN HUT
              </p>
              <p style="margin:0 0 10px;color:#f49461;font-size:12px;letter-spacing:1.4px;font-weight:bold;">
                ${escapeHtml(label)}
              </p>
              <h1 style="margin:0;color:#ffffff;font-size:28px;line-height:1.25;font-weight:600;">
                ${escapeHtml(heading)}
              </h1>
            </td>
          </tr>
          <tr>
            <td bgcolor="#ffffff"
              style="background:#ffffff;padding:28px;border-radius:0 0 20px 20px;font-size:15px;line-height:1.65;">
              ${body}
              <p style="margin:0;">
                See you soon,<br>
                <strong>The Mountain Hut team</strong>
              </p>
              <img src="cid:mountain-hut-logo"
                width="84" height="49" alt="Mountain Hut"
                style="display:block;width:84px;height:49px;margin-top:14px;border:0;">
            </td>
          </tr>
        </table>
        <p style="margin:18px 0 0;color:#6b7479;font-size:12px;">
          Good food, higher horizons.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Builds the email containing the link to choose a new password.
 *
 * @param {{ fullName: string, email: string, token: string }} input
 * @returns {AccountEmail}
 */
export function buildPasswordResetEmail({ fullName, email, token }) {
  const { name, recipient } = readRecipient({ fullName, email });

  if (!token) {
    throw new Error('A password reset token is required.');
  }

  const resetUrl = new URL(
    '/reset-password',
    process.env.CLIENT_ORIGIN ?? 'http://localhost:5173',
  );

  resetUrl.searchParams.set('token', token);

  const link = resetUrl.toString();

  const text = [
    `Hello ${name},`,
    '',
    'We received a request to reset the password of your Mountain Hut account.',
    '',
    `Choose a new password: ${link}`,
    '',
    'This link expires in 24 hours and can be used only once.',
    'If you did not request a new password, you can ignore this email: your current password stays the same.',
    '',
    'The Mountain Hut team',
  ].join('\n');

  const html = layout({
    title: 'Reset your Mountain Hut password',
    label: 'PASSWORD RESET',
    heading: 'Choose a new password',
    preview: 'Use this link within 24 hours to choose a new password.',
    body: `
              <p style="margin:0 0 12px;">
                Hello ${escapeHtml(name)},
              </p>
              <p style="margin:0 0 24px;color:#596873;">
                We received a request to reset the password of your Mountain Hut account.
              </p>
              <p style="margin:0 0 24px;">
                <a href="${escapeHtml(link)}"
                  style="display:inline-block;padding:13px 22px;border-radius:999px;background:#c6531b;color:#ffffff;text-decoration:none;font-weight:700;">
                  Choose a new password
                </a>
              </p>
              <p style="margin:0 0 24px;color:#596873;">
                This link expires in 24 hours and can be used only once.
                If you did not request a new password, you can ignore this email:
                your current password stays the same.
              </p>`,
  });

  return {
    to: recipient,
    subject: 'Reset your Mountain Hut password',
    html,
    text,
  };
}

/**
 * Builds the notice sent after the password has been reset, so that the
 * hiker can react if they did not make the change.
 *
 * @param {{ fullName: string, email: string }} input
 * @returns {AccountEmail}
 */
export function buildPasswordChangedEmail({ fullName, email }) {
  const { name, recipient } = readRecipient({ fullName, email });

  const text = [
    `Hello ${name},`,
    '',
    'The password of your Mountain Hut account has just been reset.',
    '',
    'If you did not make this change, please contact the Mountain Hut staff.',
    '',
    'The Mountain Hut team',
  ].join('\n');

  const html = layout({
    title: 'Your Mountain Hut password was changed',
    label: 'SECURITY NOTICE',
    heading: 'Your password was changed',
    preview: 'The password of your Mountain Hut account has been reset.',
    body: `
              <p style="margin:0 0 12px;">
                Hello ${escapeHtml(name)},
              </p>
              <p style="margin:0 0 24px;color:#596873;">
                The password of your Mountain Hut account has just been reset.
                If you did not make this change, please contact the Mountain Hut staff.
              </p>`,
  });

  return {
    to: recipient,
    subject: 'Your Mountain Hut password was changed',
    html,
    text,
  };
}
