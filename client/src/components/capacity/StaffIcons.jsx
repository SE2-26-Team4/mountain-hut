// Outline icons drawn on a 24x24 grid with the current text colour.
const ICON_PATHS = {
  calendar: ['M4 6h16v14H4z', 'M4 10h16', 'M8 3v4', 'M16 3v4'],
  calendarCheck: ['M4 6h16v14H4z', 'M4 10h16', 'M8 3v4', 'M16 3v4', 'm9 15 2 2 4-4'],
  chevronLeft: ['m15 6-6 6 6 6'],
  chevronRight: ['m9 6 6 6-6 6'],
  clock: ['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z', 'M12 7v5l3 2'],
  close: ['M6 6l12 12', 'M18 6 6 18'],
  grid: ['M4 5h16v14H4z', 'M4 10h16', 'M10 10v9', 'M15 10v9'],
  home: ['m3 11 9-7 9 7', 'M6 10v10h12V10'],
  logout: ['M10 4H5v16h5', 'm15 8 4 4-4 4', 'M19 12H9'],
  minus: ['M5 12h14'],
  pencil: ['M4 20h4L19 9l-4-4L4 16z', 'm13 7 4 4'],
  plus: ['M12 5v14', 'M5 12h14'],
  search: ['M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14z', 'm20 20-4-4'],
  sliders: ['M4 7h9', 'M17 7h3', 'M4 17h3', 'M11 17h9', 'M15 5v4', 'M9 15v4'],
  utensils: ['M7 3v18', 'M4 3v5a3 3 0 0 0 6 0V3', 'M17 21V3c-2 1-3 4-3 8h3'],
};

/**
 * @typedef {keyof typeof ICON_PATHS} StaffIconName
 */

/**
 * Decorative icon; pair it with visible text or an aria-label on its control.
 *
 * @param {{ name: StaffIconName }} props
 */
export default function StaffIcon({ name }) {
  return (
    <svg
      className="staff-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {ICON_PATHS[name].map((path) => (
        <path key={path} d={path} />
      ))}
    </svg>
  );
}
