import { useState } from 'react';
import { Button, Form, Spinner } from 'react-bootstrap';

import Alert from '../common/AutoDismissAlert.jsx';
import MountainLogo from '../common/MountainLogo.jsx';

/**
 * @typedef {import('../../API/session-api.js').LoginCredentials} LoginCredentials
 */

/**
 * @param {Object} props
 * @param {boolean} props.isSubmitting
 * @param {string} props.errorMessage
 * @param {string} props.feedbackMessage
 * @param {(credentials: LoginCredentials) => Promise<boolean>} props.onLogin
 * @param {string} [props.title]
 * @param {string} [props.description]
 */
function LoginForm({
  isSubmitting,
  errorMessage,
  onLogin,
  title = 'Sign in',
  description = 'Welcome back! Sign in to manage your reservations and enjoy your alpine experience.',
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
      setPassword('');
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

      {errorMessage && (
        <Alert
          variant="danger"
          role="alert"
          className="mh-auth-alert"
        >
          {errorMessage}
        </Alert>
      )}

      <Form onSubmit={handleSubmit}>
        <Form.Group
          className="mb-3"
          controlId="login-email"
        >
          <Form.Label>Email address</Form.Label>

          <div className="mh-auth-input-wrapper">
            <span
              className="mh-auth-input-icon"
              aria-hidden="true"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect
                  x="3"
                  y="5"
                  width="18"
                  height="14"
                  rx="2"
                />

                <path d="m3 7 9 6 9-6" />
              </svg>
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

        <Form.Group
          className="mb-4"
          controlId="login-password"
        >
          <Form.Label>Password</Form.Label>

          <div className="mh-auth-input-wrapper">
            <span
              className="mh-auth-input-icon"
              aria-hidden="true"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect
                  x="5"
                  y="10"
                  width="14"
                  height="11"
                  rx="2"
                />

                <path d="M8 10V7a4 4 0 0 1 8 0v3" />
              </svg>
            </span>

            <Form.Control
              type={showPassword ? 'text' : 'password'}
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
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              aria-pressed={showPassword}
              disabled={isSubmitting}
              onClick={() => setShowPassword((current) => !current)}
            >
              <i
                className={`bi ${showPassword ? 'bi-eye-slash' : 'bi-eye'}`}
                aria-hidden="true"
              />
            </button>
          </div>
        </Form.Group>

        <Button
          className="mh-primary-button mh-auth-submit w-100"
          type="submit"
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <>
              <Spinner
                size="sm"
                animation="border"
                aria-hidden="true"
              />

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

      <p className="mh-privacy-note">
        Your details are used only to manage your
        Mountain Hut session.
      </p>
    </div>
  );
}

export default LoginForm;