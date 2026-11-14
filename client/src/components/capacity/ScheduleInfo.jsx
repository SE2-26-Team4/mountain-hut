import { useId } from "react";
import { OverlayTrigger, Popover } from "react-bootstrap";

/**
 * @param {{
 *   label: string,
 *   children: import("react").ReactNode,
 * }} props
 */
export default function ScheduleInfo({ label, children }) {
  const id = useId();

  return (
    <OverlayTrigger
      trigger="click"
      placement="auto"
      rootClose
      overlay={
        <Popover id={id} className="cap-schedule-info-popover">
          <Popover.Body>{children}</Popover.Body>
        </Popover>
      }
    >
      <button
        type="button"
        onMouseDown={(event) => event.preventDefault()}
        className="btn btn-link p-0 ms-2 align-baseline text-body-secondary"
        aria-label={label}
      >
        <i className="bi bi-info-circle" aria-hidden="true" />
      </button>
    </OverlayTrigger>
  );
}
