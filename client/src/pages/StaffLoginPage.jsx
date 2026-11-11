import { Col, Row } from 'react-bootstrap';
import { Link, Navigate, useNavigate } from 'react-router-dom';

import { useAuth } from '../contexts/auth-context.js';
import LoginForm from '../components/auth/LoginForm.jsx';

function StaffLoginPage() {
  const {
    user,
    isLoading,
    isSubmitting,
    errorMessage,
    feedbackMessage,
    handleLogin,
    handleLogout,
  } = useAuth();

  const navigate = useNavigate();

  const handleSignOut = async () => {
    await handleLogout();

    navigate('/', { replace: true });
  };

  if (isLoading) {
    return <main role="status">Loading Mountain Hut…</main>;
  }

  if (user?.role === 'employee' || user?.role === 'warden') {
    return <Navigate to="/staff/capacity" replace />;
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
        aria-label="Staff sign in"
      >
        {user ? (
          <div>
            <h1>Staff sign in</h1>

            <p role="alert">
              This area is reserved for staff. Please sign out
              before using a staff account.
            </p>

            <button
              type="button"
              className="mh-primary-button"
              onClick={handleSignOut}
            >
              Sign out
            </button>

            {errorMessage && (
              <p role="alert">{errorMessage}</p>
            )}
          </div>
        ) : (
          <LoginForm
            area="staff"
            isSubmitting={isSubmitting}
            errorMessage={errorMessage}
            feedbackMessage={feedbackMessage}
            onLogin={(credentials) =>
              handleLogin(credentials, 'staff')
            }
          />
        )}

        <Link to="/" className="d-inline-block mt-3">
          ← Back to website
        </Link>
      </Col>
    </Row>
  );
}

export default StaffLoginPage;