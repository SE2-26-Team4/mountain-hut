import { useEffect, useState } from 'react';
import { Offcanvas } from 'react-bootstrap';

import MountainLogo from '../common/MountainLogo.jsx';
import ProfileMenu from '../common/ProfileMenu.jsx';

const links = [
  ['house-door', 'Dashboard'],
  ['calendar-check', 'Reservations'],
  ['calendar3', 'Tables & Slots'],
  ['fork-knife', 'Menu'],
];

/**
 * @param {Object} props
 * @param {import('../../API/session-api.js').SessionUser} props.user
 * @param {() => void | Promise<void>} props.onLogout
 */
export default function StaffSidebar({ user, onLogout }) {
  const [menuOpen, setMenuOpen] = useState(false);

  const closeMenu = () => setMenuOpen(false);

  useEffect(() => {
    const desktop = window.matchMedia('(min-width: 750.01px)');

    const handleResize = () => {
      if (desktop.matches) setMenuOpen(false);
    };

    desktop.addEventListener('change', handleResize);

    return () => {
      desktop.removeEventListener('change', handleResize);
    };
  }, []);

  const navigation = (
    <nav className="cap-navigation" aria-label="Staff navigation">
      {links.map(([icon, label]) => {
        const isActive = label === 'Tables & Slots';

        return (
          <button
            key={label}
            type="button"
            className={`cap-nav-item d-flex align-items-center ${
              isActive ? 'active' : 'disabled'
            }`}
            disabled={!isActive}
            aria-current={isActive ? 'page' : undefined}
            onClick={closeMenu}
          >
            <i className={`bi bi-${icon}`} aria-hidden="true" />

            <span>{label}</span>
          </button>
        );
      })}
    </nav>
  );

  const accountMenu = (
    <div className="cap-sidebar-account">
      <ProfileMenu
        user={user}
        dropUp
        onSignOut={() => {
          closeMenu();
          return onLogout();
        }}
      />
    </div>
  );

  return (
    <>
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

        <button
          type="button"
          className="cap-menu-toggle"
          onClick={() => setMenuOpen(true)}
          aria-label="Open navigation"
          aria-expanded={menuOpen}
          aria-controls="staff-mobile-menu"
        >
          <i className="bi bi-list" aria-hidden="true" />
        </button>

        <div className="cap-desktop-navigation">
          {navigation}
          {accountMenu}
        </div>
      </aside>

      <Offcanvas
        id="staff-mobile-menu"
        className="cap-mobile-menu"
        placement="top"
        show={menuOpen}
        onHide={closeMenu}
        backdrop
        backdropClassName="cap-mobile-menu-backdrop"
        aria-labelledby="staff-mobile-menu-title"
      >
        <Offcanvas.Header>
          <Offcanvas.Title id="staff-mobile-menu-title">
            MOUNTAIN HUT
          </Offcanvas.Title>

          <button
            type="button"
            className="cap-menu-toggle"
            onClick={closeMenu}
            aria-label="Close navigation"
          >
            <i className="bi bi-x-lg" aria-hidden="true" />
          </button>
        </Offcanvas.Header>

        <Offcanvas.Body>
          {navigation}
          {accountMenu}
        </Offcanvas.Body>
      </Offcanvas>
    </>
  );
}