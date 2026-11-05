/**
 * @param {Date} date
 * @returns {string}
 */
function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

/**
 * @param {Object} props
 * @param {string} props.date
 * @param {(value: string) => void} props.onChange
 * @param {boolean} props.disabled
 */
export default function StaffDateSelector({
  date,
  onChange,
  disabled,
}) {
  /** @param {number} days */
  function shiftDate(days) {
    if (!date) return;

    const next = new Date(`${date}T12:00:00`);
    next.setDate(next.getDate() + days);

    onChange(formatDate(next));
  }

  return (
    <div className="cap-datebar d-flex align-items-center">
      <label className="cap-date-field d-flex align-items-center">
        <i className="bi bi-calendar3" aria-hidden="true" />

        <span className="d-flex flex-column">
          <small>Date</small>

          <input
            type="date"
            value={date}
            disabled={disabled}
            onChange={(event) => onChange(event.target.value)}
            aria-label="Configuration date"
            required
          />
        </span>
      </label>

      <button
        type="button"
        className="cap-circle-button"
        disabled={disabled}
        onClick={() => shiftDate(-1)}
        aria-label="Previous day"
      >
        <i className="bi bi-chevron-left" aria-hidden="true" />
      </button>

      <button
        type="button"
        className="cap-circle-button"
        disabled={disabled}
        onClick={() => shiftDate(1)}
        aria-label="Next day"
      >
        <i className="bi bi-chevron-right" aria-hidden="true" />
      </button>

      <span className="cap-date-note">
        Showing slots for the selected date
      </span>
    </div>
  );
}