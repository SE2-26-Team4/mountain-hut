import { Button } from 'react-bootstrap';

import MountainLogo from '../common/MountainLogo.jsx';

const links = [
  ['house-door', 'Dashboard'],
  ['calendar-check', 'Reservations'],
  ['calendar3', 'Tables & Slots'],
  ['fork-knife', 'Menu'],
  ['gear', 'Settings'],
];

/**
 * @param {Object} props
 * @param {() => void | Promise<void>} props.onLogout
 */
export default function StaffSidebar({ onLogout }) {
  return (
    <aside className="cap-sidebar d-flex flex-column">
      <a
        href="/"
        className="cap-brand d-flex flex-column align-items-center text-decoration-none"
        aria-label="Mountain Hut home"
      >
        <span className="cap-brand-logo d-flex align-items-center justify-content-center flex-shrink-0">
          <MountainLogo />
        </span>

        <span>MOUNTAIN HUT</span>
      </a>

      <nav
        className="cap-navigation"
        aria-label="Staff navigation"
      >
        {links.map(([icon, label]) => {
          const isActive = label === 'Tables & Slots';

          return (
            <div
              key={label}
              className={`cap-nav-item d-flex align-items-center ${
                isActive ? 'active' : 'disabled'
              }`}
              aria-current={isActive ? 'page' : undefined}
            >
              <i
                className={`bi bi-${icon}`}
                aria-hidden="true"
              />

              <span>{label}</span>
            </div>
          );
        })}
      </nav>

      <Button
        type="button"
        variant="link"
        className="cap-logout d-flex align-items-center mt-auto rounded-0 text-start text-decoration-none"
        onClick={onLogout}
      >
        <i
          className="bi bi-box-arrow-right"
          aria-hidden="true"
        />

        <span>Log out</span>
      </Button>
    </aside>
  );
}