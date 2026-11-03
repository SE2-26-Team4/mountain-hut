import { Navigate } from 'react-router-dom';

import StaffCapacityManagement from '../components/capacity/StaffCapacityManagement.jsx';
import { useAuth } from '../contexts/auth-context.js';

export default function StaffCapacityPage() {
  const { user, isLoading, handleLogout } = useAuth();

  if (isLoading) {
    return <main role="status">Loading Mountain Hut…</main>;
  }

  // Signing out clears the user, so this also returns staff to their login.
  if (!user) {
    return <Navigate to="/staff/login" replace />;
  }

  if (user.role !== 'employee' && user.role !== 'warden') {
    return <Navigate to="/" replace />;
  }

  return <StaffCapacityManagement user={user} onLogout={handleLogout} />;
}
