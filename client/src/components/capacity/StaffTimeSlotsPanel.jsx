import { useState } from "react";
import { Col, Form, Overlay, Row, Tooltip } from "react-bootstrap";

import StatusBadge from "../common/StatusBadge.jsx";

/**
 * @typedef {import('../../models/models.js').DiningTableDTO} DiningTableDTO
 * @typedef {import('../../API/capacity-api.js').ConfiguredMealSlot} ConfiguredMealSlot
 */

/**
 * @param {Object} props
 * @param {ConfiguredMealSlot[]} props.slots
 * @param {DiningTableDTO[]} props.tables
 * @param {() => void} props.onAdd
 * @param {(slot: ConfiguredMealSlot) => void} props.onAssign
 */
export default function StaffTimeSlotsPanel({
  slots,
  tables,
  onAdd,
  onAssign,
}) {
  const [statusFilter, setStatusFilter] = useState("all");
  const [mealFilter, setMealFilter] = useState("");
  const [editNoticeTarget, setEditNoticeTarget] = useState(
    /** @type {HTMLButtonElement | null} */ (null),
  );

  const mealNames = [
    ...new Set(slots.map((slot) => slot.name.trim()).filter(Boolean)),
  ].sort((a, b) => a.localeCompare(b));

  const selectedMeal = mealNames.includes(mealFilter) ? mealFilter : "";

  const tableById = new Map(tables.map((table) => [String(table.id), table]));

  const slotSummaries = slots.map((slot) => {
    const assigned = (slot.tableIds || [])
      .map((id) => tableById.get(String(id)))
      .filter(
        /**
         * @param {DiningTableDTO | undefined} table
         * @returns {table is DiningTableDTO}
         */
        (table) => table !== undefined && table.isActive,
      );

    return {
      slot,
      assignedCount: assigned.length,
      seats: assigned.reduce((sum, table) => sum + table.seatCount, 0),
    };
  });

  const visibleSlots = slotSummaries.filter(({ slot, assignedCount }) => {
    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "assigned" ? assignedCount > 0 : assignedCount === 0);

    const matchesMeal =
      selectedMeal === "" || slot.name.trim() === selectedMeal;

    return matchesStatus && matchesMeal;
  });

  return (
    <section className="cap-panel cap-slots">
      <div className="cap-panel-heading d-flex flex-wrap align-items-start justify-content-between gap-3">
        <div>
          <h2>Time slots</h2>
          <p>Set the available tables for each time slot.</p>
        </div>

        <button type="button" className="cap-primary" onClick={onAdd}>
          <i className="bi bi-plus-lg" aria-hidden="true" />
          Add time slot
        </button>
      </div>

      <div className="d-flex flex-wrap align-items-end gap-3 mt-2">
        <div>
          <Form.Label htmlFor="time-slot-status">Status</Form.Label>
          <Form.Select
            id="time-slot-status"
            size="sm"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            <option value="all">All statuses</option>
            <option value="assigned">Tables assigned</option>
            <option value="unassigned">No tables assigned</option>
          </Form.Select>
        </div>

        <div>
          <Form.Label htmlFor="time-slot-meal">Meal</Form.Label>
          <Form.Select
            id="time-slot-meal"
            size="sm"
            value={selectedMeal}
            onChange={(event) => setMealFilter(event.target.value)}
          >
            <option value="">All meals</option>
            {mealNames.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </Form.Select>
        </div>
      </div>

      <Row className="g-0 cap-slot-head">
        <Col as="span" className="cap-slot-column-time">
          Time slot
        </Col>

        <Col as="span" className="cap-slot-column-seats">
          Total seats
        </Col>

        <Col as="span" className="cap-slot-column-tables">
          Status
        </Col>

        <Col as="span" className="cap-slot-column-actions">
          Actions
        </Col>
      </Row>

      <div className="cap-slot-list d-flex flex-column">
        {visibleSlots.map(({ slot, assignedCount, seats }) => {
          const hasTables = assignedCount > 0;

          return (
            <Row className="g-0 align-items-center cap-slot-row" key={slot.id}>
              <Col className="cap-slot-column-time cap-slot-time d-flex align-items-center">
                <i className="bi bi-clock" aria-hidden="true" />

                <span className="d-flex flex-column">
                  <strong>
                    {slot.startTime} – {slot.endTime}
                  </strong>

                  <small>
                    {slot.name}
                    {!slot.isActive ? " · Inactive" : ""}
                  </small>
                </span>
              </Col>

              <Col className="cap-slot-column-seats">
                <strong className="cap-slot-seat-total d-block">
                  {seats} seats
                </strong>
                {hasTables && (
                  <small className="text-body-secondary">
                    {assignedCount} {assignedCount === 1 ? "table" : "tables"}
                  </small>
                )}
              </Col>

              <Col className="cap-slot-column-tables">
                <div className="cap-slot-status">
                  <StatusBadge variant={hasTables ? "success" : "warning"}>
                    <i
                      className={
                        hasTables
                          ? "bi bi-check-circle-fill"
                          : "bi bi-exclamation-circle-fill"
                      }
                      aria-hidden="true"
                    />
                    {hasTables ? "Assigned" : "Not assigned"}
                  </StatusBadge>
                </div>
              </Col>

              <Col className="cap-slot-column-actions cap-slot-actions">
                <button
                  id={`modify-time-slot-tables-${slot.id}`}
                  type="button"
                  className={`cap-outline${hasTables ? " opacity-50" : ""}`}
                  aria-disabled={hasTables ? true : undefined}
                  aria-describedby={
                    editNoticeTarget?.id ===
                    `modify-time-slot-tables-${slot.id}`
                      ? "edit-time-slot-notice"
                      : undefined
                  }
                  onClick={(event) => {
                    if (hasTables) {
                      setEditNoticeTarget(event.currentTarget);
                      return;
                    }

                    onAssign(slot);
                  }}
                >
                  {hasTables ? "Manage tables" : "Assign tables"}
                </button>

                <button
                  id={`edit-time-slot-${slot.id}`}
                  type="button"
                  className="cap-outline opacity-50"
                  aria-disabled="true"
                  aria-describedby={
                    editNoticeTarget?.id === `edit-time-slot-${slot.id}`
                      ? "edit-time-slot-notice"
                      : undefined
                  }
                  onClick={(event) => setEditNoticeTarget(event.currentTarget)}
                >
                  Modify slot
                </button>
              </Col>
            </Row>
          );
        })}

        {visibleSlots.length === 0 && (
          <p className="cap-empty">
            {slots.length === 0
              ? "No time slots configured yet."
              : "No time slots match these filters."}
          </p>
        )}
      </div>

      <div className="cap-panel-footer cap-slots-footer">
        <span>
          {visibleSlots.length}{" "}
          {visibleSlots.length === 1 ? "time slot" : "time slots"}
        </span>
      </div>

      <Overlay
        target={editNoticeTarget}
        show={editNoticeTarget !== null && editNoticeTarget.isConnected}
        placement="top"
        rootClose
        onHide={() => setEditNoticeTarget(null)}
      >
        <Tooltip id="edit-time-slot-notice">
          {editNoticeTarget?.id.startsWith("modify-time-slot-tables-")
            ? "Modifying assigned tables will be available soon (MH-19)."
            : "Editing time slots will be available soon (MH-19)."}
        </Tooltip>
      </Overlay>
    </section>
  );
}
