import { useState } from "react";
import { Button, Form, Spinner } from "react-bootstrap";
import { Link } from "react-router-dom";

import Alert from "../common/AutoDismissAlert.jsx";
import MountainLogo from "../common/MountainLogo.jsx";

/**
 * @typedef {import('../../API/session-api.js').LoginCredentials} LoginCredentials
 */

const AREA_COPY = {
  hiker: {
    title: "Sign in",
    description:
      "Welcome back! Sign in to manage your reservations and enjoy your alpine experience.",
  },
  staff: {
    title: "Staff sign in",
    description:
      "Welcome back! Sign in with your staff account to manage hut services.",
  },
};

/**
 * @param {Object} props
 * @param {boolean} props.isSubmitting
 * @param {string} props.errorMessage
 * @param {string} props.feedbackMessage
 * @param {(credentials: LoginCredentials) => Promise<boolean>} props.onLogin
 * @param {'hiker' | 'staff'} [props.area]
 * @param {string} [props.title]
 * @param {string} [props.description]
 * @param {() => void} [props.onForgotPassword] - Shows the password recovery form.
 * @param {() => void} [props.onSignUp] - Opens the hiker sign-up form.
 * @param {string} [props.initialEmail] - Prefills the email after sign-up.
 * @param {string} [props.registrationMessage] - Confirms successful sign-up.
 */
function LoginForm({
  isSubmitting,
  errorMessage,
  onLogin,
  area = "hiker",
  title = AREA_COPY[area].title,
  description = AREA_COPY[area].description,
  onForgotPassword,
  onSignUp,
  initialEmail = "",
  registrationMessage = "",
}) {
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  /** @param {import('react').SubmitEvent<HTMLFormElement>} event */
  const handleSubmit = async (event) => {
    event.preventDefault();

    if (isSubmitting) return;

    const signedIn = await onLogin({
      email: email.trim(),
      password,
    });

    if (signedIn) {
      setPassword("");
      setShowPassword(false);
    }
  };

  return (
    <div className="mh-auth-card">
      <div className="mh-auth-brand">
        <MountainLogo />

        <span>MOUNTAIN HUT</span>
      </div>

      <div className="mh-auth-heading">
        <h2 className="mh-auth-title">{title}</h2>

        <p className="mh-auth-copy">{description}</p>
      </div>

      {registrationMessage && !errorMessage && (
        <Alert variant="success" role="status" className="mh-auth-alert">
          {registrationMessage}
        </Alert>
      )}

      {errorMessage && (
        <Alert variant="danger" role="alert" className="mh-auth-alert">
          {errorMessage}
        </Alert>
      )}

      <Form onSubmit={handleSubmit}>
        <Form.Group className="mb-3" controlId="login-email">
          <Form.Label>Email address</Form.Label>

          <div className="mh-auth-input-wrapper">
            <span className="mh-auth-input-icon" aria-hidden="true">
              <i className="bi bi-envelope" />
            </span>

            <Form.Control
              type="email"
              name="email"
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
              placeholder="your@email.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              disabled={isSubmitting}
              required
            />
          </div>
        </Form.Group>

        <Form.Group className="mb-4" controlId="login-password">
          <Form.Label>Password</Form.Label>

          <div className="mh-auth-input-wrapper">
            <span className="mh-auth-input-icon" aria-hidden="true">
              <i className="bi bi-lock" />
            </span>

            <Form.Control
              type={showPassword ? "text" : "password"}
              name="password"
              autoComplete="current-password"
              placeholder="Your password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              disabled={isSubmitting}
              required
            />

            <button
              className="mh-auth-password-toggle"
              type="button"
              aria-label={showPassword ? "Hide password" : "Show password"}
              aria-pressed={showPassword}
              disabled={isSubmitting}
              onClick={() => setShowPassword((current) => !current)}
            >
              <i
                className={`bi ${showPassword ? "bi-eye-slash" : "bi-eye"}`}
                aria-hidden="true"
              />
            </button>
          </div>

          {area === "hiker" && onForgotPassword && (
            <div className="text-end mt-2">
              <button
                type="button"
                className="mh-auth-link"
                disabled={isSubmitting}
                onClick={onForgotPassword}
              >
                Forgot your password?
              </button>
            </div>
          )}
        </Form.Group>

        <Button
          className="mh-primary-button mh-auth-submit w-100"
          type="submit"
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <>
              <Spinner size="sm" animation="border" aria-hidden="true" />

              <span>Signing in…</span>
            </>
          ) : (
            <>
              <span>Sign in</span>
              <span aria-hidden="true">→</span>
            </>
          )}
        </Button>
      </Form>

      {area === "hiker" && onSignUp && (
        <p className="mh-staff-login-prompt">
          Don’t have an account?{" "}
          <button
            type="button"
            className="mh-auth-link"
            onClick={onSignUp}
            disabled={isSubmitting}
          >
            Create an account
          </button>
        </p>
      )}

      {area === "hiker" && (
        <p className="mh-staff-login-prompt">
          Are you an employee? <Link to="/staff/login">Log in here</Link>
        </p>
      )}

      <p className="mh-privacy-note">
        Your details are used only to manage your Mountain Hut session.
      </p>
    </div>
  );
}

export default LoginForm;
