import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Keep provider mocks available to the hoisted module factory.
const mocks = vi.hoisted(() => ({
  send: vi.fn(),
  constructor: vi.fn(),
}));

// Replace the Resend client to inspect configuration and simulate responses.
vi.mock("resend", () => ({
  Resend: class {
    constructor(apiKey) {
      mocks.constructor(apiKey);

      this.emails = { send: mocks.send };
    }
  },
}));

import { sendBookingConfirmationEmail } from "../../services/booking-confirmation-service.js";

// Define a complete email message shared by the tests.
const message = {
  to: "hiker@example.com",
  subject: "Your mountain hut reservation",
  html: "<p>Confirmed</p>",
  text: "Confirmed",
};

// Configure valid credentials and a successful provider response before each test.
beforeEach(() => {
  vi.stubEnv("RESEND_API_KEY", "test-key");
  vi.stubEnv("EMAIL_FROM", "Mountain Hut <bookings@example.com>");

  mocks.send.mockReset();
  mocks.constructor.mockReset();

  mocks.send.mockResolvedValue({
    data: { id: "email-123" },
    error: null,
  });
});

// Restore environment variables after each test.
afterEach(() => vi.unstubAllEnvs());

describe("booking confirmation email service", () => {
  // Send the message with the configured credentials and inline logo attachment.
  it("sends to the hiker using the configured sender and API key", async () => {
    await expect(sendBookingConfirmationEmail(message)).resolves.toEqual({
      id: "email-123",
    });

    expect(mocks.constructor).toHaveBeenCalledWith("test-key");

    expect(mocks.send).toHaveBeenCalledWith({
      from: "Mountain Hut <bookings@example.com>",
      ...message,
      attachments: [
        {
          filename: "mountain-hut-email-logo.png",
          content: expect.any(Buffer),
          contentId: "mountain-hut-logo",
        },
        {
          filename: "booking-success-check.png",
          content: expect.any(Buffer),
          contentId: "booking-success-check",
        },
      ],
    });
  });

  // A missing API key must prevent the provider send call.
  it("rejects missing configuration without calling Resend", async () => {
    vi.stubEnv("RESEND_API_KEY", "");

    await expect(sendBookingConfirmationEmail(message)).rejects.toThrow(
      "RESEND_API_KEY",
    );

    expect(mocks.send).not.toHaveBeenCalled();
  });

  // A sender address must be configured before sending.
  it("rejects missing sender configuration", async () => {
    vi.stubEnv("EMAIL_FROM", "");

    await expect(sendBookingConfirmationEmail(message)).rejects.toThrow(
      "EMAIL_FROM",
    );
  });

  // Empty or whitespace-only required fields must fail before sending.
  it("rejects incomplete or whitespace-only messages", async () => {
    await expect(
      sendBookingConfirmationEmail({
        ...message,
        to: "",
      }),
    ).rejects.toThrow("recipient");

    await expect(
      sendBookingConfirmationEmail({
        ...message,
        to: "   ",
      }),
    ).rejects.toThrow(
      "A recipient, subject, HTML body, and text body are required.",
    );

    await expect(
      sendBookingConfirmationEmail({
        ...message,
        subject: "   ",
      }),
    ).rejects.toThrow(
      "A recipient, subject, HTML body, and text body are required.",
    );

    expect(mocks.send).not.toHaveBeenCalled();
  });

  // Provider API errors must expose the returned error message.
  it("raises Resend API errors", async () => {
    mocks.send.mockResolvedValue({
      data: null,
      error: { message: "Invalid sender" },
    });

    await expect(sendBookingConfirmationEmail(message)).rejects.toThrow(
      "Invalid sender",
    );
  });

  // A successful response must include the identifier of the sent email.
  it("rejects a successful API response without an email ID", async () => {
    mocks.send.mockResolvedValue({
      data: {},
      error: null,
    });

    await expect(sendBookingConfirmationEmail(message)).rejects.toThrow(
      "did not include an email ID",
    );
  });

  // Required message fields must be strings before calling the provider.
  it("rejects non-string message fields before calling Resend", async () => {
    await expect(
      sendBookingConfirmationEmail({
        ...message,
        text: 123,
      }),
    ).rejects.toThrow("recipient, subject, HTML body, and text body");

    expect(mocks.send).not.toHaveBeenCalled();
  });

  // Network failures must propagate to the caller.
  it("propagates network errors", async () => {
    mocks.send.mockRejectedValue(new Error("Connection unavailable"));

    await expect(sendBookingConfirmationEmail(message)).rejects.toThrow(
      "Connection unavailable",
    );
  });
});

// Provider errors without a message must use the fallback error description.
it("reports an unknown provider error when no message is supplied", async () => {
  mocks.send.mockResolvedValue({
    data: null,
    error: {},
  });

  await expect(sendBookingConfirmationEmail(message)).rejects.toThrow(
    "Resend email failed: Unknown error",
  );
});
