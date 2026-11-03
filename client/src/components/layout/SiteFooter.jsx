import { Link } from 'react-router-dom';

function SiteFooter() {
  return (
    <footer className="mh-site-footer d-flex justify-content-between gap-3">
      <span className="text-secondary">MOUNTAIN HUT</span>

      <Link to="/staff/login">Staff access</Link>

      <span>Good food, higher horizons.</span>
    </footer>
  );
}

export default SiteFooter;