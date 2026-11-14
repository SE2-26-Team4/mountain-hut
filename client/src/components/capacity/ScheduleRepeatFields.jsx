import { Form } from "react-bootstrap";

import { MAX_REPEAT_MONTHS } from "../../utils/weekly-schedule.js";
import ScheduleInfo from "./ScheduleInfo.jsx";

/**
 * @typedef {{
 *   repeat: string,
 *   interval: string,
 *   end: string,
 *   endDate: string,
 *   copies: string,
 *   months: string,
 * }} ScheduleRepeat
 */

/**
 * @param {{
 *   value: ScheduleRepeat,
 *   destination: string,
 *   onChange: (value: ScheduleRepeat) => void,
 * }} props
 */
export default function ScheduleRepeatFields({ value, destination, onChange }) {
  return (
    <>
      <Form.Group controlId="copy-week-repeat" className="mt-3">
        <div>
          <Form.Label>Repeat</Form.Label>
          <ScheduleInfo label="How repeat frequency works">
            One week makes a single copy. Every 2 weeks leaves one week between
            copies. Choose Custom to set your own weekly interval.
          </ScheduleInfo>
        </div>
        <Form.Select
          value={value.repeat}
          onChange={(event) =>
            onChange({ ...value, repeat: event.target.value })
          }
        >
          <option value="once">One week</option>
          <option value="weekly">Every week</option>
          <option value="biweekly">Every 2 weeks</option>
          <option value="custom">Custom</option>
        </Form.Select>
      </Form.Group>

      {value.repeat === "custom" && (
        <Form.Group controlId="copy-week-interval" className="mt-3">
          <div>
            <Form.Label>Repeat every (weeks)</Form.Label>
            <ScheduleInfo label="About the custom repeat interval">
              Enter the number of weeks between copies. For example, every 3
              weeks starting on 16 November gives copies starting on 16 November
              and 7 December.
            </ScheduleInfo>
          </div>
          <Form.Control
            type="number"
            min={1}
            step={1}
            required
            value={value.interval}
            onChange={(event) =>
              onChange({ ...value, interval: event.target.value })
            }
          />
        </Form.Group>
      )}

      {value.repeat !== "once" && (
        <Form.Group controlId="copy-week-end" className="mt-3">
          <div>
            <Form.Label>Ends</Form.Label>
            <ScheduleInfo label="How to end a recurrence">
              Choose an end date, a number of copies, or a duration in calendar
              months. Choose Never to continue until you select Stop repeating
              in Schedule copies.
            </ScheduleInfo>
          </div>
          <Form.Select
            value={value.end}
            onChange={(event) =>
              onChange({ ...value, end: event.target.value })
            }
          >
            <option value="never">Never</option>
            <option value="date">On a date</option>
            <option value="copies">After a number of copies</option>
            <option value="months">After a number of months</option>
          </Form.Select>
        </Form.Group>
      )}

      {value.repeat !== "once" && value.end === "date" && (
        <Form.Group controlId="copy-week-end-date" className="mt-3">
          <div>
            <Form.Label>End date</Form.Label>
            <ScheduleInfo label="How the end date is calculated">
              A whole week is included if it starts on or before this date. For
              example, an end date of 30 November includes the week starting on
              30 November.
            </ScheduleInfo>
          </div>
          <Form.Control
            type="date"
            min={destination || undefined}
            required
            value={value.endDate}
            onChange={(event) =>
              onChange({ ...value, endDate: event.target.value })
            }
          />
        </Form.Group>
      )}

      {value.repeat !== "once" && value.end === "copies" && (
        <Form.Group controlId="copy-week-count" className="mt-3">
          <div>
            <Form.Label>Number of copies</Form.Label>
            <ScheduleInfo label="How copies are counted">
              The first destination counts as copy 1. Every 2 weeks from 16
              November, ending after 2 copies, includes the weeks starting on 16
              and 30 November.
            </ScheduleInfo>
          </div>
          <Form.Control
            type="number"
            min={1}
            step={1}
            required
            value={value.copies}
            onChange={(event) =>
              onChange({ ...value, copies: event.target.value })
            }
          />
          <Form.Text>The first destination week counts as one copy.</Form.Text>
        </Form.Group>
      )}

      {value.repeat !== "once" && value.end === "months" && (
        <Form.Group controlId="copy-week-months" className="mt-3">
          <div>
            <Form.Label>Calendar months</Form.Label>
            <ScheduleInfo label="How calendar months are counted">
              Months are counted from the first destination date. For example, 2
              months from 16 November includes copy start dates through 15
              January. Each copy covers a whole week.
            </ScheduleInfo>
          </div>
          <Form.Control
            type="number"
            min={1}
            max={MAX_REPEAT_MONTHS}
            step={1}
            required
            value={value.months}
            onChange={(event) =>
              onChange({ ...value, months: event.target.value })
            }
          />
          <Form.Text>
            Preview up to {MAX_REPEAT_MONTHS} calendar months.
          </Form.Text>
        </Form.Group>
      )}
    </>
  );
}
