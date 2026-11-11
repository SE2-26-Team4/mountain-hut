import { Navigate, useNavigate } from 'react-router-dom';

import { useAuth } from '../contexts/auth-context.js';
import MyBookingsList from '../components/booking/MyBookingsList.jsx';
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

      <main
        className="container mh-my-bookings flex-grow-1 py-5"
        aria-labelledby="my-bookings-title"
      >
        <header className="mb-4">
          <h1 id="my-bookings-title" className="mb-2">
            My bookings
          </h1>

          <p className="text-secondary mb-0">
            Review your table reservations and cancel the ones you no
            longer need.
          </p>
        </header>

        <MyBookingsList hikerId={user.id} />
      </main>

      <SiteFooter />
    </div>
  );
}