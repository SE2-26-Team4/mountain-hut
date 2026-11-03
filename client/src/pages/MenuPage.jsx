import { Col, Row } from 'react-bootstrap';
import { Link, useNavigate } from 'react-router-dom';

import { useAuth } from '../contexts/auth-context.js';
import SiteHeader from '../components/layout/SiteHeader.jsx';

export default function MenuPage() {
  const { user, isLoading, handleLogout } = useAuth();
  const navigate = useNavigate();

  if (isLoading) {
    return <main role="status">Loading Mountain Hut…</main>;
  }

  return (
    <div className="mh-app-shell">
      <SiteHeader
        user={user}
        onSignIn={() => navigate('/')}
        onSignOut={handleLogout}
      />

      <main className="container py-5 text-secondary">
        <Row className="g-0">
          <Col xs={12}>
            <h1>Meal times and menus</h1>

            <p className="mt-3">
              Meal times and menus will be available here soon.
            </p>

            <Link to="/" className="mh-primary-button mt-3">
              Back to dining
            </Link>
          </Col>
        </Row>
      </main>
    </div>
  );
}