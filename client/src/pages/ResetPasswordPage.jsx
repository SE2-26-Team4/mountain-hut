import { useEffect, useState } from "react";
import { Button, Form, Spinner } from "react-bootstrap";
import { Link, useSearchParams } from "react-router-dom";

import API, { SessionApiError } from "../API/session-api.js";
import AuthPageLayout from "../components/auth/AuthPageLayout.jsx";
import PasswordField from "../components/auth/PasswordField.jsx";
import Alert from "../components/common/AutoDismissAlert.jsx";

const MIN_PASSWORD_LENGTH = 15;
const MAX_PASSWORD_LENGTH = 128;

/**
 * @param {unknown} error
 * @returns {boolean}
 */
function isInvalidLinkError(error) {
  return (
    error instanceof SessionApiError && error.code === 'INVALID_RESET_TOKEN'
  );
}

/**
 * @param {{ children: string }} props
 */
function RequestNewLinkButton({ children }) {
  return (
    <Link
      to="/?forgotPassword=1"
      className="btn btn-primary mh-primary-button mh-auth-submit w-100"
    >
      {children}
    </Link>
  );
}

// [REQUIREMENT] MH-07: In any case the hiker can recover their password via email.
// This page opens from the link in the reset email, valid for 24 hours.
export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';

  // Result of checking the link, kept with the token it refers to.
  const [linkCheck, setLinkCheck] = useState({ token: '', usable: false });

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isReset, setIsReset] = useState(false);

  // A link that was already used, replaced or has expired needs a new one,
  // so tell the hiker before they type a new password.
  useEffect(() => {
    if (!token) return;

    let ignore = false;

    API.checkPasswordResetLink(token)
      .then(() => {
        if (!ignore) setLinkCheck({ token, usable: true });
      })
      .catch((error) => {
        // If the check itself fails, show the form: saving the password
        // checks the link again.
        if (!ignore) {
          setLinkCheck({ token, usable: !isInvalidLinkError(error) });
        }
      });

    return () => {
      ignore = true;
    };
  }, [token]);

  /** @type {'missing' | 'checking' | 'usable' | 'invalid'} */
  let linkStatus = 'missing';

  if (token) {
    if (linkCheck.token !== token) {
      linkStatus = 'checking';
    } else {
      linkStatus = linkCheck.usable ? 'usable' : 'invalid';
    }
  }

  /** @param {import('react').SubmitEvent<HTMLFormElement>} event */
  const handleSubmit = async (event) => {
    event.preventDefault();

    if (isSubmitting) return;

    if (newPassword !== confirmPassword) {
      setErrorMessage('The new password and its confirmation do not match.');
      return;
    }

    setErrorMessage('');
    setIsSubmitting(true);

    try {
      await API.resetPassword({ token, newPassword, confirmPassword });

      setIsReset(true);
    } catch (error) {
      if (isInvalidLinkError(error)) {
        setLinkCheck({ token, usable: false });
      } else {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : 'The password could not be reset.',
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  let content;

  if (isReset) {
    content = (
      <>
        <div className="mh-auth-heading">
          <h1 id="reset-password-title" className="mh-auth-title">
            Password updated
          </h1>

          <p className="mh-auth-copy" role="status">
            You can now sign in with your new password. This link can no
            longer be used.
          </p>
        </div>

        <Link
          to="/?signIn=1"
          className="btn btn-primary mh-primary-button mh-auth-submit w-100"
        >
          Sign in
        </Link>
      </>
    );
  } else if (linkStatus === 'missing') {
    content = (
      <>
        <div className="mh-auth-heading">
          <h1 id="reset-password-title" className="mh-auth-title">
            Reset your password
          </h1>

          <p className="mh-auth-copy" role="alert">
            This password reset link is incomplete. Open the link from the
            email again, or request a new one.
          </p>
        </div>

        <RequestNewLinkButton>Request a new link</RequestNewLinkButton>
      </>
    );
  } else if (linkStatus === 'checking') {
    content = (
      <div className="mh-auth-heading">
        <h1 id="reset-password-title" className="mh-auth-title">
          Choose a new password
        </h1>

        <p
          className="mh-auth-copy d-flex align-items-center gap-2"
          role="status"
        >
          <Spinner size="sm" animation="border" aria-hidden="true" />
          Checking your link…
        </p>
      </div>
    );
  } else if (linkStatus === 'invalid') {
    content = (
      <>
        <div className="mh-auth-heading">
          <h1 id="reset-password-title" className="mh-auth-title">
            Link no longer valid
          </h1>

          <p className="mh-auth-copy" role="alert">
            This password reset link has already been used, was replaced by a
            newer one or has expired. Request a new link to choose a new
            password.
          </p>
        </div>

        <RequestNewLinkButton>Request a new link</RequestNewLinkButton>
      </>
    );
  } else {
    content = (
      <>
        <div className="mh-auth-heading">
          <h1 id="reset-password-title" className="mh-auth-title">
            Choose a new password
          </h1>

          <p className="mh-auth-copy">
            Your new password must be {MIN_PASSWORD_LENGTH} to{' '}
            {MAX_PASSWORD_LENGTH} characters long.
          </p>
        </div>

        {errorMessage && (
          <Alert
            variant="danger"
            role="alert"
            className="mh-auth-alert"
            timeout={0}
          >
            {errorMessage}
          </Alert>
        )}

        <Form onSubmit={handleSubmit}>
          <PasswordField
            controlId="reset-new-password"
            label="New password"
            autoComplete="new-password"
            placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
            minLength={MIN_PASSWORD_LENGTH}
            maxLength={MAX_PASSWORD_LENGTH}
            value={newPassword}
            onChange={setNewPassword}
            disabled={isSubmitting}
          />

          <PasswordField
            controlId="reset-confirm-password"
            label="Confirm new password"
            autoComplete="new-password"
            placeholder="Repeat the new password"
            minLength={MIN_PASSWORD_LENGTH}
            maxLength={MAX_PASSWORD_LENGTH}
            value={confirmPassword}
            onChange={setConfirmPassword}
            disabled={isSubmitting}
            className="mb-4"
          />

          <Button
            className="mh-primary-button mh-auth-submit w-100"
            type="submit"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Spinner size="sm" animation="border" aria-hidden="true" />
                <span>Saving…</span>
              </>
            ) : (
              'Save new password'
            )}
          </Button>
        </Form>
      </>
    );
  }

  return (
    <AuthPageLayout
      titleId="reset-password-title"
      footer={
        <Link to="/" className="d-inline-block mt-3">
          ← Back to website
        </Link>
      }
    >
      {content}
    </AuthPageLayout>
  );
}
