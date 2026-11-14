import { Modal } from "react-bootstrap";

import CancellationMark from "../common/CancellationMark.jsx";

const actionContent = {
  undo: {
    title: "Undo schedule copy?",
    description:
      "This restores the schedule that was in place before the copy.",
    confirmLabel: "Undo copy",
  },
  stop: {
    title: "Stop repeating?",
    description:
      "Future copies will stop. Weeks already copied will remain in the schedule.",
    confirmLabel: "Stop repeating",
  },
};

/**
 * @param {{
 *   action: keyof typeof actionContent,
 *   scheduleName: string,
 *   destination: string,
 *   nextCopy?: string,
 *   onHide: () => void,
 * }} props
 */
export default function ScheduleCopyConfirmationModal({
  action,
  scheduleName,
  destination,
  nextCopy,
  onHide,
}) {
  const { title, description, confirmLabel } = actionContent[action];

  return (
    <Modal
      show
      centered
      onHide={onHide}
      aria-labelledby="schedule-copy-confirmation-title"
    >
      <Modal.Header
        closeButton
        className="position-relative justify-content-center"
      >
        <div className="text-center">
          <CancellationMark />
          <Modal.Title
            as="h2"
            id="schedule-copy-confirmation-title"
            className="mt-3"
          >
            {title}
          </Modal.Title>
        </div>
      </Modal.Header>

      <Modal.Body>
        <p className="fw-semibold mb-1">{scheduleName}</p>
        <p className="small text-secondary">{destination}</p>
        <p>{description}</p>

        {action === "stop" && nextCopy && (
          <p>The next copy ({nextCopy}) will not be created.</p>
        )}
        <p className="small text-secondary mb-0">
          Coming soon. This action is not available yet.
        </p>
      </Modal.Body>

      <Modal.Footer>
        <button type="button" className="cap-outline" onClick={onHide}>
          Cancel
        </button>

        {/* TODO(MH-09): Enable confirmation once the API accepts the ID
            of the selected copy or recurrence. */}
        <button type="button" className="cap-primary" disabled>
          {confirmLabel}
        </button>
      </Modal.Footer>
    </Modal>
  );
}
