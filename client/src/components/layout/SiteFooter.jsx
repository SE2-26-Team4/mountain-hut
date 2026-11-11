import { Link } from 'react-router-dom';

import { useAuth } from '../../contexts/auth-context.js';

function SiteFooter() {
  const { user } = useAuth();

  return (
    <footer className="mh-site-footer d-flex justify-content-between gap-3">
      <span className="text-secondary">MOUNTAIN HUT</span>

      {user?.role !== 'hiker' && <Link to="/staff/login">Staff access</Link>}

      <span>Good food, higher horizons.</span>
    </footer>
  );
}

export default SiteFooter;