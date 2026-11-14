import { useEffect, useState } from "react";
import { Offcanvas } from "react-bootstrap";
import { NavLink } from "react-router-dom";

import MountainLogo from "../common/MountainLogo.jsx";

const links = [
  ["house-door", "Dashboard"],
  ["calendar-check", "Reservations"],
  ["people", "Staff Booking", "/staff/bookings"],
  ["calendar3", "Tables & Slots", "/staff/capacity"],
  ["fork-knife", "Menu"],
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
    const desktop = window.matchMedia("(min-width: 750.01px)");

    const handleResize = () => {
      if (desktop.matches) setMenuOpen(false);
    };

    desktop.addEventListener("change", handleResize);

    return () => {
      desktop.removeEventListener("change", handleResize);
    };
  }, []);

  const navigation = (
    <nav className="cap-navigation" aria-label="Staff navigation">
      {links.map(([icon, label, to]) => {
        const content = (
          <>
            <i className={`bi bi-${icon}`} aria-hidden="true" />
            <span>{label}</span>
          </>
        );

        return to ? (
          <NavLink
            key={label}
            to={to}
            end
            onClick={closeMenu}
            className={({ isActive }) =>
              `cap-nav-item d-flex align-items-center text-decoration-none${
                isActive ? " active" : ""
              }`
            }
          >
            {content}
          </NavLink>
        ) : (
          <button
            key={label}
            type="button"
            className="cap-nav-item d-flex align-items-center disabled"
            disabled
          >
            {content}
          </button>
        );
      })}
    </nav>
  );

  const accountMenu = (
    <div className="cap-sidebar-account">
      <div className="mh-mobile-user d-flex align-items-center text-white">
        <i className="bi bi-person" aria-hidden="true" />

        <div className="text-break">
          <strong className="d-block">
            {user.full_name?.trim() || "Your account"}
          </strong>
          <span className="small opacity-75">
            {user.role === "warden" ? "Warden" : "Staff"}
          </span>
        </div>
      </div>

      <button
        type="button"
        className="mh-mobile-signout"
        onClick={() => {
          closeMenu();
          return onLogout();
        }}
      >
        <i className="bi bi-box-arrow-right" aria-hidden="true" />
        Sign out
      </button>
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
