import { useState } from "react";
import { Alert, Col, Form, Modal, Row } from "react-bootstrap";

import {
  addCalendarDays,
  addCalendarMonths,
  formatScheduleDate,
  formatScheduleRange,
  isCalendarDate,
  MAX_REPEAT_MONTHS,
  MAX_REPEAT_WEEKS,
  startOfWeek,
  weeksOverlap,
} from "../../utils/weekly-schedule.js";
import ScheduleRepeatFields from "./ScheduleRepeatFields.jsx";

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
  const [repeat, setRepeat] = useState("once");
  const [amount, setAmount] = useState("4");
  const [unit, setUnit] = useState("weeks");

  const validSource = isCalendarDate(source);
  const validDestination = isCalendarDate(destination);
  const overlap =
    validSource && validDestination && weeksOverlap(source, destination);

  const count = Number(amount);
  const max = unit === "months" ? MAX_REPEAT_MONTHS : MAX_REPEAT_WEEKS;
  const validCount = Number.isInteger(count) && count >= 1 && count <= max;

  let preview = "";

  if (validDestination) {
    if (repeat === "indefinitely") {
      preview = `Every week from ${formatScheduleDate(destination)}`;
    } else if (repeat === "once") {
      preview = formatScheduleRange(
        destination,
        addCalendarDays(destination, 6),
      );
    } else if (validCount) {
      const end =
        unit === "months"
          ? addCalendarDays(addCalendarMonths(destination, count), -1)
          : addCalendarDays(destination, count * 7 - 1);

      preview = formatScheduleRange(destination, end);
    }
  }

  // TODO(MH-09): Connect Custom and Indefinitely to the recurrence API.
  // Custom must send the duration and unit (weeks or calendar months).
  // Indefinitely must create a recurrence starting on the destination date.
  // Enable submission for each option once its API is available.
  const canCopy =
    repeat === "once" && validSource && validDestination && !overlap && !saving;

  return (
    <Modal
      show
      centered
      scrollable
      onHide={saving ? undefined : onHide}
      backdrop={saving ? "static" : true}
      keyboard={!saving}
      aria-labelledby="copy-week-title"
    >
      <Form
        className="d-flex flex-column overflow-hidden"
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

          {error && <Alert variant="danger">{error}</Alert>}

          <fieldset disabled={saving}>
            <Row className="g-3">
              <Col xs={12} sm={6}>
                <Form.Group controlId="copy-week-source">
                  <Form.Label>Source week starts</Form.Label>
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
                  <Form.Label>Destination week starts</Form.Label>
                  <Form.Control
                    type="date"
                    value={destination}
                    onChange={(event) => setDestination(event.target.value)}
                    isInvalid={overlap}
                    required
                  />
                  <Form.Control.Feedback type="invalid">
                    Choose weeks that are at least seven days apart.
                  </Form.Control.Feedback>
                </Form.Group>
              </Col>
            </Row>

            <ScheduleRepeatFields
              repeat={repeat}
              amount={amount}
              unit={unit}
              onRepeatChange={setRepeat}
              onAmountChange={setAmount}
              onUnitChange={setUnit}
            />
          </fieldset>

          {preview && (
            <div className="bg-light rounded-3 p-3 mt-3" aria-live="polite">
              <div className="small text-secondary">Preview</div>
              <strong>{preview}</strong>
            </div>
          )}

          <Alert variant="warning" className="mt-3 mb-0">
            This replaces the destination schedule. Weeks with confirmed
            bookings cannot be replaced.
          </Alert>

          {repeat !== "once" && (
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
            {saving
              ? "Copying…"
              : repeat === "once"
                ? "Copy week"
                : "Copy schedule"}
          </button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}
