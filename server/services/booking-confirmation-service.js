import { Resend } from "resend";
import { readFile } from "node:fs/promises";

/**
 * Sends a prepared booking confirmation email through Resend.
 * Configuration is read when invoked, so tests and deployments can supply it
 * through environment variables without hard-coding secrets.
 *
 * @param {{to: string, subject: string, html: string, text: string}} message
 * @returns {Promise<{id: string | undefined}>}
 */
export async function sendBookingConfirmationEmail(message) {
  // Read and normalize the email service configuration.
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.EMAIL_FROM?.trim();

  // Require both the API key and the sender address before sending.
  if (!apiKey || !from) {
    throw new Error(
      "RESEND_API_KEY and EMAIL_FROM must be configured to send booking emails.",
    );
  }

  // Require a recipient, subject, and nonempty HTML and plain-text bodies.
  if (
    !message ||
    typeof message.to !== "string" ||
    typeof message.subject !== "string" ||
    typeof message.html !== "string" ||
    typeof message.text !== "string" ||
    !message.to.trim() ||
    !message.subject.trim() ||
    !message.html.trim() ||
    !message.text.trim()
  ) {
    throw new Error(
      "A recipient, subject, HTML body, and text body are required.",
    );
  }

  // Load the logo relative to this module, independently of the working directory.
  const logo = await readFile(
    new URL("../assets/mountain-hut-email-logo.png", import.meta.url),
  );

  const successCheck = await readFile(
    new URL("../assets/booking-success-check.png", import.meta.url),
  );

  // Create the client using the configuration read for this invocation.
  const resend = new Resend(apiKey);

  // Send both message formats and attach the logo referenced by its content ID.
  const { data, error } = await resend.emails.send({
    from,
    to: message.to,
    subject: message.subject,
    html: message.html,
    text: message.text,
    attachments: [
      {
        filename: "mountain-hut-email-logo.png",
        content: logo,
        contentId: "mountain-hut-logo",
      },
      {
        filename: "booking-success-check.png",
        content: successCheck,
        contentId: "booking-success-check",
      },
    ],
  });

  // The SDK may return an error instead of rejecting the promise.
  if (error) {
    throw new Error(`Resend email failed: ${error.message ?? "Unknown error"}`);
  }

  // Require an email ID to confirm that the service accepted the request.
  if (!data?.id || typeof data.id !== "string") {
    throw new Error(
      "Resend email failed: response did not include an email ID.",
    );
  }

  // Return the provider's email ID; this does not confirm inbox delivery.
  return { id: data.id };
}
