import { useState } from "react";
import { Modal } from "react-bootstrap";

import ScheduleCopyConfirmationModal from "./ScheduleCopyConfirmationModal.jsx";

/** @typedef {"undo" | "stop"} ScheduleCopyAction */

/**
 * @typedef {{
 *   id: string,
 *   title: string,
 *   source: string,
 *   destination: string,
 *   action: ScheduleCopyAction,
 *   nextCopy?: string,
 * }} ScheduleCopyEntry
 */

/** @type {ScheduleCopyEntry[]} */
const exampleEntries = [
  {
    id: "example-copy",
    title: "One-time copy",
    source: "2–8 Nov 2026",
    destination: "9–15 Nov 2026",
    action: "undo",
  },
  {
    id: "example-a",
    title: "Schedule A",
    source: "9–15 Nov 2026",
    destination: "Every 2 weeks from 16 Nov 2026",
    action: "stop",
    nextCopy: "14–20 Dec 2026",
  },
  {
    id: "example-b",
    title: "Schedule B",
    source: "2–8 Nov 2026",
    destination: "Every 2 weeks from 23 Nov 2026",
    action: "stop",
    nextCopy: "21–27 Dec 2026",
  },
];

/** @param {{ onHide: () => void, onAddSchedule: () => void }} props */
export default function ScheduleCopyHistoryModal({ onHide, onAddSchedule }) {
  const [selected, setSelected] = useState(
    /** @type {ScheduleCopyEntry | null} */ (null),
  );

  if (selected) {
    return (
      <ScheduleCopyConfirmationModal
        action={selected.action}
        scheduleName={selected.title}
        destination={selected.destination}
        nextCopy={selected.nextCopy}
        onHide={() => setSelected(null)}
      />
    );
  }

  return (
    <Modal
      show
      centered
      scrollable
      fullscreen="sm-down"
      onHide={onHide}
      aria-labelledby="schedule-copy-history-title"
    >
      <Modal.Header closeButton>
        <Modal.Title as="h2" id="schedule-copy-history-title">
          Schedule copies
        </Modal.Title>
      </Modal.Header>

      <Modal.Body>
        {/* TODO(MH-09): Replace exampleEntries with history from the API.
            Use server IDs for actions and show loading, error, and empty
            states. Use the next pending copy date returned by the server. */}
        <p className="text-secondary">
          Preview with sample data. Copy history is coming soon.
        </p>

        <ul className="list-group">
          {exampleEntries.map((entry) => (
            <li
              key={entry.id}
              className="list-group-item d-flex flex-wrap align-items-start justify-content-between gap-3 p-3"
            >
              <div>
                <strong>{entry.title}</strong>
                <div>{entry.destination}</div>
                <div className="small text-secondary">
                  Source week: {entry.source}
                </div>
                {entry.nextCopy && (
                  <div className="small text-secondary">
                    Next copy: {entry.nextCopy}
                  </div>
                )}
              </div>

              <button
                type="button"
                className="cap-outline"
                aria-haspopup="dialog"
                onClick={() => setSelected(entry)}
              >
                {entry.action === "undo" ? "Undo copy" : "Stop repeating"}
              </button>
            </li>
          ))}
        </ul>
      </Modal.Body>

      <Modal.Footer>
        <button type="button" className="cap-outline" onClick={onHide}>
          Close
        </button>

        <button
          type="button"
          className="cap-primary"
          aria-haspopup="dialog"
          onClick={onAddSchedule}
        >
          <i className="bi bi-plus-lg" aria-hidden="true" />
          Add schedule
        </button>
      </Modal.Footer>
    </Modal>
  );
}
