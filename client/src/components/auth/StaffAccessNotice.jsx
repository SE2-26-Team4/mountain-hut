import { useState } from 'react';
import { Alert, Button, Col, Row, Spinner } from 'react-bootstrap';
import { Link } from 'react-router-dom';

import { useAuth } from '../../contexts/auth-context.js';

export default function StaffAccessNotice() {
  const { handleLogout, errorMessage } = useAuth();
  const [isSigningOut, setIsSigningOut] = useState(false);

  async function handleSignOut() {
    setIsSigningOut(true);

    try {
      await handleLogout();
    } finally {
      setIsSigningOut(false);
    }
  }

  return (
  <Row
    as="main"
    className="g-0 align-items-center justify-content-center mh-staff-login-page"
  >
    <Col
      as="section"
      xs={12}
      className="mh-staff-login-card"
      aria-labelledby="staff-access-title"
    >
      <h1 id="staff-access-title" className="h3 mb-3">
        Sign out to continue
      </h1>

      <p className="text-secondary mb-4">
        To access this page, please sign out of your staff account.
      </p>

      {errorMessage && (
        <Alert variant="danger" role="alert">
          {errorMessage}
        </Alert>
      )}

      <div className="d-grid gap-3">
        <Button
          className="mh-primary-button w-100 d-flex align-items-center justify-content-center gap-2"
          onClick={handleSignOut}
          disabled={isSigningOut}
        >
          {isSigningOut ? (
            <>
              <Spinner
                size="sm"
                animation="border"
                aria-hidden="true"
              />
              <span>Signing out…</span>
            </>
          ) : (
            'Sign out and continue'
          )}
        </Button>

        <Link
            className="d-inline-block mt-3 text-dark small"
            to="/staff/capacity"
            >
            ← Back to staff account
        </Link>
      </div>
    </Col>
  </Row>
);
}