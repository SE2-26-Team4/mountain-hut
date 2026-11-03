/**
 * @typedef {import('../../API/session-api.js').SessionUser} SessionUser
 */

/** @type {Record<SessionUser['role'], string>} */
const ROLE_LABELS = {
  hiker: 'Hiker',
  employee: 'Employee',
  warden: 'Warden',
};

/**
 * @param {string} fullName
 */
function getInitials(fullName) {
  return fullName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join('');
}

/**
 * Shows who is signed in and with which role.
 *
 * @param {Object} props
 * @param {SessionUser} props.user
 */
function SessionCard({ user }) {
  return (
    <div className="mh-session-card">
      <span className="mh-session-card-avatar" aria-hidden="true">
        {getInitials(user.full_name)}
      </span>

      <span className="mh-session-card-details">
        <span className="visually-hidden">Signed in as </span>
        <strong>{user.full_name}</strong>
        <span className="visually-hidden">, role </span>
        <small>{ROLE_LABELS[user.role] ?? user.role}</small>
      </span>
    </div>
  );
}

export default SessionCard;
