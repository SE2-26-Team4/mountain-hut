import { Col, Row } from "react-bootstrap";

/**
 * @typedef {import('../../models/models.js').DiningTableDTO} DiningTableDTO
 * @typedef {import('../../API/capacity-api.js').ConfiguredMealSlot} ConfiguredMealSlot
 */

/**
 * @param {Object} props
 * @param {ConfiguredMealSlot[]} props.slots
 * @param {DiningTableDTO[]} props.tables
 * @param {() => void} props.onAdd
 * @param {() => void} props.onCopyWeek
 * @param {(slot: ConfiguredMealSlot) => void} props.onEdit
 * @param {(slot: ConfiguredMealSlot) => void} props.onAssign
 */
export default function StaffTimeSlotsPanel({
  slots,
  tables,
  onAdd,
  onCopyWeek,
  onEdit,
  onAssign,
}) {
  const tableById = new Map(tables.map((table) => [String(table.id), table]));

  return (
    <section className="cap-panel cap-slots">
      <div className="cap-panel-heading d-flex flex-wrap align-items-start justify-content-between gap-3">
        <div>
          <h2>Time slots</h2>

          <p>Set the available tables for each time slot.</p>
        </div>

        <div className="cap-schedule-actions">
          <button type="button" className="cap-outline" onClick={onCopyWeek}>
            <i className="bi bi-copy" aria-hidden="true" />
            Copy week
          </button>

          <button type="button" className="cap-primary" onClick={onAdd}>
            <i className="bi bi-plus-lg" aria-hidden="true" />
            Add time slot
          </button>
        </div>
      </div>

      <Row className="g-0 cap-slot-head">
        <Col as="span" className="cap-slot-column-time">
          Time slot
        </Col>

        <Col as="span" className="cap-slot-column-tables">
          Assigned tables
        </Col>

        <Col as="span" className="cap-slot-column-seats">
          Total seats
        </Col>

        <Col as="span" className="cap-slot-column-actions">
          Actions
        </Col>
      </Row>

      <div className="cap-slot-list d-flex flex-column">
        {slots.map((slot) => {
          const assigned = (slot.tableIds || [])
            .map((id) => tableById.get(String(id)))
            .filter(
              /**
               * @param {DiningTableDTO | undefined} table
               * @returns {table is DiningTableDTO}
               */
              (table) => table !== undefined && table.isActive,
            );

          const seats = assigned.reduce(
            (sum, table) => sum + table.seatCount,
            0,
          );

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

              <Col className="cap-slot-column-tables cap-chips d-flex flex-wrap align-items-center">
                {assigned.slice(0, 3).map((table) => (
                  <span key={table.id}>{table.name}</span>
                ))}

                {assigned.length > 3 && <span>+{assigned.length - 3}</span>}

                {assigned.length === 0 && <small>None assigned</small>}
              </Col>

              <Col className="cap-slot-column-seats">
                <strong className="cap-seat-count d-block text-center">
                  {seats}
                  <span className="cap-seat-label"> seats</span>
                </strong>
              </Col>

              <Col className="cap-slot-column-actions cap-slot-actions d-flex align-items-center">
                <button
                  type="button"
                  className="cap-outline"
                  onClick={() => onAssign(slot)}
                >
                  Assign tables
                </button>

                <button
                  type="button"
                  className="cap-icon-button"
                  onClick={() => onEdit(slot)}
                  aria-label="View time slot"
                  title="View time slot"
                >
                  <i className="bi bi-eye" aria-hidden="true" />
                </button>
              </Col>
            </Row>
          );
        })}

        {slots.length === 0 && (
          <p className="cap-empty">No time slots configured yet.</p>
        )}
      </div>

      <div className="cap-panel-footer cap-slots-footer">
        <span>
          {slots.length} {slots.length === 1 ? "time slot" : "time slots"}
        </span>
      </div>
    </section>
  );
}
