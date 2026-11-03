import { Navigate } from 'react-router-dom';

import { useAuth } from '../contexts/auth-context.js';

export default function MyBookingsPage() {
  const { user, isLoading } = useAuth();

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
    <main className="container py-5" aria-label="My bookings">
      <h1>My bookings</h1>

      <p className="text-secondary">
        Your bookings will be available here soon.
      </p>
    </main>
  );
}