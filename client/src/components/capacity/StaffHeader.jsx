import ProfileMenu from '../common/ProfileMenu.jsx';

/**
 * @typedef {import('../../API/session-api.js').SessionUser} SessionUser
 */

/**
 * @param {Object} props
 * @param {SessionUser} props.user
 * @param {() => void | Promise<void>} props.onLogout
 */
export default function StaffHeader({ user, onLogout }) {
  return (
    <header className="cap-topbar d-flex justify-content-end align-items-center">
      <ProfileMenu
        user={user}
        onSignOut={onLogout}
      />
    </header>
  );
}