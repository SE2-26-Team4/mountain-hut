import { useEffect, useState } from 'react';
import { Col, Offcanvas, Row } from 'react-bootstrap';
import { Link, useLocation } from 'react-router-dom';

import MountainLogo from '../common/MountainLogo.jsx';
import ProfileMenu from '../common/ProfileMenu.jsx';

/**
 * @typedef {import('../../API/session-api.js').SessionUser} SessionUser
 */

/**
 * @param {Object} props
 * @param {SessionUser | null} props.user
 * @param {() => void} props.onSignIn
 * @param {() => void | Promise<void>} props.onSignOut
 */
function SiteHeader({ user, onSignIn, onSignOut }) {
  const { pathname } = useLocation();
  const isHome = pathname === '/';
  const [menuOpen, setMenuOpen] = useState(false);

  const closeMenu = () => setMenuOpen(false);

  useEffect(() => {
    const desktop = window.matchMedia('(min-width: 768px)');

    const handleResize = () => {
      if (desktop.matches) setMenuOpen(false);
    };

    desktop.addEventListener('change', handleResize);

    return () => {
      desktop.removeEventListener('change', handleResize);
    };
  }, []);

  const navigation = (
    <>
      <Link
        to="/"
        aria-current={isHome ? 'page' : undefined}
        onClick={closeMenu}
      >
        DINE
      </Link>

      <Link
        to="/menu"
        aria-current={pathname === '/menu' ? 'page' : undefined}
        onClick={closeMenu}
      >
        MENU
      </Link>

      <span aria-disabled="true">THE HUT</span>
    </>
  );

  const account = user ? (
    <ProfileMenu
      user={user}
      onSignOut={onSignOut}
    />
  ) : (
    <button
      className="mh-site-account-button"
      type="button"
      onClick={onSignIn}
    >
      Sign in
    </button>
  );

  return (
    <>
      <Row
        as="header"
        className={`g-0 align-items-center mh-site-header ${
          isHome
            ? 'mh-site-header-hero'
            : 'mh-site-header-light'
        }`}
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
        className="mh-mobile-menu"
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
          <nav
            className="mh-mobile-navigation"
            aria-label="Main navigation"
          >
            {navigation}
          </nav>

          <div className="mh-mobile-account">
            {user ? (
              <ProfileMenu
                user={user}
                dropUp
                onSignOut={() => {
                  closeMenu();
                  return onSignOut();
                }}
              />
            ) : (
              <button
                type="button"
                className="mh-primary-button"
                onClick={() => {
                  closeMenu();
                  onSignIn();
                }}
              >
                Sign in
              </button>
            )}
          </div>
        </Offcanvas.Body>
      </Offcanvas>
    </>
  );
}

export default SiteHeader;