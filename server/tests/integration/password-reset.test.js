import { createHash, randomUUID } from "node:crypto";

import request from "supertest";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

// Create the email mock before importing modules that use the sending service.
const emailMocks = vi.hoisted(() => ({
  send: vi.fn(),
}));

// Capture the emails without sending real messages.
vi.mock("../../services/booking-confirmation-service.js", () => ({
  sendBookingConfirmationEmail: emailMocks.send,
}));

import app from "../../app.js";
import { allAsync, getAsync, initializeDatabase, runAsync } from "../../db.js";
import { initializeAccounts } from "../../init/init-accounts.js";
import { hashPassword } from "../../services/password.js";

// [REQUIREMENT] MH-07: In any case the hiker can recover their password via
// email; the reset link expires after 24 hours.

const uniqueSuffix = randomUUID();

// A hiker created by staff who never received the initial password.
const hikerEmail = `password-reset-${uniqueSuffix}@example.com`;
const initialPassword = "InitialPassword123!";
const newPassword = "RecoveredPassword123!";

const staffEmail = (process.env.TEST_EMPLOYEE_EMAIL ?? "employee@example.com")
  .trim()
  .toLowerCase();

const RESET_REQUEST_MESSAGE =
  "If a hiker account uses this email, we have sent a link to choose a new password. The link expires in 24 hours.";

let hikerId;
let staffId;

/* HELPERS */

function setNow(instant) {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(instant));
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

// Request a reset link and return the token included in the email.
async function requestResetToken(email = hikerEmail) {
  emailMocks.send.mockClear();

  const response = await request(app)
    .post("/api/password-reset-requests")
    .send({ email });

  expect(response.status).toBe(202);

  await vi.waitFor(() => expect(emailMocks.send).toHaveBeenCalledTimes(1));

  const [message] = emailMocks.send.mock.calls[0];
  const token = /reset-password\?token=([\w-]+)/.exec(message.text)?.[1];

  expect(token).toEqual(expect.any(String));

  return { message, token };
}

function resetWith(token, overrides = {}) {
  return request(app)
    .post("/api/password-resets")
    .send({
      token,
      newPassword,
      confirmPassword: newPassword,
      ...overrides,
    });
}

function checkLink(token) {
  return request(app).post("/api/password-reset-checks").send({ token });
}

function signIn(password) {
  return request(app)
    .post("/api/sessions")
    .send({ email: hikerEmail, password });
}

const INVALID_LINK_ERROR = {
  code: "INVALID_RESET_TOKEN",
  message:
    "This password reset link is invalid or has expired. Request a new one.",
};

/* SETUP */

beforeAll(async () => {
  await initializeDatabase();
  await initializeAccounts();

  staffId = (
    await getAsync("SELECT id FROM users WHERE email = ?", [staffEmail])
  ).id;
});

beforeEach(async () => {
  emailMocks.send.mockReset();
  emailMocks.send.mockResolvedValue({ id: "test-email-id" });

  await runAsync("DELETE FROM users WHERE email = ?", [hikerEmail]);

  hikerId = (
    await runAsync(
      `INSERT INTO users (
         full_name, email, password_hash, role, must_change_password
       )
       VALUES (?, ?, ?, 'hiker', 1)`,
      [
        `Password Reset Hiker ${uniqueSuffix}`,
        hikerEmail,
        await hashPassword(initialPassword),
      ],
    )
  ).lastID;
});

afterEach(() => {
  vi.useRealTimers();
});

afterAll(async () => {
  await runAsync("DELETE FROM password_reset_tokens WHERE user_id = ?", [
    staffId,
  ]);
  await runAsync("DELETE FROM users WHERE full_name LIKE ?", [
    `%${uniqueSuffix}%`,
  ]);
});

/* TESTS */

describe("POST /api/password-reset-requests", () => {
  it("emails a reset link valid for 24 hours and stores only its hash", async () => {
    setNow("2031-05-04T08:00:00.000Z");

    const { message, token } = await requestResetToken(
      `  ${hikerEmail.toUpperCase()}  `,
    );

    expect(message).toMatchObject({
      to: hikerEmail,
      subject: "Reset your Mountain Hut password",
    });
    expect(message.text).toContain("expires in 24 hours");
    expect(message.html).toContain(`/reset-password?token=${token}`);

    const rows = await allAsync(
      "SELECT token_hash, expires_at FROM password_reset_tokens WHERE user_id = ?",
      [hikerId],
    );

    expect(rows).toEqual([
      {
        token_hash: sha256(token),
        expires_at: "2031-05-05T08:00:00.000Z",
      },
    ]);
  });

  it.each([
    ["an unknown email", () => `unknown-${uniqueSuffix}@example.com`],
    ["a staff account", () => staffEmail],
    ["a temporary hiker", () => `temporary-${uniqueSuffix}@example.com`],
  ])(
    "gives the same answer without sending an email for %s",
    async (_label, email) => {
      await runAsync(
        `INSERT INTO users (full_name, email, role, is_temporary)
       VALUES (?, ?, 'hiker', 1)`,
        [
          `Temporary Reset ${uniqueSuffix}`,
          `temporary-${uniqueSuffix}@example.com`,
        ],
      );

      try {
        const response = await request(app)
          .post("/api/password-reset-requests")
          .send({ email: email() });

        expect(response.status).toBe(202);
        expect(response.body).toEqual({ message: RESET_REQUEST_MESSAGE });

        // Give an email sent in the background the time to be recorded.
        await new Promise((resolve) => setTimeout(resolve, 20));
        expect(emailMocks.send).not.toHaveBeenCalled();
      } finally {
        await runAsync("DELETE FROM users WHERE full_name = ?", [
          `Temporary Reset ${uniqueSuffix}`,
        ]);
      }
    },
  );

  it.each([
    ["a missing email", undefined],
    ["a blank email", "   "],
    ["a non-text email", 42],
    ["a malformed email", "not-an-email"],
    ["a too long email", `${"a".repeat(250)}@example.com`],
  ])("rejects %s", async (_label, email) => {
    const response = await request(app)
      .post("/api/password-reset-requests")
      .send({ email });

    expect(response.status).toBe(400);
    expect(response.body.error).toEqual({
      code: "INVALID_EMAIL",
      message: "A valid email address is required.",
    });
  });

  it("rejects a request without a body", async () => {
    const response = await request(app).post("/api/password-reset-requests");

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("INVALID_EMAIL");
  });

  it("gives the same answer when the email cannot be sent", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    emailMocks.send.mockRejectedValue(new Error("Email provider down"));

    try {
      const response = await request(app)
        .post("/api/password-reset-requests")
        .send({ email: hikerEmail });

      expect(response.status).toBe(202);
      expect(response.body).toEqual({ message: RESET_REQUEST_MESSAGE });

      await vi.waitFor(() =>
        expect(consoleError).toHaveBeenCalledWith(
          "Password reset email could not be sent:",
          expect.any(Error),
        ),
      );
    } finally {
      consoleError.mockRestore();
    }
  });

  it("removes expired links of every account", async () => {
    setNow("2031-05-04T08:00:00.000Z");

    await runAsync(
      `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
       VALUES (?, ?, '2031-05-01T00:00:00.000Z')`,
      [staffId, sha256(`expired-${uniqueSuffix}`)],
    );

    await requestResetToken();

    expect(
      await getAsync(
        "SELECT COUNT(*) AS total FROM password_reset_tokens WHERE user_id = ?",
        [staffId],
      ),
    ).toEqual({ total: 0 });
  });
});

describe("POST /api/password-resets", () => {
  it("sets the new password, unlocks the account and notifies the hiker", async () => {
    const { token } = await requestResetToken();
    emailMocks.send.mockClear();

    const response = await resetWith(token);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      message: "Your password has been reset. You can now sign in.",
    });

    expect(emailMocks.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: hikerEmail,
        subject: "Your Mountain Hut password was changed",
      }),
    );

    expect((await signIn(initialPassword)).status).toBe(401);

    // The initial password no longer has to be changed.
    const login = await signIn(newPassword);

    expect(login.status).toBe(201);
    expect(login.body.user.mustChangePassword).toBe(false);
  });

  it("accepts each link only once", async () => {
    const { token } = await requestResetToken();

    expect((await resetWith(token)).status).toBe(200);

    const second = await resetWith(token, {
      newPassword: "AnotherPassword123!",
      confirmPassword: "AnotherPassword123!",
    });

    expect(second.status).toBe(400);
    expect(second.body.error).toEqual({
      code: "INVALID_RESET_TOKEN",
      message:
        "This password reset link is invalid or has expired. Request a new one.",
    });
  });

  it("accepts a link until 24 hours after the request", async () => {
    setNow("2031-05-04T08:00:00.000Z");
    const { token } = await requestResetToken();

    vi.setSystemTime(new Date("2031-05-05T07:59:59.999Z"));

    expect((await resetWith(token)).status).toBe(200);
  });

  it("rejects a link 24 hours after the request", async () => {
    setNow("2031-05-04T08:00:00.000Z");
    const { token } = await requestResetToken();

    vi.setSystemTime(new Date("2031-05-05T08:00:00.000Z"));

    const response = await resetWith(token);

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("INVALID_RESET_TOKEN");
    expect((await signIn(initialPassword)).status).toBe(201);
  });

  it("accepts only the most recent link of the hiker", async () => {
    const { token: firstToken } = await requestResetToken();
    const { token: secondToken } = await requestResetToken();

    expect((await resetWith(firstToken)).status).toBe(400);
    expect((await resetWith(secondToken)).status).toBe(200);
  });

  it("does not reset the password of a staff account", async () => {
    const token = `staff-${uniqueSuffix}`;

    await runAsync(
      `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
       VALUES (?, ?, '2099-01-01T00:00:00.000Z')`,
      [staffId, sha256(token)],
    );

    const response = await resetWith(token);

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("INVALID_RESET_TOKEN");
  });

  it.each([
    ["a missing token", undefined],
    ["a non-text token", 42],
    ["an empty token", ""],
    ["a too long token", "a".repeat(257)],
    ["an unknown token", "unknown-token"],
  ])("rejects %s", async (_label, token) => {
    const response = await resetWith(token);

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("INVALID_RESET_TOKEN");
  });

  it.each([
    {
      label: "a too short password",
      overrides: { newPassword: "short", confirmPassword: "short" },
      field: "newPassword",
      code: "PASSWORD_TOO_SHORT",
      message: "Use at least 15 characters.",
    },
    {
      label: "a too long password",
      overrides: {
        newPassword: "a".repeat(129),
        confirmPassword: "a".repeat(129),
      },
      field: "newPassword",
      code: "PASSWORD_TOO_LONG",
      message: "Use 128 characters or fewer.",
    },
    {
      label: "a different confirmation",
      overrides: { confirmPassword: "Different123!" },
      field: "confirmPassword",
      code: "PASSWORD_MISMATCH",
      message: "The passwords do not match.",
    },
    {
      label: "a missing password",
      overrides: { newPassword: undefined },
      field: "newPassword",
      code: "PASSWORD_REQUIRED",
      message: "Enter a password.",
    },
    {
      label: "a missing confirmation",
      overrides: { confirmPassword: undefined },
      field: "confirmPassword",
      code: "PASSWORD_CONFIRMATION_REQUIRED",
      message: "Enter your password again.",
    },
  ])(
    "rejects $label and keeps the link usable",
    async ({ overrides, field, code, message }) => {
      const { token } = await requestResetToken();

      const response = await resetWith(token, overrides);

      expect(response.status).toBe(400);
      expect(response.body.error).toEqual({ field, code, message });

      expect((await resetWith(token)).status).toBe(200);
    },
  );

  it("rejects a request without a body", async () => {
    const response = await request(app).post("/api/password-resets");

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("INVALID_RESET_TOKEN");
  });

  it("rejects a link requested before the password was changed while signed in", async () => {
    const { token } = await requestResetToken();
    const agent = request.agent(app);

    expect(
      (
        await agent
          .post("/api/sessions")
          .send({ email: hikerEmail, password: initialPassword })
      ).status,
    ).toBe(201);

    const change = await agent.put("/api/sessions/current/password").send({
      currentPassword: initialPassword,
      newPassword: "ChangedPassword123!",
      confirmPassword: "ChangedPassword123!",
    });

    expect(change.status).toBe(200);

    const response = await resetWith(token);

    expect(response.status).toBe(400);
    expect(response.body.error).toEqual(INVALID_LINK_ERROR);
    expect((await signIn("ChangedPassword123!")).status).toBe(201);
    expect(
      await allAsync("SELECT id FROM password_reset_tokens WHERE user_id = ?", [
        hikerId,
      ]),
    ).toEqual([]);
  });

  it("keeps the new password when the notification cannot be sent", async () => {
    const { token } = await requestResetToken();
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    emailMocks.send.mockRejectedValue(new Error("Email provider down"));

    try {
      const response = await resetWith(token);

      expect(response.status).toBe(200);
      expect(consoleError).toHaveBeenCalledWith(
        "Password reset, but the notification email could not be sent:",
        expect.any(Error),
      );
      expect((await signIn(newPassword)).status).toBe(201);
    } finally {
      consoleError.mockRestore();
    }
  });
});

describe("POST /api/password-reset-checks", () => {
  it("accepts a link that can still be used, without using it", async () => {
    const { token } = await requestResetToken();

    const response = await checkLink(token);

    expect(response.status).toBe(204);
    expect((await resetWith(token)).status).toBe(200);
  });

  it("asks for a new link once the password has been reset", async () => {
    const { token } = await requestResetToken();

    expect((await resetWith(token)).status).toBe(200);

    const response = await checkLink(token);

    expect(response.status).toBe(400);
    expect(response.body.error).toEqual(INVALID_LINK_ERROR);
  });

  it("accepts a link until 24 hours after the request", async () => {
    setNow("2031-05-04T08:00:00.000Z");
    const { token } = await requestResetToken();

    vi.setSystemTime(new Date("2031-05-05T07:59:59.999Z"));

    expect((await checkLink(token)).status).toBe(204);

    vi.setSystemTime(new Date("2031-05-05T08:00:00.000Z"));

    expect((await checkLink(token)).status).toBe(400);
  });

  it("rejects a link replaced by a newer one", async () => {
    const { token: firstToken } = await requestResetToken();
    const { token: secondToken } = await requestResetToken();

    expect((await checkLink(firstToken)).status).toBe(400);
    expect((await checkLink(secondToken)).status).toBe(204);
  });

  it("rejects the link of a staff account", async () => {
    const token = `staff-check-${uniqueSuffix}`;

    await runAsync(
      `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
       VALUES (?, ?, '2099-01-01T00:00:00.000Z')`,
      [staffId, sha256(token)],
    );

    expect((await checkLink(token)).status).toBe(400);
  });

  it.each([
    ["a missing token", undefined],
    ["a non-text token", 42],
    ["an empty token", ""],
    ["a too long token", "a".repeat(257)],
    ["an unknown token", "unknown-token"],
  ])("rejects %s", async (_label, token) => {
    const response = await checkLink(token);

    expect(response.status).toBe(400);
    expect(response.body.error).toEqual(INVALID_LINK_ERROR);
  });

  it("rejects a request without a body", async () => {
    const response = await request(app).post("/api/password-reset-checks");

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("INVALID_RESET_TOKEN");
  });
});
