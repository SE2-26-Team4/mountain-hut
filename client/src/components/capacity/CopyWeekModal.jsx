import { useState } from "react";
import { Alert, Form, Modal } from "react-bootstrap";

import {
  addCalendarDays,
  addCalendarMonths,
  formatScheduleRange,
  isCalendarDate,
  startOfWeek,
  weekBandEdges,
} from "../../utils/weekly-schedule.js";
import useScheduleCopyPreview from "../../hooks/useScheduleCopyPreview.js";

const DAY_MS = 86_400_000;
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const monthFormatter = new Intl.DateTimeFormat("en-GB", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

const weekdayFormatter = new Intl.DateTimeFormat("en-GB", {
  weekday: "long",
  timeZone: "UTC",
});

/** @param {string} date */
function firstOfMonth(date) {
  return `${date.slice(0, 7)}-01`;
}

/** @param {string} from @param {string} to */
function daysBetween(from, to) {
  return (Date.parse(to) - Date.parse(from)) / DAY_MS;
}

/** @param {string} month */
function getMonthDays(month) {
  const firstCell = startOfWeek(month);
  const nextMonth = addCalendarMonths(month, 1);
  const rows = Math.ceil(daysBetween(firstCell, nextMonth) / 7);

  return Array.from({ length: rows * 7 }, (_, index) =>
    addCalendarDays(firstCell, index),
  );
}

// [REQUIREMENT] MH-09: Staff can copy a source week's schedule to one or more destination weeks.
/**
 * @param {{
 *   date: string,
 *   hasSlotsInWeek: (start: string) => boolean,
 *   saving: boolean,
 *   error: string,
 *   onHide: () => void,
 *   onClearError: () => void,
 *   onCopy: (source: string, destination: string) => Promise<"refresh-preview" | void>,
 *   onCopyWeeks?: (
 *     source: string,
 *     destinations: string[],
 *     excludedWeeks: string[],
 *     previewBookedWeeks: string[]
 *   ) => Promise<"refresh-preview" | void>,
 * }} props
 */
export default function CopyWeekModal({
  date,
  saving,
  error,
  onHide,
  onClearError,
  onCopy,
  onCopyWeeks,
  hasSlotsInWeek,
}) {
  const [source, setSource] = useState("");
  const [destination, setDestination] = useState("");
  const [repeat, setRepeat] = useState(false);
  const [endMode, setEndMode] = useState("date");
  const [endDate, setEndDate] = useState("");
  const [copyCount, setCopyCount] = useState("2");

  const [visibleMonth, setVisibleMonth] = useState(() =>
    firstOfMonth(isCalendarDate(date) ? date : new Date().toISOString()),
  );

  const [viewChoice, setViewChoice] = useState(
    /** @type {"month" | "year" | null} */ (null),
  );

  const [excluded, setExcluded] = useState(
    /** @type {Set<string>} */ (new Set()),
  );

  const validSource = isCalendarDate(source);
  const sourceWeekIsEmpty = validSource && !hasSlotsInWeek(source);
  const validDestination = isCalendarDate(destination);
  const monthDays = getMonthDays(visibleMonth);

  let totalWeeks = 0;

  if (validDestination) {
    if (!repeat) {
      totalWeeks = 1;
    } else if (endMode === "count") {
      const count = Number(copyCount);
      if (Number.isSafeInteger(count) && count > 0) totalWeeks = count;
    } else if (isCalendarDate(endDate) && endDate >= destination) {
      totalWeeks = Math.floor(daysBetween(destination, endDate) / 7) + 1;
    }
  }

  if (
    totalWeeks > 0 &&
    totalWeeks * 7 - 1 > daysBetween(destination, "9999-12-31")
  ) {
    totalWeeks = 0;
  }

  const lastDay =
    totalWeeks > 0 ? addCalendarDays(destination, totalWeeks * 7 - 1) : "";

  const preview = useScheduleCopyPreview(destination, lastDay);

  // [REQUIREMENT] MH-09: A destination week with a confirmed booking cannot be overwritten.
  const bookingsByWeek = new Map(
    /** @type {[string, NonNullable<typeof preview.data>["bookings"]][]} */ ([]),
  );

  for (const booking of preview.data?.bookings ?? []) {
    const start = weekForDay(booking.slotDate);
    if (!start) continue;

    const bookings = bookingsByWeek.get(start) ?? [];
    bookings.push(booking);
    bookingsByWeek.set(start, bookings);
  }

  const excludedWeeks = repeat
    ? [...excluded].filter(
        (start) =>
          start >= destination &&
          start <= lastDay &&
          !bookingsByWeek.has(start),
      )
    : [];

  const excludedCount = excludedWeeks.length;
  const bookedCount = bookingsByWeek.size;
  const selectedCount = totalWeeks - excludedCount - bookedCount;

  const replacedDates = (preview.data?.scheduledDates ?? []).filter((day) => {
    const start = weekForDay(day);
    return (
      start && !bookingsByWeek.has(start) && !(repeat && excluded.has(start))
    );
  });

  const view = viewChoice ?? (totalWeeks > 6 ? "year" : "month");

  /** @param {string} day */
  function weekForDay(day) {
    if (!lastDay || day < destination || day > lastDay) return null;

    // Each block starts on the weekday chosen for the first destination.
    const offset = daysBetween(destination, day) % 7;
    return addCalendarDays(day, -offset);
  }

  const overlapsSource =
    validSource &&
    totalWeeks > 0 &&
    Array.from({ length: 7 }, (_, i) => addCalendarDays(source, i)).some(
      (day) => {
        const start = weekForDay(day);
        return (
          start !== null &&
          !bookingsByWeek.has(start) &&
          (!repeat || !excluded.has(start))
        );
      },
    );

  const canSave =
    validSource &&
    !sourceWeekIsEmpty &&
    Boolean(preview.data) &&
    selectedCount > 0 &&
    !overlapsSource &&
    !saving &&
    (!repeat || Boolean(onCopyWeeks));

  /** @param {string} value */
  function changeDestination(value) {
    setDestination(value);
    setExcluded(new Set());

    if (isCalendarDate(value)) {
      setVisibleMonth(firstOfMonth(value));
    }
  }

  /** @param {string} start */
  function toggleWeek(start) {
    onClearError();
    setExcluded((previous) => {
      const next = new Set(previous);
      if (next.has(start)) next.delete(start);
      else next.add(start);
      return next;
    });
  }

  /** @param {import("react").FormEvent} event */
  async function submit(event) {
    event.preventDefault();
    if (!canSave) return;

    if (!repeat) {
      const result = await onCopy(source, destination);
      if (result === "refresh-preview") preview.refresh();
      return;
    }

    if (onCopyWeeks) {
      const destinations = Array.from({ length: totalWeeks }, (_, index) =>
        addCalendarDays(destination, index * 7),
      );

      const result = await onCopyWeeks(source, destinations, excludedWeeks, [
        ...bookingsByWeek.keys(),
      ]);

      if (result === "refresh-preview") preview.refresh();
    }
  }

  let calendarHelp = "Choose the first destination week to preview it here.";

  if (validDestination) {
    if (!repeat) {
      calendarHelp = formatScheduleRange(
        destination,
        addCalendarDays(destination, 6),
      );
    } else if (totalWeeks === 0) {
      calendarHelp =
        endMode === "date"
          ? "Choose an end date to preview the destination weeks."
          : "Enter the number of copies to preview the destination weeks.";
    } else {
      const weekday = weekdayFormatter.format(new Date(destination));
      calendarHelp = `Each copy starts on ${weekday}. Uncheck a week to skip all seven days.`;
    }
  }

  /** @param {string} day @param {number} index */
  function renderDay(day, index) {
    const number = Number(day.slice(-2));
    const start = weekForDay(day);
    const classes = ["copy-calendar__day"];

    if (!start) {
      if (firstOfMonth(day) !== visibleMonth) {
        classes.push("copy-calendar__day--outside");
      }

      return (
        <span key={day} className={classes.join(" ")}>
          {number}
        </span>
      );
    }

    const end = addCalendarDays(start, 6);
    const range = formatScheduleRange(start, end);
    classes.push(weekBandEdges(day, start, index % 7));
    if (bookingsByWeek.has(start)) {
      const showLock = day === start || index === 0;

      return (
        <span
          key={day}
          className={`${classes.join(" ")} copy-calendar__day--booked`}
          title={`${range} · Confirmed booking`}
          aria-label={`${day}, week blocked by a confirmed booking`}
        >
          {showLock && <i className="bi bi-lock-fill" aria-hidden="true" />}
          {number}
        </span>
      );
    }
    const included = !repeat || !excluded.has(start);

    classes.push(
      included
        ? "copy-calendar__day--included"
        : "copy-calendar__day--excluded",
    );

    if (day === start || index % 7 === 0) {
      classes.push("copy-calendar__day--left");
    }

    if (day === end || index % 7 === 6) {
      classes.push("copy-calendar__day--right");
    }

    if (!repeat) {
      return (
        <span key={day} className={classes.join(" ")} title={range}>
          {number}
        </span>
      );
    }

    // A week crossing into the visible grid can also be toggled here.
    const showCheck = day === start || index === 0;

    return (
      <button
        key={day}
        type="button"
        className={classes.join(" ")}
        title={range}
        aria-label={`${range}, ${included ? "included" : "excluded"}`}
        aria-pressed={included}
        tabIndex={showCheck ? 0 : -1}
        onClick={() => toggleWeek(start)}
      >
        {showCheck && (
          <span className="copy-calendar__check" aria-hidden="true">
            {included ? "✓" : ""}
          </span>
        )}
        {number}
      </button>
    );
  }

  return (
    <Modal
      show
      centered
      scrollable
      size="lg"
      dialogClassName="cap-schedule-dialog copy-calendar"
      aria-labelledby="copy-week-title"
      onHide={saving ? undefined : onHide}
      backdrop={saving ? "static" : true}
      keyboard={!saving}
    >
      <Form
        className="cap-schedule-modal-form"
        onSubmit={submit}
        onChange={onClearError}
      >
        <Modal.Header closeButton={!saving}>
          <Modal.Title id="copy-week-title">Copy weekly schedule</Modal.Title>
        </Modal.Header>

        <Modal.Body>
          <fieldset disabled={saving} className="copy-calendar__fieldset">
            <div className="copy-calendar__layout">
              <div className="copy-calendar__settings">
                <Form.Group controlId="copy-source">
                  <Form.Label>Source week starts</Form.Label>
                  <Form.Control
                    type="date"
                    required
                    value={source}
                    isInvalid={sourceWeekIsEmpty}
                    aria-invalid={sourceWeekIsEmpty || undefined}
                    aria-describedby={
                      validSource ? "copy-source-feedback" : undefined
                    }
                    onChange={(event) => setSource(event.target.value)}
                  />
                  {validSource && (
                    <Form.Text
                      id="copy-source-feedback"
                      className={
                        sourceWeekIsEmpty ? "d-block text-danger" : "d-block"
                      }
                      aria-live="polite"
                    >
                      {sourceWeekIsEmpty
                        ? "This week has no meal slots to copy. Choose another source week."
                        : formatScheduleRange(
                            source,
                            addCalendarDays(source, 6),
                          )}
                    </Form.Text>
                  )}
                </Form.Group>

                <Form.Group controlId="copy-destination">
                  <Form.Label>First destination week</Form.Label>
                  <Form.Control
                    type="date"
                    required
                    value={destination}
                    onChange={(event) => changeDestination(event.target.value)}
                  />
                </Form.Group>

                <Form.Check
                  id="copy-repeat-weekly"
                  label="Repeat every week"
                  checked={repeat}
                  onChange={(event) => setRepeat(event.target.checked)}
                />

                {repeat && (
                  <>
                    <fieldset className="copy-calendar__end-options">
                      <legend>Ends</legend>

                      <Form.Check
                        id="copy-end-date-option"
                        type="radio"
                        name="copy-end-mode"
                        label="On a date"
                        checked={endMode === "date"}
                        onChange={() => setEndMode("date")}
                      />

                      <Form.Check
                        id="copy-end-count-option"
                        type="radio"
                        name="copy-end-mode"
                        label="After a number of copies"
                        checked={endMode === "count"}
                        onChange={() => setEndMode("count")}
                      />
                    </fieldset>

                    {endMode === "date" ? (
                      <Form.Group controlId="copy-end-date">
                        <Form.Label>End date</Form.Label>
                        <Form.Control
                          type="date"
                          required
                          min={destination || undefined}
                          value={endDate}
                          onChange={(event) => setEndDate(event.target.value)}
                        />
                        <Form.Text>
                          Includes each week that starts on or before this date.
                        </Form.Text>
                      </Form.Group>
                    ) : (
                      <Form.Group controlId="copy-count">
                        <Form.Label>Number of copies</Form.Label>
                        <Form.Control
                          type="number"
                          min={1}
                          step={1}
                          required
                          value={copyCount}
                          onChange={(event) => setCopyCount(event.target.value)}
                        />
                        <Form.Text>
                          The first destination counts as copy 1.
                        </Form.Text>
                      </Form.Group>
                    )}
                  </>
                )}
              </div>

              <section
                className="copy-calendar__preview"
                aria-labelledby="destination-calendar-title"
              >
                <h5 id="destination-calendar-title">
                  {repeat ? "Destination weeks" : "Destination week"}
                </h5>

                <p className="copy-calendar__help">{calendarHelp}</p>
                <div className="copy-calendar__panel">
                  <div
                    className="copy-calendar__view"
                    role="group"
                    aria-label="Calendar view"
                  >
                    <button
                      type="button"
                      className="cap-outline"
                      aria-pressed={view === "month"}
                      onClick={() => setViewChoice("month")}
                    >
                      Month
                    </button>
                    <button
                      type="button"
                      className="cap-outline"
                      aria-pressed={view === "year"}
                      onClick={() => setViewChoice("year")}
                    >
                      Year
                    </button>
                  </div>

                  <div className="copy-calendar__navigation">
                    <button
                      type="button"
                      className="cap-outline"
                      aria-label={
                        view === "year"
                          ? "Previous 12 months"
                          : "Previous month"
                      }
                      onClick={() =>
                        setVisibleMonth((month) =>
                          addCalendarMonths(month, view === "year" ? -12 : -1),
                        )
                      }
                    >
                      ‹
                    </button>

                    <strong aria-live="polite">
                      {monthFormatter.format(new Date(visibleMonth))}
                      {view === "year" &&
                        ` – ${monthFormatter.format(new Date(addCalendarMonths(visibleMonth, 11)))}`}
                    </strong>

                    <button
                      type="button"
                      className="cap-outline"
                      aria-label={
                        view === "year" ? "Next 12 months" : "Next month"
                      }
                      onClick={() =>
                        setVisibleMonth((month) =>
                          addCalendarMonths(month, view === "year" ? 12 : 1),
                        )
                      }
                    >
                      ›
                    </button>
                  </div>

                  {view === "month" ? (
                    <div className="copy-calendar__grid">
                      {WEEKDAYS.map((day) => (
                        <span key={day} className="copy-calendar__weekday">
                          {day}
                        </span>
                      ))}
                      {monthDays.map((day, index) => renderDay(day, index))}
                    </div>
                  ) : (
                    <>
                      <p className="copy-calendar__help">
                        Select a month to review its weeks.
                      </p>

                      <div className="copy-calendar__year">
                        {Array.from({ length: 12 }, (_, offset) => {
                          const month = addCalendarMonths(visibleMonth, offset);
                          const label = monthFormatter.format(new Date(month));

                          return (
                            <button
                              key={month}
                              type="button"
                              className="copy-calendar__mini"
                              aria-label={`Open ${label}`}
                              onClick={() => {
                                setVisibleMonth(month);
                                setViewChoice("month");
                              }}
                            >
                              <strong>{label}</strong>

                              <span
                                className="copy-calendar__mini-grid"
                                aria-hidden="true"
                              >
                                {WEEKDAYS.map((day) => (
                                  <small key={day}>{day[0]}</small>
                                ))}

                                {getMonthDays(month).map((day, index) => {
                                  if (firstOfMonth(day) !== month) {
                                    return <span key={day} />;
                                  }

                                  const start = weekForDay(day);
                                  let className = "";

                                  if (start && bookingsByWeek.has(start)) {
                                    className = "copy-calendar__day--booked";
                                  } else if (
                                    start &&
                                    repeat &&
                                    excluded.has(start)
                                  ) {
                                    className = "copy-calendar__day--excluded";
                                  } else if (start) {
                                    className = "copy-calendar__day--included";
                                  }

                                  if (start) {
                                    className += ` ${weekBandEdges(day, start, index % 7, true)}`;
                                  }

                                  return (
                                    <span key={day} className={className}>
                                      {Number(day.slice(-2))}
                                    </span>
                                  );
                                })}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
                {preview.loading && (
                  <p role="status">Checking destination weeks…</p>
                )}

                {preview.error && (
                  <Alert variant="danger">
                    <p>{preview.error}</p>
                    <button
                      type="button"
                      className="cap-outline"
                      onClick={preview.refresh}
                    >
                      Try again
                    </button>
                  </Alert>
                )}

                {preview.data && (
                  <p className="copy-calendar__summary" aria-live="polite">
                    {selectedCount} {selectedCount === 1 ? "week" : "weeks"}{" "}
                    selected
                    {excludedCount > 0 &&
                      ` · ${excludedCount} excluded by staff`}
                    {bookedCount > 0 && ` · ${bookedCount} blocked by bookings`}
                  </p>
                )}

                {bookingsByWeek.size > 0 && (
                  <details>
                    <summary>
                      View confirmed bookings ({preview.data?.bookings.length})
                    </summary>
                    {[...bookingsByWeek].map(([start, bookings]) => (
                      <div key={start}>
                        <strong>
                          {formatScheduleRange(
                            start,
                            addCalendarDays(start, 6),
                          )}
                        </strong>
                        <ul>
                          {bookings.map((booking) => (
                            <li key={booking.bookingId}>
                              {booking.bookingDate} · {booking.slotName} ·{" "}
                              {booking.startTime}
                              {" · "}Booking #{booking.bookingId} ·{" "}
                              {booking.partySize} guests
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </details>
                )}

                {replacedDates.length > 0 && (
                  <details className="copy-calendar__warning-details">
                    <summary>
                      Existing slots will be replaced on {replacedDates.length}{" "}
                      {replacedDates.length === 1 ? "date" : "dates"}
                    </summary>
                    <ul>
                      {replacedDates.map((day) => (
                        <li key={day}>{day}</li>
                      ))}
                    </ul>
                  </details>
                )}
                {overlapsSource && (
                  <Alert variant="warning" className="copy-calendar__notice">
                    {repeat
                      ? "A selected week overlaps the source week. Exclude it or change the dates."
                      : "Choose source and destination weeks at least seven days apart."}
                  </Alert>
                )}

                {repeat && !onCopyWeeks && (
                  <p className="copy-calendar__notice copy-calendar__help">
                    Weekly selection preview. Saving multiple weeks is not
                    connected yet.
                  </p>
                )}

                {error && (
                  <Alert variant="danger" className="copy-calendar__notice">
                    {error}
                  </Alert>
                )}
              </section>
            </div>
          </fieldset>
        </Modal.Body>

        <Modal.Footer>
          <button
            type="button"
            className="cap-outline"
            disabled={saving}
            onClick={onHide}
          >
            Cancel
          </button>

          <button type="submit" className="cap-primary" disabled={!canSave}>
            {saving
              ? "Copying…"
              : repeat
                ? `Copy ${selectedCount} ${selectedCount === 1 ? "week" : "weeks"}`
                : "Copy week"}
          </button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}
