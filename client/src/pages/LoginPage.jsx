import { Col, Row } from 'react-bootstrap';
import { Link, Navigate } from 'react-router-dom';

import { useAuth } from '../contexts/auth-context.js';
import LoginForm from '../components/auth/LoginForm.jsx';

function getLandingPath(user) {
  return user?.role === 'employee' || user?.role === 'warden'
    ? '/staff/capacity'
    : '/';
}

function LoginPage() {
  const {
    user,
    isLoading,
    isSubmitting,
    errorMessage,
    feedbackMessage,
    handleLogin,
  } = useAuth();
  if (isLoading) {
    return <main role="status">Loading Mountain Hut…</main>;
  }

  if (user) {
    return <Navigate to={getLandingPath(user)} replace />;
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
        aria-label="Sign in"
      >
        <LoginForm
          isSubmitting={isSubmitting}
          errorMessage={errorMessage}
          feedbackMessage={feedbackMessage}
          onLogin={handleLogin}
        />

        <Link to="/" className="d-inline-block mt-3">
          ← Back to website
        </Link>
      </Col>
    </Row>
  );
}

export default LoginPage;
