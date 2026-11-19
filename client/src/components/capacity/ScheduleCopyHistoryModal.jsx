import { useEffect, useMemo, useState } from "react";
import { Alert, Modal } from "react-bootstrap";

import CapacityAPI from "../../API/capacity-api.js";
import {
  addCalendarDays,
  addCalendarMonths,
  formatScheduleRange,
  startOfWeek,
  weekBandEdges,
} from "../../utils/weekly-schedule.js";

/** @typedef {Awaited<ReturnType<typeof CapacityAPI.getScheduleCopyHistory>>[number]} SavedCopy */

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const monthFormatter = new Intl.DateTimeFormat("en-GB", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

const statusLabels = {
  copied: "Copied",
  excluded: "Excluded by staff",
  booked: "Blocked by confirmed bookings",
};

/** @param {string} date */
function firstOfMonth(date) {
  return `${date.slice(0, 7)}-01`;
}

/** @param {string} start */
function weekDays(start) {
  return Array.from({ length: 7 }, (_, index) => addCalendarDays(start, index));
}

/** @param {string} month */
function monthCells(month) {
  const first = startOfWeek(month);
  const next = addCalendarMonths(month, 1);
  const days = (Date.parse(next) - Date.parse(first)) / 86_400_000;
  const count = Math.ceil(days / 7) * 7;
  return Array.from({ length: count }, (_, index) =>
    addCalendarDays(first, index),
  );
}

/**
 * @param {{
 *   copy: SavedCopy,
 *   owners: Map<string, number>
 * }} props
 */
function HistoryCalendar({ copy, owners }) {
  const [month, setMonth] = useState(() =>
    firstOfMonth(copy.weeks[0]?.start ?? copy.sourceWeekStart),
  );
  const [yearView, setYearView] = useState(copy.weeks.length > 6);

  const byDay = useMemo(() => {
    /** @type {Map<string, SavedCopy["weeks"][number]>} */
    const days = new Map();

    for (const week of copy.weeks) {
      for (const day of weekDays(week.start)) days.set(day, week);
    }

    return days;
  }, [copy]);

  /** @param {string} day */
  function replacement(day) {
    const owner = owners.get(day);
    return byDay.get(day)?.status === "copied" &&
      owner !== undefined &&
      owner > copy.id
      ? owner
      : null;
  }

  /** @param {string} visibleMonth */
  function renderGrid(visibleMonth) {
    return (
      <span
        className={
          yearView ? "copy-calendar__mini-grid" : "copy-calendar__grid"
        }
      >
        {WEEKDAYS.map((label) => (
          <span key={label} className="copy-calendar__weekday">
            {yearView ? label[0] : label}
          </span>
        ))}

        {monthCells(visibleMonth).map((day, index) => {
          if (firstOfMonth(day) !== visibleMonth) return <span key={day} />;

          const week = byDay.get(day);
          const replacedBy = replacement(day);
          let modifier = "";
          let description = "";

          if (week) {
            description = statusLabels[week.status];

            if (replacedBy !== null) {
              modifier =
                "copy-calendar__day--booked text-decoration-line-through";
              description = `Replaced by copy #${replacedBy}`;
            } else if (week.status === "copied") {
              modifier = "copy-calendar__day--included";
            } else if (week.status === "booked") {
              modifier = "copy-calendar__day--booked";
            } else {
              modifier = "copy-calendar__day--excluded";
            }
          }

          if (week) {
            modifier += ` ${weekBandEdges(day, week.start, index % 7, true)}`;
          }

          return (
            <span
              key={day}
              className={`${yearView ? "" : "copy-calendar__day"} ${modifier}`}
              title={`${day} ${description}`}
              aria-label={`${day} ${description}`}
            >
              {Number(day.slice(-2))}
            </span>
          );
        })}
      </span>
    );
  }

  const months = Array.from({ length: yearView ? 12 : 1 }, (_, index) =>
    addCalendarMonths(month, index),
  );

  return (
    <section
      className="copy-calendar__preview"
      aria-label="Saved destination weeks"
    >
      <h5>Copy #{copy.id}</h5>
      <p>
        Source week:{" "}
        {formatScheduleRange(
          copy.sourceWeekStart,
          addCalendarDays(copy.sourceWeekStart, 6),
        )}
      </p>

      <div className="copy-calendar__panel">
        <div
          className="copy-calendar__view"
          role="group"
          aria-label="Calendar view"
        >
          <button
            type="button"
            className="cap-outline"
            aria-pressed={!yearView}
            onClick={() => setYearView(false)}
          >
            Month
          </button>
          <button
            type="button"
            className="cap-outline"
            aria-pressed={yearView}
            onClick={() => setYearView(true)}
          >
            Year
          </button>
        </div>

        <div className="copy-calendar__navigation">
          <button
            type="button"
            className="cap-outline"
            aria-label={yearView ? "Previous 12 months" : "Previous month"}
            onClick={() =>
              setMonth(addCalendarMonths(month, yearView ? -12 : -1))
            }
          >
            ‹
          </button>
          <strong aria-live="polite">
            {monthFormatter.format(new Date(month))}
            {yearView && ` – ${monthFormatter.format(new Date(months[11]))}`}
          </strong>
          <button
            type="button"
            className="cap-outline"
            aria-label={yearView ? "Next 12 months" : "Next month"}
            onClick={() =>
              setMonth(addCalendarMonths(month, yearView ? 12 : 1))
            }
          >
            ›
          </button>
        </div>

        {yearView ? (
          <div className="copy-calendar__year">
            {months.map((item) => (
              <button
                key={item}
                type="button"
                className="copy-calendar__mini"
                aria-label={`Open ${monthFormatter.format(new Date(item))}`}
                onClick={() => {
                  setMonth(item);
                  setYearView(false);
                }}
              >
                <strong>{monthFormatter.format(new Date(item))}</strong>
                {renderGrid(item)}
              </button>
            ))}
          </div>
        ) : (
          renderGrid(month)
        )}
      </div>
      <details>
        <summary>Week details ({copy.weeks.length})</summary>
        <ul>
          {copy.weeks.map((week) => {
            const days = weekDays(week.start);
            const replaced = days.filter((day) => replacement(day) !== null);

            return (
              <li key={week.start}>
                <strong>{formatScheduleRange(week.start, days[6])}</strong>
                {" · "}
                {replaced.length === 7
                  ? "Fully replaced"
                  : replaced.length > 0
                    ? "Partially replaced"
                    : statusLabels[week.status]}

                {replaced.length > 0 && (
                  <ul>
                    {replaced.map((day) => (
                      <li key={day}>
                        {day} · Replaced by copy #{replacement(day)}
                      </li>
                    ))}
                  </ul>
                )}

                {Boolean(week.bookings?.length) && (
                  <ul>
                    {week.bookings?.map((booking) => (
                      <li key={booking.bookingId}>
                        Booking #{booking.bookingId} · {booking.bookingDate} ·{" "}
                        {booking.slotName} · {booking.startTime} ·{" "}
                        {booking.partySize} guests
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      </details>
    </section>
  );
}

/** @param {{ onHide: () => void, onAddSchedule: () => void }} props */
export default function ScheduleCopyHistoryModal({ onHide, onAddSchedule }) {
  const [copies, setCopies] = useState(/** @type {SavedCopy[]} */ ([]));
  const [selectedId, setSelectedId] = useState(
    /** @type {number | null} */ (null),
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      setLoading(true);
      setError("");

      try {
        const entries = await CapacityAPI.getScheduleCopyHistory(
          controller.signal,
        );
        if (!controller.signal.aborted) {
          setCopies(entries);
          setSelectedId(entries[0]?.id ?? null);
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(
            err instanceof Error
              ? err.message
              : "Could not load schedule copies.",
          );
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void load();
    return () => controller.abort();
  }, [attempt]);

  const owners = useMemo(() => {
    /** @type {Map<string, number>} */
    const latest = new Map();

    // The API returns newest first. Only a successful copy replaces a day.
    for (const copy of copies) {
      for (const week of copy.weeks) {
        if (week.status !== "copied") continue;

        for (const day of weekDays(week.start)) {
          if (!latest.has(day)) latest.set(day, copy.id);
        }
      }
    }

    return latest;
  }, [copies]);

  const selected = copies.find((entry) => entry.id === selectedId);

  return (
    <Modal
      show
      centered
      scrollable
      size="xl"
      onHide={onHide}
      dialogClassName="cap-schedule-dialog copy-calendar"
      aria-labelledby="schedule-copy-history-title"
    >
      <Modal.Header closeButton>
        <Modal.Title as="h2" id="schedule-copy-history-title">
          Schedule copies
        </Modal.Title>
      </Modal.Header>

      <Modal.Body>
        {loading && <p role="status">Loading schedule copies…</p>}

        {error && (
          <Alert variant="danger">
            <p>{error}</p>
            <button
              type="button"
              className="cap-outline"
              onClick={() => setAttempt((value) => value + 1)}
            >
              Try again
            </button>
          </Alert>
        )}

        {!loading && !error && copies.length === 0 && (
          <p>No schedule copies have been saved yet.</p>
        )}

        {!loading && !error && selected && (
          <div className="copy-calendar__layout">
            <nav
              className="copy-calendar__settings copy-history__list"
              aria-label="Saved copies"
            >
              {copies.map((copy) => {
                const copiedCount = copy.weeks.filter(
                  (week) => week.status === "copied",
                ).length;

                return (
                  <button
                    key={copy.id}
                    type="button"
                    className="copy-history__card"
                    aria-pressed={copy.id === selectedId}
                    onClick={() => setSelectedId(copy.id)}
                  >
                    <strong>
                      Source:{" "}
                      {formatScheduleRange(
                        copy.sourceWeekStart,
                        addCalendarDays(copy.sourceWeekStart, 6),
                      )}
                    </strong>

                    <span>
                      {copiedCount} {copiedCount === 1 ? "week" : "weeks"}{" "}
                      copied
                    </span>

                    <small>
                      Copy #{copy.id} ·{" "}
                      <time dateTime={copy.createdAt}>
                        {new Date(copy.createdAt).toLocaleString("en-GB", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </time>
                    </small>
                  </button>
                );
              })}
            </nav>

            <HistoryCalendar
              key={selected.id}
              copy={selected}
              owners={owners}
            />
          </div>
        )}
      </Modal.Body>

      <Modal.Footer>
        <button type="button" className="cap-outline" onClick={onHide}>
          Close
        </button>
        <button type="button" className="cap-primary" onClick={onAddSchedule}>
          Add schedule
        </button>
      </Modal.Footer>
    </Modal>
  );
}
