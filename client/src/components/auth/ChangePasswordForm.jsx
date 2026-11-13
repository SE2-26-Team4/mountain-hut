import { useState } from 'react';
import { Button, Form, Spinner } from 'react-bootstrap';

import Alert from '../common/AutoDismissAlert.jsx';

/**
 * @param {Object} props
 * @param {boolean} props.isSubmitting
 * @param {string} props.errorMessage
 * @param {(passwords: { currentPassword: string, newPassword: string, confirmPassword: string }) => Promise<boolean>} props.onSubmit
 * @param {() => void | Promise<void>} props.onSignOut
 */
export default function ChangePasswordForm({
  isSubmitting,
  errorMessage,
  onSubmit,
  onSignOut,
}) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  /** @param {import('react').SubmitEvent<HTMLFormElement>} event */
  const handleSubmit = async (event) => {
    event.preventDefault();

    if (isSubmitting) return;

    const changed = await onSubmit({
      currentPassword,
      newPassword,
      confirmPassword,
    });

    if (changed) {
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    }
  };

  return (
    <main className="mh-auth-required-page">
      <section className="mh-auth-required-card" aria-labelledby="change-password-title">
        <h1 id="change-password-title">Change your password</h1>

        <p>
          For your security, you must choose a new password before using your
          account.
        </p>

        {errorMessage && (
          <Alert variant="danger" role="alert">
            {errorMessage}
          </Alert>
        )}

        <Form onSubmit={handleSubmit}>
          <Form.Group className="mb-3" controlId="current-password">
            <Form.Label>Initial password</Form.Label>
            <Form.Control
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              disabled={isSubmitting}
              required
            />
          </Form.Group>

          <Form.Group className="mb-3" controlId="new-password">
            <Form.Label>New password</Form.Label>
            <Form.Control
              type="password"
              autoComplete="new-password"
              minLength={8}
              maxLength={128}
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              disabled={isSubmitting}
              required
            />
          </Form.Group>

          <Form.Group className="mb-4" controlId="confirm-password">
            <Form.Label>Confirm new password</Form.Label>
            <Form.Control
              type="password"
              autoComplete="new-password"
              minLength={8}
              maxLength={128}
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              disabled={isSubmitting}
              required
            />
          </Form.Group>

          <Button
            className="mh-primary-button w-100"
            type="submit"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Spinner size="sm" animation="border" aria-hidden="true" />
                <span>Updating…</span>
              </>
            ) : (
              'Update password'
            )}
          </Button>
        </Form>

        <Button
          variant="link"
          className="mt-3"
          type="button"
          onClick={onSignOut}
          disabled={isSubmitting}
        >
          Sign out
        </Button>
      </section>
    </main>
  );
}
