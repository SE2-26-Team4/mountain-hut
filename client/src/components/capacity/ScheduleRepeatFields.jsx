import { Col, Form, Row } from "react-bootstrap";

import {
  MAX_REPEAT_MONTHS,
  MAX_REPEAT_WEEKS,
} from "../../utils/weekly-schedule.js";

/**
 * @param {{
 *   repeat: string,
 *   amount: string,
 *   unit: string,
 *   onRepeatChange: (value: string) => void,
 *   onAmountChange: (value: string) => void,
 *   onUnitChange: (value: string) => void,
 * }} props
 */
export default function ScheduleRepeatFields({
  repeat,
  amount,
  unit,
  onRepeatChange,
  onAmountChange,
  onUnitChange,
}) {
  const max = unit === "months" ? MAX_REPEAT_MONTHS : MAX_REPEAT_WEEKS;

  return (
    <>
      <Form.Group controlId="copy-week-repeat" className="mt-3">
        <Form.Label>Repeat</Form.Label>
        <Form.Select
          value={repeat}
          onChange={(event) => onRepeatChange(event.target.value)}
        >
          <option value="once">One week</option>
          <option value="custom">Custom</option>
          <option value="indefinitely">Indefinitely</option>
        </Form.Select>
      </Form.Group>

      {repeat === "custom" && (
        <>
          <Row className="g-2 mt-1">
            <Col xs={5}>
              <Form.Group controlId="copy-week-amount">
                <Form.Label>Duration</Form.Label>
                <Form.Control
                  type="number"
                  min={1}
                  max={max}
                  step={1}
                  value={amount}
                  onChange={(event) => onAmountChange(event.target.value)}
                  aria-describedby="copy-week-duration-help"
                  required
                />
              </Form.Group>
            </Col>

            <Col xs={7}>
              <Form.Group controlId="copy-week-unit">
                <Form.Label>Unit</Form.Label>
                <Form.Select
                  value={unit}
                  onChange={(event) => onUnitChange(event.target.value)}
                >
                  <option value="weeks">Weeks</option>
                  <option value="months">Months</option>
                </Form.Select>
              </Form.Group>
            </Col>
          </Row>

          <Form.Text id="copy-week-duration-help" className="d-block mt-2">
            You can preview up to {MAX_REPEAT_WEEKS} weeks or{" "}
            {MAX_REPEAT_MONTHS} calendar months.
          </Form.Text>
        </>
      )}
    </>
  );
}
