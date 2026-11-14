export default function ScheduleCopyActions() {
  return (
    <div
      className="cap-schedule-copy-actions"
      role="group"
      aria-label="Schedule copy management"
      aria-describedby="schedule-copy-actions-note"
    >
      {/* TODO(MH-09): Open a history modal from Schedule copies once the API
          returns saved copies and recurring schedules with their IDs.
          Put Undo copy and Stop repeating on the corresponding history rows.
          Undo copy should restore the previous schedule after confirmation
          and display any conflict returned by the API.
          Stop repeating should stop future copies and keep weeks already
          copied. Refresh the history and schedule after a successful action. */}
      <div className="d-flex flex-wrap gap-2">
        <button type="button" className="cap-outline" disabled>
          <i className="bi bi-clock-history" aria-hidden="true" />
          Schedule copies
        </button>

        <button type="button" className="cap-outline" disabled>
          Undo copy
        </button>

        <button type="button" className="cap-outline" disabled>
          Stop repeating
        </button>
      </div>

      <small id="schedule-copy-actions-note" className="text-secondary">
        Copy history, undo, and recurrence controls are coming soon.
      </small>
    </div>
  );
}
