import SessionCard from '../auth/SessionCard.jsx';

/**
 * @typedef {import('../../API/session-api.js').SessionUser} SessionUser
 */

/**
 * Page title with the signed-in staff member and their role.
 *
 * @param {{ user: SessionUser, title: string, description: string }} props
 */
export default function StaffHeader({ user, title, description }) {
  return (
    <header className="staff-header">
      <div className="staff-header__session">
        <SessionCard user={user} />
      </div>

      <div className="staff-header__titles">
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
    </header>
  );
}
