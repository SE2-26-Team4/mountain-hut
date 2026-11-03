import MountainLogo from '../common/MountainLogo.jsx';
import StaffIcon from './StaffIcons.jsx';

/**
 * @typedef {import('./StaffIcons.jsx').StaffIconName} StaffIconName
 */

/** @type {{ id: string, label: string, icon: StaffIconName, available: boolean }[]} */
const SECTIONS = [
  { id: 'dashboard', label: 'Dashboard', icon: 'home', available: false },
  { id: 'reservations', label: 'Reservations', icon: 'calendarCheck', available: false },
  { id: 'capacity', label: 'Tables & Slots', icon: 'grid', available: true },
  { id: 'menu', label: 'Menu', icon: 'utensils', available: false },
  { id: 'settings', label: 'Settings', icon: 'sliders', available: false },
];

/**
 * Staff navigation; only the capacity section exists in this sprint.
 *
 * @param {{ onLogout: () => void }} props
 */
export default function StaffSidebar({ onLogout }) {
  return (
    <aside className="staff-sidebar">
      <div className="staff-sidebar__brand">
        <MountainLogo />
        <span>MOUNTAIN HUT</span>
      </div>

      <nav className="staff-nav" aria-label="Staff sections">
        <ul>
          {SECTIONS.map((section) => (
            <li key={section.id}>
              <span
                className={`staff-nav__item${section.available ? ' is-current' : ''}`}
                aria-current={section.available ? 'page' : undefined}
                title={section.available ? undefined : 'Available in a later release'}
              >
                <StaffIcon name={section.icon} />
                {section.label}
              </span>
            </li>
          ))}
        </ul>
      </nav>

      <button type="button" className="staff-sidebar__logout" onClick={onLogout}>
        <StaffIcon name="logout" />
        Log out
      </button>
    </aside>
  );
}
