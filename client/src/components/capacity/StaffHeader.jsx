/**
 * @typedef {{ full_name: string, role: string }} StaffUser
 */

/** @type {Record<string, string>} */
const ROLE_LABELS = {
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
 * Page title with the signed-in staff member and their role.
 *
 * @param {{ user: StaffUser, title: string, description: string }} props
 */
export default function StaffHeader({ user, title, description }) {
  return (
    <header className="staff-header">
      <div className="staff-header__user">
        <span className="staff-header__avatar" aria-hidden="true">
          {getInitials(user.full_name)}
        </span>
        <span>
          <span className="staff-header__name">{user.full_name}</span>
          <span className="staff-header__role">{ROLE_LABELS[user.role] ?? user.role}</span>
        </span>
      </div>

      <div className="staff-header__titles">
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
    </header>
  );
}
