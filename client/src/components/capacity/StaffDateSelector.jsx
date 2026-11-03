import { useState } from 'react';

import StaffIcon from './StaffIcons.jsx';

/**
 * Formats a local date as YYYY-MM-DD for date inputs.
 *
 * @param {Date} date
 */
function toDateValue(date) {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${date.getFullYear()}-${month}-${day}`;
}

/**
 * @param {string} value - Date in YYYY-MM-DD format.
 * @param {number} days
 */
function addDays(value, days) {
  const [year, month, day] = value.split('-').map(Number);

  return toDateValue(new Date(year, month - 1, day + days));
}

/**
 * Date picker for the staff view. Meal slots are not date-specific yet,
 * so the selected date does not change the displayed configuration.
 */
export default function StaffDateSelector() {
  const [date, setDate] = useState(() => toDateValue(new Date()));

  return (
    <div className="staff-date">
      <label className="staff-date__field">
        <StaffIcon name="calendar" />
        <span>
          <span className="staff-date__label">Date</span>
          <input
            type="date"
            value={date}
            onChange={(event) => {
              if (event.target.value) {
                setDate(event.target.value);
              }
            }}
          />
        </span>
      </label>

      <button
        type="button"
        className="staff-button staff-button--round"
        aria-label="Previous day"
        onClick={() => setDate((current) => addDays(current, -1))}
      >
        <StaffIcon name="chevronLeft" />
      </button>

      <button
        type="button"
        className="staff-button staff-button--round"
        aria-label="Next day"
        onClick={() => setDate((current) => addDays(current, 1))}
      >
        <StaffIcon name="chevronRight" />
      </button>

      <p className="staff-date__note">Current configuration applies to all dates</p>
    </div>
  );
}
