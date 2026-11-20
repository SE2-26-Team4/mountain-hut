import { useState } from "react";
import { Button, Form, Spinner } from "react-bootstrap";

import Alert from "../common/AutoDismissAlert.jsx";
import AuthPageLayout from "./AuthPageLayout.jsx";
import PasswordField from "./PasswordField.jsx";

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
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

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
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    }
  };

  return (
    <AuthPageLayout
      titleId="change-password-title"
      footer={
        <button
          type="button"
          className="mh-auth-link d-inline-block mt-3"
          onClick={onSignOut}
          disabled={isSubmitting}
        >
          Sign out
        </button>
      }
    >
      <div className="mh-auth-heading">
        <h1 id="change-password-title" className="mh-auth-title">
          Change your password
        </h1>

        <p className="mh-auth-copy">
          For your security, you must choose a new password before using your
          account.
        </p>
      </div>

      {errorMessage && (
        <Alert variant="danger" role="alert" className="mh-auth-alert">
          {errorMessage}
        </Alert>
      )}

      <Form onSubmit={handleSubmit}>
        <PasswordField
          controlId="current-password"
          label="Initial password"
          autoComplete="current-password"
          placeholder="Password from the email"
          value={currentPassword}
          onChange={setCurrentPassword}
          disabled={isSubmitting}
        />

        <PasswordField
          controlId="new-password"
          label="New password"
          autoComplete="new-password"
          placeholder="At least 15 characters"
          minLength={15}
          maxLength={128}
          value={newPassword}
          onChange={setNewPassword}
          disabled={isSubmitting}
        />

        <PasswordField
          controlId="confirm-password"
          label="Confirm new password"
          autoComplete="new-password"
          placeholder="Repeat the new password"
          minLength={15}
          maxLength={128}
          value={confirmPassword}
          onChange={setConfirmPassword}
          disabled={isSubmitting}
          className="mb-4"
        />

        <Button
          className="mh-primary-button mh-auth-submit w-100 d-flex align-items-center justify-content-center gap-2"
          type="submit"
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <>
              <Spinner size="sm" animation="border" aria-hidden="true" />
              <span>Updating…</span>
            </>
          ) : (
            "Update password"
          )}
        </Button>
      </Form>
    </AuthPageLayout>
  );
}
