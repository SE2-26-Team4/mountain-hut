import { useState } from 'react';

/**
 * @param {Date} date
 * @returns {string} Local calendar date in YYYY-MM-DD format.
 */
function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

export default function StaffDateSelector() {
  const [date, setDate] = useState(() => formatDate(new Date()));

  /** @param {number} days */
  function shiftDate(days) {
    const next = new Date(`${date}T12:00:00`);

    next.setDate(next.getDate() + days);

    setDate(formatDate(next));
  }

  return (
    <div className="cap-datebar d-flex align-items-center">
      <label className="cap-date-field d-flex align-items-center">
        <i
          className="bi bi-calendar3"
          aria-hidden="true"
        />

        <span className="d-flex flex-column">
          <small>Date</small>

          <input
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            aria-label="Reference date"
          />
        </span>
      </label>

      <button
        type="button"
        className="cap-circle-button"
        onClick={() => shiftDate(-1)}
        aria-label="Previous day"
      >
        <i
          className="bi bi-chevron-left"
          aria-hidden="true"
        />
      </button>

      <button
        type="button"
        className="cap-circle-button"
        onClick={() => shiftDate(1)}
        aria-label="Next day"
      >
        <i
          className="bi bi-chevron-right"
          aria-hidden="true"
        />
      </button>

      <span className="cap-date-note">
        Current configuration applies to all dates
      </span>
    </div>
  );
}