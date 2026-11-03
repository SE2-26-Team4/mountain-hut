import { Col, Row } from 'react-bootstrap';
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

  return (
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
        <Link
          to="/"
          aria-current={isHome ? 'page' : undefined}
        >
          DINE
        </Link>

        <Link
          to="/menu"
          aria-current={pathname === '/menu' ? 'page' : undefined}
        >
          MENU
        </Link>

        <span>THE HUT</span>
      </Col>

      <Col className="mh-site-account d-flex align-items-center flex-wrap">
        {user ? (
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
        )}
      </Col>
    </Row>
  );
}

export default SiteHeader;