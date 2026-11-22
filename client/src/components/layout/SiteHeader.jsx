import { useEffect, useState } from "react";
import { Col, Offcanvas, Row } from "react-bootstrap";
import { Link, useLocation } from "react-router-dom";

import MountainLogo from "../common/MountainLogo.jsx";
import ProfileMenu from "../common/ProfileMenu.jsx";

/**
 * @typedef {import('../../API/session-api.js').SessionUser} SessionUser
 */

/**
 * @param {Object} props
 * @param {SessionUser | null} props.user
 * @param {() => void} props.onSignIn
 * @param {() => void | Promise<void>} props.onSignOut
 * @param {() => void} [props.onSignUp]
 */
function SiteHeader({ user, onSignIn, onSignUp, onSignOut }) {
  const { pathname } = useLocation();
  const isHome = pathname === "/";
  const isMyBookings = pathname === "/my-bookings";
  const useNavyMobileMenu = isMyBookings || pathname === "/menu";
  const [menuOpen, setMenuOpen] = useState(false);

  const closeMenu = () => setMenuOpen(false);

  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 992px)");

    const handleResize = () => {
      if (desktop.matches) setMenuOpen(false);
    };

    desktop.addEventListener("change", handleResize);

    return () => {
      desktop.removeEventListener("change", handleResize);
    };
  }, []);

  const navigation = (
    <>
      <Link
        to="/"
        aria-current={isHome ? "page" : undefined}
        onClick={closeMenu}
      >
        DINE
      </Link>

      <Link
        to="/menu"
        aria-current={pathname === "/menu" ? "page" : undefined}
        onClick={closeMenu}
      >
        MENU
      </Link>

      <span aria-disabled="true">THE HUT</span>
    </>
  );

  const account = user ? (
    <ProfileMenu user={user} onSignOut={onSignOut} />
  ) : (
    <div className="d-flex align-items-center gap-2">
      <button
        type="button"
        className="mh-site-account-button mh-site-signin"
        onClick={onSignIn}
      >
        Sign in
      </button>

      {onSignUp && (
        <button
          type="button"
          className="mh-site-account-button"
          onClick={onSignUp}
        >
          Sign up
        </button>
      )}
    </div>
  );

  return (
    <>
      <Row
        as="header"
        className={`g-0 align-items-center mh-site-header ${
          isHome ? "mh-site-header-hero" : "mh-site-header-light"
        }${useNavyMobileMenu ? " mh-site-header-bookings" : ""}`}
      >
        <Col className="mh-site-brand-column">
          <Link
            className="mh-site-brand d-inline-flex align-items-center text-decoration-none"
            to="/"
            aria-label="Mountain Hut home"
          >
            <MountainLogo />

            <span>MOUNTAIN HUT</span>
          </Link>
        </Col>

        <Col
          as="nav"
          xs="auto"
          className="mh-site-nav d-flex align-items-center"
          aria-label="Main navigation"
        >
          {navigation}
        </Col>

        <Col className="mh-site-account d-flex align-items-center flex-wrap">
          {account}
        </Col>

        <button
          type="button"
          className="mh-menu-toggle"
          onClick={() => setMenuOpen(true)}
          aria-label="Open navigation"
          aria-expanded={menuOpen}
          aria-controls="site-mobile-menu"
        >
          <i className="bi bi-list" aria-hidden="true" />
        </button>
      </Row>

      <Offcanvas
        id="site-mobile-menu"
        className={`mh-mobile-menu${useNavyMobileMenu ? " mh-mobile-menu-bookings" : ""}`}
        placement="top"
        show={menuOpen}
        onHide={closeMenu}
        backdrop
        backdropClassName="mh-mobile-menu-backdrop"
        aria-labelledby="site-mobile-menu-title"
      >
        <Offcanvas.Header>
          <Offcanvas.Title id="site-mobile-menu-title">
            MOUNTAIN HUT
          </Offcanvas.Title>

          <button
            type="button"
            className="mh-menu-toggle"
            onClick={closeMenu}
            aria-label="Close navigation"
          >
            <i className="bi bi-x-lg" aria-hidden="true" />
          </button>
        </Offcanvas.Header>

        <Offcanvas.Body>
          <nav className="mh-mobile-navigation" aria-label="Main navigation">
            {navigation}

            {user?.role === "hiker" && (
              <Link
                to="/my-bookings"
                aria-current={isMyBookings ? "page" : undefined}
                onClick={closeMenu}
              >
                MY BOOKINGS
              </Link>
            )}
          </nav>

          <div className="mh-mobile-account">
            {user ? (
              <>
                <div className="mh-mobile-user d-flex align-items-center">
                  <i className="bi bi-person" aria-hidden="true" />

                  <div className="text-break">
                    <div className="fw-semibold">
                      {user.full_name?.trim() || "Your account"}
                    </div>
                    <div className="small opacity-75">Personal account</div>
                  </div>
                </div>

                <button
                  type="button"
                  className="mh-mobile-signout"
                  onClick={() => {
                    closeMenu();
                    return onSignOut();
                  }}
                >
                  <i className="bi bi-box-arrow-right" aria-hidden="true" />
                  Sign out
                </button>
              </>
            ) : (
              <div className="d-grid gap-2">
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  onClick={() => {
                    closeMenu();
                    onSignIn();
                  }}
                >
                  Sign in
                </button>

                {onSignUp && (
                  <button
                    type="button"
                    className="btn mh-mobile-signup"
                    onClick={() => {
                      closeMenu();
                      onSignUp();
                    }}
                  >
                    Sign up
                  </button>
                )}
              </div>
            )}
          </div>
        </Offcanvas.Body>
      </Offcanvas>
    </>
  );
}

export default SiteHeader;
