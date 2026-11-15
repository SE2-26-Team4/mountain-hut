import { useState } from "react";
import { Alert, Col, Form, Modal, Row } from "react-bootstrap";

import {
  addCalendarDays,
  formatScheduleRange,
  isCalendarDate,
  previewScheduleCopies,
  startOfWeek,
  weeksOverlap,
} from "../../utils/weekly-schedule.js";
import ScheduleRepeatFields from "./ScheduleRepeatFields.jsx";
import ScheduleInfo from "./ScheduleInfo.jsx";

/**
 * @param {{
 *   date: string,
 *   saving: boolean,
 *   error: string,
 *   onHide: () => void,
 *   onCopy: (sourceWeekStart: string, destinationWeekStart: string) => Promise<void>,
 * }} props
 */
export default function CopyWeekModal({ date, saving, error, onHide, onCopy }) {
  const [source, setSource] = useState(() => startOfWeek(date));
  const [destination, setDestination] = useState(() =>
    addCalendarDays(startOfWeek(date), 7),
  );
  const [rule, setRule] = useState({
    repeat: "once",
    interval: "3",
    end: "never",
    endDate: "",
    copies: "",
    months: "",
  });

  const isOneWeek = rule.repeat === "once";
  const validSource = isCalendarDate(source);
  const validDestination = isCalendarDate(destination);
  const overlap =
    validSource && validDestination && weeksOverlap(source, destination);

  const preview = previewScheduleCopies(destination, rule);

  // TODO(MH-09): Connect recurring copies to the recurrence API.
  // Count the first destination week as copy 1. For date and calendar month
  // limits, include each whole week whose start falls within the period.
  //
  // Proposed behavior for finite repeats: check every destination week
  // before making changes. If any week has a confirmed booking, reject the
  // entire series and report the blocked week. Apply successful copies
  // in one transaction.
  //
  // Proposed behavior for Never: skip weeks with confirmed bookings, record
  // each skipped week and its reason in Schedule copies, and continue on
  // the next date in the original recurrence.
  //
  // Enable recurrence submission when the API supports these rules.
  const canCopy =
    isOneWeek && validSource && validDestination && !overlap && !saving;

  return (
    <Modal
      show
      centered
      scrollable
      dialogClassName="cap-schedule-dialog"
      onHide={saving ? undefined : onHide}
      backdrop={saving ? "static" : true}
      keyboard={!saving}
      aria-labelledby="copy-week-title"
    >
      <Form
        className="cap-schedule-modal-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (canCopy) void onCopy(source, destination);
        }}
      >
        <Modal.Header closeButton={!saving}>
          <Modal.Title id="copy-week-title">Copy weekly schedule</Modal.Title>
        </Modal.Header>

        <Modal.Body>
          <p className="text-secondary">
            Copy meal slots and table assignments to another week.
          </p>

          <fieldset disabled={saving}>
            <Row className="g-3">
              <Col xs={12} sm={6}>
                <Form.Group controlId="copy-week-source">
                  <div>
                    <Form.Label>Source week starts</Form.Label>
                    <ScheduleInfo label="About the source week">
                      Choose the first day of the seven-day schedule you want to
                      copy. The copy includes meal slots and their table
                      assignments.
                    </ScheduleInfo>
                  </div>
                  <Form.Control
                    type="date"
                    value={source}
                    onChange={(event) => setSource(event.target.value)}
                    required
                  />
                  {validSource && (
                    <Form.Text>
                      {formatScheduleRange(source, addCalendarDays(source, 6))}
                    </Form.Text>
                  )}
                </Form.Group>
              </Col>

              <Col xs={12} sm={6}>
                <Form.Group controlId="copy-week-destination">
                  <div>
                    <Form.Label>Destination week starts</Form.Label>
                    <ScheduleInfo label="About the destination week">
                      Choose where the first copy starts. For example, a week
                      starting on 16 November covers 16–22 November. The source
                      and destination must be at least seven days apart.
                    </ScheduleInfo>
                  </div>
                  <Form.Control
                    type="date"
                    value={destination}
                    onChange={(event) => setDestination(event.target.value)}
                    isInvalid={overlap}
                    aria-describedby={overlap ? "copy-week-overlap" : undefined}
                    required
                  />
                  <Form.Control.Feedback id="copy-week-overlap" type="invalid">
                    Choose weeks that are at least seven days apart.
                  </Form.Control.Feedback>
                </Form.Group>
              </Col>
            </Row>

            <ScheduleRepeatFields
              value={rule}
              destination={destination}
              onChange={setRule}
            />
          </fieldset>

          {error && <Alert variant="danger">{error}</Alert>}

          {preview && (
            <div className="bg-light rounded-3 p-3 mt-3" aria-live="polite">
              <div className="small text-secondary mb-1">
                {isOneWeek ? "Destination week" : "Upcoming destination weeks"}
              </div>

              {isOneWeek ? (
                <strong className="d-block">{preview.weeks[0]}</strong>
              ) : (
                <ul className="mb-0 ps-3">
                  {preview.weeks.map((week) => (
                    <li key={week}>{week}</li>
                  ))}
                </ul>
              )}

              {preview.total === Infinity && (
                <p className="small text-secondary mt-2 mb-0">
                  Repeats until stopped.
                </p>
              )}

              {Number.isFinite(preview.total) &&
                preview.total > preview.weeks.length && (
                  <p className="small text-secondary mt-2 mb-0">
                    Showing the first {preview.weeks.length} of {preview.total}{" "}
                    copies.
                  </p>
                )}
            </div>
          )}

          <Alert variant="warning" className="mt-3 mb-0">
            {isOneWeek
              ? "Copying replaces the destination week. A confirmed booking blocks the entire copy."
              : rule.end === "never"
                ? "Weeks with confirmed bookings are skipped. The recurrence continues on its regular schedule."
                : "If any destination week has a confirmed booking, the entire series is blocked."}

            <ScheduleInfo label="How confirmed bookings affect schedule copies">
              {isOneWeek
                ? "For example, if Saturday lunch has a confirmed booking, the entire destination week stays unchanged."
                : rule.end === "never"
                  ? "Schedule copies shows which week was skipped and why. For example, if you copy every two weeks and the week starting 30 November is blocked, the next copy still starts on 14 December."
                  : "Every destination week is checked before any changes are made. For example, if the third of four weeks has a confirmed booking, all four weeks stay unchanged."}
            </ScheduleInfo>
          </Alert>

          {!isOneWeek && (
            <p className="small text-secondary mt-3 mb-0">
              Coming soon. Repeating copies are not available yet.
            </p>
          )}
        </Modal.Body>

        <Modal.Footer>
          <button
            type="button"
            className="cap-outline"
            onClick={onHide}
            disabled={saving}
          >
            Cancel
          </button>

          <button type="submit" className="cap-primary" disabled={!canCopy}>
            {saving ? "Copying…" : isOneWeek ? "Copy week" : "Copy schedule"}
          </button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}
