import { randomUUID } from "node:crypto";

import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import app from "../../app.js";
import { getAsync, initializeDatabase, runAsync } from "../../db.js";
import { initializeAccounts } from "../../init/init-accounts.js";
import { hashPassword } from "../../services/password.js";

// Read the demo hiker credentials and normalize the email.
const testEmail = (process.env.TEST_HIKER_EMAIL ?? "hiker@example.com")
  .trim()
  .toLowerCase();

const testPassword = process.env.TEST_HIKER_PASSWORD ?? "HikerTest123!";

// Initialize the database and demo accounts before running the tests.
beforeAll(async () => {
  await initializeDatabase();
  await initializeAccounts();
});

describe("hiker session", () => {
  // Verify the complete login, session restoration, and logout flow.
  it("logs in, restores the session, and logs out", async () => {
    // Preserve the session cookie across requests.
    const hikerAgent = request.agent(app);

    const loginResponse = await hikerAgent.post("/api/sessions").send({
      email: testEmail,
      password: testPassword,
    });

    // A successful login returns public account details without the hash.
    expect(loginResponse.status).toBe(201);
    expect(loginResponse.body.user).toMatchObject({
      id: expect.any(Number),
      full_name: expect.any(String),
      email: testEmail,
      role: "hiker",
    });
    expect(loginResponse.body.user).not.toHaveProperty("password_hash");

    // Restore the same user through the saved session cookie.
    const currentUserResponse = await hikerAgent.get("/api/sessions/current");

    expect(currentUserResponse.status).toBe(200);
    expect(currentUserResponse.body.user).toMatchObject({
      id: loginResponse.body.user.id,
      full_name: loginResponse.body.user.full_name,
      email: testEmail,
      role: "hiker",
    });
    expect(currentUserResponse.body.user).not.toHaveProperty("password_hash");

    // Logout succeeds without returning a response body.
    const logoutResponse = await hikerAgent.delete("/api/sessions/current");

    expect(logoutResponse.status).toBe(204);
    expect(logoutResponse.text).toBe("");

    // The previous session must no longer authenticate subsequent requests.
    const afterLogoutResponse = await hikerAgent.get("/api/sessions/current");

    expect(afterLogoutResponse.status).toBe(401);
    expect(afterLogoutResponse.body.error.code).toBe("UNAUTHENTICATED");
  });

  // Verify that an incorrect password does not create a usable session.
  it("rejects an incorrect password without creating a session", async () => {
    const agent = request.agent(app);

    const response = await agent.post("/api/sessions").send({
      email: testEmail,
      password: "incorrect-password",
    });

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("INVALID_CREDENTIALS");
    expect(response.body).not.toHaveProperty("user");

    // Confirm that the failed login left the client unauthenticated.
    const sessionResponse = await agent.get("/api/sessions/current");

    expect(sessionResponse.status).toBe(401);
  });

  // Verify that an unknown email does not create a usable session.
  it("rejects an unknown email without creating a session", async () => {
    const agent = request.agent(app);

    // Generate an address that does not belong to a seeded account.
    const response = await agent.post("/api/sessions").send({
      email: `missing-${randomUUID()}@example.com`,
      password: testPassword,
    });

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("INVALID_CREDENTIALS");
    expect(response.body).not.toHaveProperty("user");

    const sessionResponse = await agent.get("/api/sessions/current");

    expect(sessionResponse.status).toBe(401);
  });

  // Check missing, empty, null, and incorrectly typed credential fields.
  it.each([
    ["missing both fields", {}],
    ["missing email", { password: testPassword }],
    ["missing password", { email: testEmail }],
    ["empty email", { email: "", password: testPassword }],
    ["blank email", { email: "   ", password: testPassword }],
    ["empty password", { email: testEmail, password: "" }],
    ["non-string email", { email: 123, password: testPassword }],
    ["non-string password", { email: testEmail, password: 123 }],
    ["null email", { email: null, password: testPassword }],
    ["null password", { email: testEmail, password: null }],
  ])("rejects credentials with %s", async (_description, credentials) => {
    const response = await request(app).post("/api/sessions").send(credentials);

    // Invalid input must produce a validation error without user data.
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("INVALID_CREDENTIALS");
    expect(response.body).not.toHaveProperty("user");
  });

  // Require authentication before returning current-session account data.
  it("rejects a session request without authentication", async () => {
    const response = await request(app).get("/api/sessions/current");

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("UNAUTHENTICATED");
    expect(response.body).not.toHaveProperty("user");
  });

  // Allow logout even when no authenticated session exists.
  it("allows logout without authentication", async () => {
    const response = await request(app).delete("/api/sessions/current");

    expect(response.status).toBe(204);
    expect(response.text).toBe("");
  });
});

describe("session for a deleted account", () => {
  // Verify that a saved session cannot authenticate a deleted user.
  it("rejects the session when the authenticated user no longer exists", async () => {
    // Create a temporary account with unique credentials.
    const email = `deleted-account-${randomUUID()}@example.com`;
    const password = "DeletedAccountTest123!";
    const passwordHash = await hashPassword(password);

    const result = await runAsync(
      `INSERT INTO users (full_name, email, password_hash, role)
       VALUES (?, ?, ?, ?)`,
      ["Temporary Hiker", email, passwordHash, "hiker"],
    );

    const userId = result.lastID;

    try {
      // Log in and preserve the temporary account's session cookie.
      const agent = request.agent(app);

      const loginResponse = await agent
        .post("/api/sessions")
        .send({ email, password });

      expect(loginResponse.status).toBe(201);
      expect(loginResponse.body.user.id).toBe(userId);

      // Confirm that the session works before removing the account.
      const activeSessionResponse = await agent.get("/api/sessions/current");

      expect(activeSessionResponse.status).toBe(200);

      // Delete the account while the client still holds its session cookie.
      await runAsync("DELETE FROM users WHERE id = ?", [userId]);

      // Session restoration must reject the now-missing account.
      const deletedAccountResponse = await agent.get("/api/sessions/current");

      expect(deletedAccountResponse.status).toBe(401);
      expect(deletedAccountResponse.body.error.code).toBe("UNAUTHENTICATED");
      expect(deletedAccountResponse.body).not.toHaveProperty("user");
    } finally {
      // Remove the temporary account even if an earlier assertion fails.
      await runAsync("DELETE FROM users WHERE id = ?", [userId]);
    }
  });

  describe("initial password change", () => {
    const email = `initial-password-${randomUUID()}@example.com`;
    const initialPassword = "InitialPassword123!";
    const replacementPassword = "ReplacementPassword123!";
    let userId;

    beforeAll(async () => {
      const result = await runAsync(
        `INSERT INTO users (
           full_name, email, password_hash, role, must_change_password
         )
         VALUES (?, ?, ?, 'hiker', 1)`,
        ["Initial Password Hiker", email, await hashPassword(initialPassword)],
      );

      userId = result.lastID;
    });

    afterAll(async () => {
      await runAsync("DELETE FROM users WHERE id = ?", [userId]);
    });

    it("marks the session as requiring a password change", async () => {
      const agent = request.agent(app);

      const response = await agent
        .post("/api/sessions")
        .send({ email, password: initialPassword });

      expect(response.status).toBe(201);
      expect(response.body.user.mustChangePassword).toBe(true);

      const protectedResponse = await agent.get("/api/bookings");

      expect(protectedResponse.status).toBe(403);
      expect(protectedResponse.body.error.code).toBe(
        "PASSWORD_CHANGE_REQUIRED",
      );
    });

    it.each([
      {
        label: "no current password",
        overrides: { currentPassword: "" },
        field: "currentPassword",
        code: "INVALID_PASSWORD",
        message: "Enter your current password.",
      },
      {
        label: "a non-text current password",
        overrides: { currentPassword: 42 },
        field: "currentPassword",
        code: "INVALID_PASSWORD",
        message: "Enter your current password.",
      },
      {
        label: "a too short new password",
        overrides: { newPassword: "short", confirmPassword: "short" },
        field: "newPassword",
        code: "PASSWORD_TOO_SHORT",
        message: "Use at least 15 characters.",
      },
      {
        label: "a too long new password",
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
    ])(
      "rejects a password change with $label",
      async ({ overrides, field, code, message }) => {
        const agent = request.agent(app);

        await agent.post("/api/sessions").send({
          email,
          password: initialPassword,
        });

        const response = await agent
          .put("/api/sessions/current/password")
          .send({
            currentPassword: initialPassword,
            newPassword: replacementPassword,
            confirmPassword: replacementPassword,
            ...overrides,
          });

        expect(response.status).toBe(400);
        expect(response.body.error).toEqual({ field, code, message });
      },
    );

    it("rejects a password change without a body", async () => {
      const agent = request.agent(app);

      await agent
        .post("/api/sessions")
        .send({ email, password: initialPassword });

      const response = await agent.put("/api/sessions/current/password");

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe("INVALID_PASSWORD");
    });

    it("rejects a wrong initial password", async () => {
      const agent = request.agent(app);

      await agent
        .post("/api/sessions")
        .send({ email, password: initialPassword });

      const response = await agent.put("/api/sessions/current/password").send({
        currentPassword: "WrongPassword123!",
        newPassword: replacementPassword,
        confirmPassword: replacementPassword,
      });

      expect(response.status).toBe(401);
      expect(response.body.error).toEqual({
        code: "INVALID_PASSWORD",
        message: "The current password is incorrect.",
      });
    });

    it("rejects a new password equal to the initial one", async () => {
      const agent = request.agent(app);

      await agent
        .post("/api/sessions")
        .send({ email, password: initialPassword });

      const response = await agent.put("/api/sessions/current/password").send({
        currentPassword: initialPassword,
        newPassword: initialPassword,
        confirmPassword: initialPassword,
      });

      expect(response.status).toBe(400);
      expect(response.body.error.message).toBe(
        "The new password must differ from the current password.",
      );
    });

    it("requires a session to change the password", async () => {
      const response = await request(app)
        .put("/api/sessions/current/password")
        .send({
          currentPassword: initialPassword,
          newPassword: replacementPassword,
          confirmPassword: replacementPassword,
        });

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe("UNAUTHENTICATED");
    });

    it("changes the password and unlocks authenticated features", async () => {
      const agent = request.agent(app);

      await agent
        .post("/api/sessions")
        .send({ email, password: initialPassword });

      const changeResponse = await agent
        .put("/api/sessions/current/password")
        .send({
          currentPassword: initialPassword,
          newPassword: replacementPassword,
          confirmPassword: replacementPassword,
        });

      expect(changeResponse.status).toBe(200);
      expect(changeResponse.body.user.mustChangePassword).toBe(false);

      const protectedResponse = await agent.get("/api/bookings");

      expect(protectedResponse.status).toBe(200);

      const oldPasswordResponse = await request(app)
        .post("/api/sessions")
        .send({ email, password: initialPassword });

      expect(oldPasswordResponse.status).toBe(401);

      const newPasswordResponse = await request(app)
        .post("/api/sessions")
        .send({ email, password: replacementPassword });

      expect(newPasswordResponse.status).toBe(201);
      expect(newPasswordResponse.body.user.mustChangePassword).toBe(false);
    });

    it("does not allow temporary hikers to log in", async () => {
      const temporaryEmail = `temporary-${randomUUID()}@example.com`;
      const result = await runAsync(
        `INSERT INTO users (full_name, role, is_temporary)
         VALUES (?, 'hiker', 1)`,
        ["Temporary Hiker"],
      );

      try {
        const response = await request(app)
          .post("/api/sessions")
          .send({ email: temporaryEmail, password: initialPassword });

        expect(response.status).toBe(401);
      } finally {
        await runAsync("DELETE FROM users WHERE id = ?", [result.lastID]);
      }
    });
  });

  // Verify that a login request without a body is rejected safely.
  it("rejects a login request without a body", async () => {
    const response = await request(app).post("/api/sessions");

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("INVALID_CREDENTIALS");
    expect(response.body).not.toHaveProperty("user");
  });
});

describe("public hiker sign-up", () => {
  const password = "Four hikers cross the valley";

  it("rejects sign-up without a body", async () => {
    const response = await request(app).post("/api/hikers");

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("INVALID_NAME");
  });

  it.each([
    ["long name", { fullName: "a".repeat(101) }, "INVALID_NAME"],
    ["non-text email", { email: 42 }, "INVALID_EMAIL"],
    ["malformed email", { email: "invalid" }, "INVALID_EMAIL"],
    ["long email", { email: "a".repeat(250) + "@test.it" }, "INVALID_EMAIL"],
    ["non-text phone", { phone: 12345678 }, "INVALID_PHONE"],
    ["long phone", { phone: "1".repeat(31) }, "INVALID_PHONE"],
  ])("rejects a %s", async (_label, overrides, code) => {
    const response = await request(app)
      .post("/api/hikers")
      .send({
        fullName: "Test Hiker",
        email: `signup-${randomUUID()}@example.com`,
        password,
        confirmPassword: password,
        ...overrides,
      });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe(code);
  });

  it("rejects an email already registered with different casing", async () => {
    const response = await request(app).post("/api/hikers").send({
      fullName: "Test Hiker",
      email: testEmail.toUpperCase(),
      password,
      confirmPassword: password,
    });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("EMAIL_ALREADY_REGISTERED");
  });

  // The sign-up form uses the API response to show feedback under the right field.
  it.each([
    {
      label: "too short",
      value: "a".repeat(14),
      confirmation: "a".repeat(14),
      field: "password",
      code: "PASSWORD_TOO_SHORT",
      message: "Use at least 15 characters.",
    },
    {
      label: "too long",
      value: "a".repeat(129),
      confirmation: "a".repeat(129),
      field: "password",
      code: "PASSWORD_TOO_LONG",
      message: "Use 128 characters or fewer.",
    },
    {
      label: "confirmed incorrectly",
      value: password,
      confirmation: "Five hikers cross the valley",
      field: "confirmPassword",
      code: "PASSWORD_MISMATCH",
      message: "The passwords do not match.",
    },
  ])(
    "returns field feedback when the password is $label",
    async ({ value, confirmation, field, code, message }) => {
      const response = await request(app)
        .post("/api/hikers")
        .send({
          fullName: "Maria Giulia De Luca",
          email: `signup-${randomUUID()}@example.com`,
          password: value,
          confirmPassword: confirmation,
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toEqual({ field, code, message });
    },
  );

  it.each([
    { label: "without a phone field", input: {}, expectedPhone: null },
    { label: "with a blank phone", input: { phone: "" }, expectedPhone: null },
    {
      label: "with a formatted phone",
      input: { phone: "+39 333 123-4567" },
      expectedPhone: "+393331234567",
    },
  ])(
    "registers a hiker $label and allows sign-in",
    async ({ input, expectedPhone }) => {
      const email = `signup-${randomUUID()}@example.com`;

      try {
        const signup = await request(app)
          .post("/api/hikers")
          .send({
            fullName: "Maria Giulia De Luca",
            email: ` ${email.toUpperCase()} `,
            password,
            confirmPassword: password,
            ...input,
          });

        expect(signup.status).toBe(201);
        expect(signup.body).toEqual({ id: expect.any(Number) });

        const saved = await getAsync(
          "SELECT email, phone, must_change_password FROM users WHERE id = ?",
          [signup.body.id],
        );

        expect(saved).toEqual({
          email,
          phone: expectedPhone,
          must_change_password: 0,
        });

        const login = await request(app)
          .post("/api/sessions")
          .send({ email, password });

        expect(login.status).toBe(201);
        expect(login.body.user).toMatchObject({
          id: signup.body.id,
          full_name: "Maria Giulia De Luca",
          role: "hiker",
        });
      } finally {
        await runAsync("DELETE FROM users WHERE email = ? COLLATE NOCASE", [
          email,
        ]);
      }
    },
  );

  it("rejects an invalid phone without creating an account", async () => {
    const email = `signup-${randomUUID()}@example.com`;

    try {
      const response = await request(app).post("/api/hikers").send({
        fullName: "Maria Giulia De Luca",
        email,
        phone: "abc123",
        password,
        confirmPassword: password,
      });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe("INVALID_PHONE");

      const saved = await getAsync("SELECT id FROM users WHERE email = ?", [
        email,
      ]);
      expect(saved).toBeUndefined();
    } finally {
      await runAsync("DELETE FROM users WHERE email = ?", [email]);
    }
  });
});
