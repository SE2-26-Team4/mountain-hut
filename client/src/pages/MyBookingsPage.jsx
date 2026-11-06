import { Col, Row } from 'react-bootstrap';
import { Navigate, useNavigate } from 'react-router-dom';

import { useAuth } from '../contexts/auth-context.js';
import SiteHeader from '../components/layout/SiteHeader.jsx';
import SiteFooter from '../components/layout/SiteFooter.jsx';

export default function MyBookingsPage() {
  const { user, isLoading, handleLogout } = useAuth();
  const navigate = useNavigate();

  if (isLoading) {
    return <main role="status">Loading Mountain Hut…</main>;
  }

  if (!user) {
    return <Navigate to="/" replace />;
  }

  if (user.role !== 'hiker') {
    return <Navigate to="/staff/capacity" replace />;
  }

  return (
    <div className="mh-app-shell d-flex flex-column">
      <SiteHeader
        user={user}
        onSignIn={() => navigate('/')}
        onSignOut={handleLogout}
      />

      <main className="container flex-grow-1 py-5">
        <Row className="g-0 justify-content-center py-4">
          <Col
            as="section"
            xs={12}
            className="mh-staff-login-card text-center"
            aria-labelledby="my-bookings-title"
          >
            <i
              className="bi bi-calendar-check fs-1 d-block mb-4"
              style={{ color: 'var(--mh-copper)' }}
              aria-hidden="true"
            />

            <h1 id="my-bookings-title" className="h3 mb-3">
              My bookings
            </h1>

            <p className="fw-semibold mb-2">
              Coming soon
            </p>

            <p className="text-secondary mb-0">
              Your bookings will be available here soon.
            </p>
          </Col>
        </Row>
      </main>

      <SiteFooter />
    </div>
  );
}