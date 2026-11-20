/**
 * @typedef {Object} InitialPasswordEmail
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
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/**
 * Builds the one-time password email for an account created by staff.
 * The password is included only in this email and must be replaced at login.
 *
 * @param {{ fullName: string, email: string, initialPassword: string }} input
 * @returns {InitialPasswordEmail}
 */
export function buildInitialPasswordEmail({
  fullName,
  email,
  initialPassword,
}) {
  if (!fullName?.trim() || !email?.trim() || !initialPassword) {
    throw new Error("Hiker name, email, and initial password are required.");
  }

  const name = fullName.trim();
  const recipient = email.trim();
  const signInUrl = new URL(
    "/?signIn=1",
    process.env.CLIENT_ORIGIN ?? "http://localhost:5173",
  ).toString();

  const text = [
    `Hello ${name},`,
    "",
    "A Mountain Hut account has been created for you by a staff member.",
    "",
    `Email: ${recipient}`,
    `Temporary password: ${initialPassword}`,
    "",
    `Sign in to Mountain Hut: ${signInUrl}`,
    "",
    "You must change this temporary password immediately after your first sign-in.",
    "If you did not request this account, please contact the Mountain Hut staff.",
    "",
    "The Mountain Hut team",
  ].join("\n");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Your Mountain Hut account</title>
</head>
<body style="margin:0;padding:0;background-color:#f7f8fa;color:#172c38;font-family:Arial,Helvetica,sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">
    Your Mountain Hut account is ready. Sign in with your temporary password.
  </div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
    bgcolor="#f7f8fa" style="width:100%;background-color:#f7f8fa;">
    <tr>
      <td align="center" bgcolor="#f7f8fa"
        style="padding:32px 12px;background-color:#f7f8fa;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0"
          style="width:100%;max-width:600px;border-spacing:0;">
          <tr>
            <td align="center" bgcolor="#ffffff"
              style="padding:28px 28px 12px;border-radius:20px 20px 0 0;background:#ffffff;text-align:center;">
              <p style="margin:0 0 20px;color:#172c38;font-size:12px;font-weight:400;letter-spacing:3px;">
                MOUNTAIN HUT
              </p>
              <table role="presentation" align="center" cellpadding="0" cellspacing="0"
                style="margin:0 auto 16px;">
                <tr>
                  <td align="center" valign="middle">
                    <img src="cid:booking-success-check"
                      width="60" height="60" alt=""
                      style="display:block;width:60px;height:60px;border:0;">
                  </td>
                </tr>
              </table>
              <h1 style="margin:0;color:#172c38;font-size:28px;line-height:1.25;font-weight:600;">
                Your account is ready
              </h1>
            </td>
          </tr>
          <tr>
            <td bgcolor="#ffffff"
              style="background:#ffffff;padding:28px;border-radius:0 0 20px 20px;font-size:15px;line-height:1.65;">
              <p style="margin:0 0 12px;">
                Hello ${escapeHtml(name)},
              </p>
              <p style="margin:0 0 24px;color:#596873;">
                A Mountain Hut account has been created for you by a staff member.
                Use the credentials below to sign in.
              </p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
                style="table-layout:fixed;background:#ffffff;border:1px solid #dce2e7;border-radius:12px;border-spacing:0;">
                <tr>
                  <th style="padding:14px 18px;text-align:left;vertical-align:top;width:40%;font-size:14px;font-weight:400;color:#596873;border-bottom:1px solid #e3e3de;">
                    Email
                  </th>
                  <td style="padding:14px 18px;text-align:left;vertical-align:top;font-size:14px;font-weight:600;border-bottom:1px solid #e3e3de;overflow-wrap:anywhere;">
                    ${escapeHtml(recipient)}
                  </td>
                </tr>
                <tr>
                  <th style="padding:14px 18px;text-align:left;vertical-align:top;font-size:14px;font-weight:400;color:#596873;">
                    Temporary password
                  </th>
                  <td style="padding:14px 18px;text-align:left;vertical-align:top;font-size:16px;font-weight:700;letter-spacing:.04em;overflow-wrap:anywhere;">
                    ${escapeHtml(initialPassword)}
                  </td>
                </tr>
              </table>
              <p style="margin:24px 0;color:#596873;">
                This temporary password can be used only to sign in initially.
                You must choose a new password before using your account.
              </p>
              <p style="margin:0 0 24px;text-align:center;">
                <a href="${escapeHtml(signInUrl)}"
                  style="display:inline-block;padding:13px 22px;border-radius:999px;background:#c6531b;color:#ffffff;text-decoration:none;font-weight:400;text-align:center;">
                  Sign in to Mountain Hut
                </a>
              </p>
              <p style="margin:0;">
                See you soon,<br>
                <strong>The Mountain Hut team</strong>
              </p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding-top:14px;">
                    <img src="cid:mountain-hut-logo"
                      width="84" height="49" alt="Mountain Hut"
                      style="display:block;width:84px;height:49px;border:0;">
                  </td>
                </tr>
              </table>
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

  return {
    to: recipient,
    subject: "Your Mountain Hut account is ready",
    html,
    text,
  };
}
