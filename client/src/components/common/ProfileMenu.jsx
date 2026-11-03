import { Dropdown } from 'react-bootstrap';
import { Link } from 'react-router-dom';

/**
 * @typedef {import('../../API/session-api.js').SessionUser} SessionUser
 */

/**
 * @param {Object} props
 * @param {SessionUser} props.user
 * @param {() => void | Promise<void>} props.onSignOut
 */
export default function ProfileMenu({ user, onSignOut }) {
  const name = user.full_name?.trim() || 'Your account';
  const isStaff =
    user.role === 'employee' || user.role === 'warden';

  const roleLabel =
    user.role === 'warden'
      ? 'Warden'
      : isStaff
        ? 'Staff'
        : 'Personal account';

  return (
    <Dropdown align="end" className="mh-profile">
      <Dropdown.Toggle
        variant="link"
        className="mh-profile-toggle d-flex align-items-center text-decoration-none"
        aria-label={`Account menu: ${name}`}
      >
        <span className="mh-profile-avatar d-flex align-items-center justify-content-center">
          <i className="bi bi-person" aria-hidden="true" />
        </span>

        <span className="mh-profile-details">
          <strong>{name}</strong>
          <small>{roleLabel}</small>
        </span>

        <i
          className="bi bi-chevron-down mh-profile-chevron"
          aria-hidden="true"
        />
      </Dropdown.Toggle>

      <Dropdown.Menu className="mh-profile-menu">
        <Dropdown.Header className="mh-profile-menu-heading d-flex flex-column">
          <span>{name}</span>
          <small>{user.email}</small>
        </Dropdown.Header>

        <Dropdown.Divider />

        {isStaff ? (
          <Dropdown.Item
            as={Link}
            to="/staff/capacity"
            className="d-flex align-items-center"
          >
            <i className="bi bi-grid" aria-hidden="true" />

            Staff area
          </Dropdown.Item>
        ) : (
          <Dropdown.Item
            as={Link}
            to="/my-bookings"
            className="d-flex align-items-center"
          >
            <i
              className="bi bi-calendar-check"
              aria-hidden="true"
            />

            My bookings
          </Dropdown.Item>
        )}

        <Dropdown.Divider />

        <Dropdown.Item
          as="button"
          type="button"
          onClick={onSignOut}
          className="mh-profile-signout d-flex align-items-center"
        >
          <i
            className="bi bi-box-arrow-right"
            aria-hidden="true"
          />

          Sign out
        </Dropdown.Item>
      </Dropdown.Menu>
    </Dropdown>
  );
}