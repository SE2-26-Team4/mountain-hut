import { useState } from 'react';
import { Alert as StatusAlert, Button, Form, Spinner } from 'react-bootstrap';

import API from '../../API/session-api.js';
import Alert from '../common/AutoDismissAlert.jsx';
import MountainLogo from '../common/MountainLogo.jsx';

/**
 * Asks for an email link to choose a new password (MH-07).
 *
 * @param {Object} props
 * @param {() => void} props.onBack - Returns to the sign-in form.
 */
export default function ForgotPasswordForm({ onBack }) {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [sentMessage, setSentMessage] = useState('');

  /** @param {import('react').SubmitEvent<HTMLFormElement>} event */
  const handleSubmit = async (event) => {
    event.preventDefault();

    if (isSubmitting) return;

    setErrorMessage('');
    setIsSubmitting(true);

    try {
      setSentMessage(await API.requestPasswordReset(email.trim()));
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'The reset link could not be requested.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mh-auth-card">
      <div className="mh-auth-brand">
        <MountainLogo />

        <span>MOUNTAIN HUT</span>
      </div>

      <div className="mh-auth-heading">
        <h2 className="mh-auth-title">Reset your password</h2>

        <p className="mh-auth-copy">
          Enter the email of your hiker account. We will send you a link to
          choose a new password.
        </p>
      </div>

      {errorMessage && (
        <Alert variant="danger" role="alert" className="mh-auth-alert">
          {errorMessage}
        </Alert>
      )}

      {sentMessage ? (
        <StatusAlert variant="success" role="status" className="mh-auth-alert">
          {sentMessage}
        </StatusAlert>
      ) : (
        <Form onSubmit={handleSubmit}>
          <Form.Group className="mb-4" controlId="forgot-password-email">
            <Form.Label>Email address</Form.Label>

            <div className="mh-auth-input-wrapper">
              <span className="mh-auth-input-icon" aria-hidden="true">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="3" y="5" width="18" height="14" rx="2" />

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
                maxLength={254}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                disabled={isSubmitting}
                required
              />
            </div>
          </Form.Group>

          <Button
            className="mh-primary-button mh-auth-submit w-100"
            type="submit"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Spinner size="sm" animation="border" aria-hidden="true" />

                <span>Sending link…</span>
              </>
            ) : (
              'Send reset link'
            )}
          </Button>
        </Form>
      )}

      <p className="mh-staff-login-prompt">
        <button
          type="button"
          className="mh-auth-link"
          disabled={isSubmitting}
          onClick={onBack}
        >
          ← Back to sign in
        </button>
      </p>
    </div>
  );
}
