import { Navigate } from 'react-router-dom';

import { useAuth } from '../contexts/auth-context.js';

export default function StaffCapacityPage() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <main role="status">Loading Mountain Hut…</main>;
  }

  if (!user) {
    return <Navigate to="/staff/login" replace />;
  }

  if (user.role !== 'employee' && user.role !== 'warden') {
    return <Navigate to="/" replace />;
  }

  return (
    <main className="container py-5" aria-label="Dining capacity">
      <h1>Dining capacity</h1>

      <p className="text-secondary">
        Capacity management will be available here soon.
      </p>
    </main>
  );
}