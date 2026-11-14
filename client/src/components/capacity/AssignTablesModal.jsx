import { useState } from "react";
import { Col, Form, Modal, Row, Spinner } from "react-bootstrap";

import Alert from "../common/AutoDismissAlert.jsx";
import ScheduleInfo from "./ScheduleInfo.jsx";

/**
 * @typedef {import('../../models/models.js').MealSlotDTO} MealSlotDTO
 * @typedef {import('../../models/models.js').DiningTableDTO} DiningTableDTO
 */

/**
 * @param {Object} props
 * @param {boolean} props.show
 * @param {() => void} props.onHide
 * @param {(MealSlotDTO & { tableIds: number[] }) | null | undefined} props.slot
 * @param {DiningTableDTO[]} props.tables
 * @param {number[]} props.selectedIds
 * @param {(tableId: number) => void} props.onToggle
 * @param {(tableIds: number[], selectAll: boolean) => void} props.onToggleAll
 * @param {boolean} props.isSuggestedConfiguration
 * @param {(MealSlotDTO & { tableIds: number[] }) | null | undefined} props.previousConfigurationSlot
 * @param {boolean} props.canOfferReuse
 * @param {"same-time" | "any-time" | "any-slot"} props.reuseMatch
 * @param {(value: "same-time" | "any-time" | "any-slot") => void} props.onReuseMatchChange
 * @param {() => void} props.onReuseConfiguration
 * @param {() => void} props.onUndoReuse
 * @param {"newest" | "oldest"} props.reuseOrder
 * @param {(value: "newest" | "oldest") => void} props.onReuseOrderChange
 * @param {number} props.reusableTableCount
 * @param {() => void | Promise<void>} props.onSave
 * @param {boolean} props.allowAssignLater
 * @param {boolean} props.saving
 * @param {string} props.error
 * @param {number} props.capacity
 * @param {(table: DiningTableDTO) => string} props.getUnavailableReason
 */
export default function AssignTablesModal({
  show,
  onHide,
  slot,
  tables,
  selectedIds,
  onToggle,
  onToggleAll,
  isSuggestedConfiguration,
  previousConfigurationSlot,
  canOfferReuse,
  reuseMatch,
  onReuseMatchChange,
  onReuseConfiguration,
  onUndoReuse,
  onSave,
  allowAssignLater,
  saving,
  error,
  capacity,
  getUnavailableReason,
  reuseOrder,
  onReuseOrderChange,
  reusableTableCount,
}) {
  const [query, setQuery] = useState("");
  const [showUnavailable, setShowUnavailable] = useState(false);
  const sourceTableCount = previousConfigurationSlot?.tableIds.length ?? 0;
  const skippedTables = (previousConfigurationSlot?.tableIds ?? [])
    .map((id) => {
      const table = tables.find((item) => item.id === id);

      return {
        id,
        name: table?.name ?? `Table #${id}`,
        reason: table
          ? getUnavailableReason(table)
          : "Table is no longer in the configuration",
      };
    })
    .filter(({ reason }) => Boolean(reason));

  const selected = tables.filter((table) =>
    selectedIds.some((id) => String(id) === String(table.id)),
  );

  const visible = tables.filter((table) => {
    const matchesSearch = table.name
      .toLowerCase()
      .includes(query.trim().toLowerCase());

    const alreadyAssigned =
      selectedIds.includes(table.id) ||
      (slot?.tableIds.includes(table.id) ?? false);

    return (
      matchesSearch &&
      (showUnavailable || alreadyAssigned || !getUnavailableReason(table))
    );
  });

  const selectableVisibleIds = visible
    .filter(
      (table) => !getUnavailableReason(table) || selectedIds.includes(table.id),
    )
    .map((table) => table.id);
  const allVisibleSelected =
    selectableVisibleIds.length > 0 &&
    selectableVisibleIds.every((id) =>
      selectedIds.some((selectedId) => String(selectedId) === String(id)),
    );
  const selectedLabel = allVisibleSelected
    ? "Deselect all visible tables"
    : "Select all visible available tables";

  return (
    <Modal
      show={show}
      onHide={onHide}
      centered
      size="lg"
      dialogClassName="cap-assign-dialog"
    >
      <Modal.Header closeButton className="border-bottom-0">
        <div>
          <Modal.Title>Assign tables</Modal.Title>

          <p className="cap-modal-subtitle">
            {slot?.name} · {slot?.startTime} – {slot?.endTime}
          </p>
        </div>
      </Modal.Header>

      <Modal.Body>
        {error && <Alert variant="danger">{error}</Alert>}

        {canOfferReuse && (
          <div className="cap-previous-configuration bg-light">
            <span className="cap-table-symbol" aria-hidden="true">
              <i className="bi bi-clock-history" />
            </span>

            <div className="flex-grow-1">
              <div className="d-flex flex-wrap align-items-center">
                <strong>Previous table configuration</strong>

                <ScheduleInfo label="How reusing a table configuration works">
                  Choose whether to match the same service name and hours, the
                  same name at any time, or any earlier service. Use Most recent
                  or Oldest to set the search order. Before you reuse a
                  configuration, the summary shows how many tables are
                  available. If any will be skipped, expand Show skipped tables
                  to see which ones and why. For example, if one of two tables
                  is already assigned to an overlapping slot, only the available
                  table will be selected. If all tables in a configuration are
                  unavailable, the search moves to the next matching slot. Undo
                  reuse restores your selection from before you reused the
                  configuration, even if you’ve changed it manually since then.
                </ScheduleInfo>
              </div>

              <div className="cap-reuse-controls">
                <Form.Group
                  controlId="reuse-table-configuration-match"
                  className="cap-reuse-match"
                >
                  <Form.Label className="small mb-1">
                    Match previous slot
                  </Form.Label>
                  <Form.Select
                    size="sm"
                    value={reuseMatch}
                    disabled={saving || isSuggestedConfiguration}
                    onChange={(event) => {
                      const { value } = event.target;
                      if (
                        value === "same-time" ||
                        value === "any-time" ||
                        value === "any-slot"
                      ) {
                        onReuseMatchChange(value);
                      }
                    }}
                  >
                    <option value="same-time">Same name and time</option>
                    <option value="any-time">Same name, any time</option>
                    <option value="any-slot">Any name, any time</option>
                  </Form.Select>
                </Form.Group>
                <Form.Group
                  controlId="reuse-table-configuration-order"
                  className="cap-reuse-match"
                >
                  <Form.Label className="small mb-1">
                    Configuration order
                  </Form.Label>
                  <Form.Select
                    size="sm"
                    value={reuseOrder}
                    disabled={saving || isSuggestedConfiguration}
                    onChange={(event) =>
                      onReuseOrderChange(
                        event.target.value === "oldest" ? "oldest" : "newest",
                      )
                    }
                  >
                    <option value="newest">Most recent</option>
                    <option value="oldest">Oldest</option>
                  </Form.Select>
                </Form.Group>
                <button
                  type="button"
                  className="cap-primary"
                  disabled={
                    saving ||
                    (!isSuggestedConfiguration && !previousConfigurationSlot)
                  }
                  onClick={
                    isSuggestedConfiguration
                      ? onUndoReuse
                      : onReuseConfiguration
                  }
                >
                  <i
                    className={
                      isSuggestedConfiguration
                        ? "bi bi-arrow-counterclockwise"
                        : "bi bi-arrow-repeat"
                    }
                    aria-hidden="true"
                  />
                  {isSuggestedConfiguration
                    ? "Undo reuse"
                    : "Reuse configuration"}
                </button>
              </div>

              <small aria-live="polite">
                {previousConfigurationSlot ? (
                  <>
                    From {previousConfigurationSlot.name} ·{" "}
                    {new Date(
                      `${previousConfigurationSlot.slotDate}T00:00:00Z`,
                    ).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                      timeZone: "UTC",
                    })}{" "}
                    · {previousConfigurationSlot.startTime} –{" "}
                    {previousConfigurationSlot.endTime}
                    {skippedTables.length === 0 && (
                      <span className="d-block mt-1">
                        {sourceTableCount === 1
                          ? "The table is available."
                          : `All ${sourceTableCount} tables are available.`}
                      </span>
                    )}
                  </>
                ) : (
                  "No matching previous slot with available tables."
                )}
              </small>
              {skippedTables.length > 0 && (
                <details
                  key={previousConfigurationSlot?.id}
                  className="cap-reuse-skipped"
                >
                  <summary>
                    {`${reusableTableCount} of ${sourceTableCount} tables available.`}{" "}
                    <span className="cap-reuse-skipped-link">
                      {skippedTables.length === 1
                        ? "Show 1 skipped table"
                        : `Show ${skippedTables.length} skipped tables`}
                    </span>
                  </summary>

                  <ul
                    className="cap-reuse-skipped-list list-unstyled mb-0 mt-2"
                    aria-label="Skipped tables"
                    tabIndex={0}
                  >
                    {skippedTables.map(({ id, name, reason }) => (
                      <li key={id}>
                        {name} · {reason}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          </div>
        )}

        <Row className="g-0 cap-assign-grid">
          <Col xs={12} className="cap-assign-picker">
            <div className="cap-search">
              <i className="bi bi-search" aria-hidden="true" />

              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search tables..."
                aria-label="Search assignment tables"
              />
            </div>

            <label className="d-flex align-items-center gap-2 my-3">
              <input
                type="checkbox"
                checked={allVisibleSelected}
                disabled={saving || selectableVisibleIds.length === 0}
                onChange={() =>
                  onToggleAll(selectableVisibleIds, !allVisibleSelected)
                }
              />

              <span>{selectedLabel}</span>
            </label>

            <label className="d-flex align-items-center gap-2 mb-3">
              <input
                type="checkbox"
                checked={showUnavailable}
                onChange={(event) => setShowUnavailable(event.target.checked)}
              />

              <span>Show unavailable tables</span>
            </label>

            <div className="cap-assign-list">
              {visible.map((table) => (
                <label
                  className="cap-assign-item d-flex align-items-center"
                  key={table.id}
                >
                  <input
                    type="checkbox"
                    className="cap-assignment-checkbox"
                    checked={selectedIds.some(
                      (id) => String(id) === String(table.id),
                    )}
                    disabled={
                      saving ||
                      (Boolean(getUnavailableReason(table)) &&
                        !selectedIds.includes(table.id))
                    }
                    onChange={() => onToggle(table.id)}
                    aria-label={`Select ${table.name}`}
                  />

                  <span className="cap-table-symbol">
                    <i className="bi bi-table" aria-hidden="true" />
                  </span>

                  <strong>{table.name}</strong>

                  <small>
                    {table.seatCount} seats
                    {getUnavailableReason(table) && (
                      <span className="d-block text-muted">
                        {getUnavailableReason(table)}
                      </span>
                    )}
                  </small>
                </label>
              ))}

              {visible.length === 0 && (
                <p className="cap-empty">No tables found.</p>
              )}
            </div>

            <small className="cap-list-count">
              {selected.length} of {tables.length} tables selected
            </small>
          </Col>

          <Col xs={12} className="cap-selected-panel d-flex flex-column">
            <div className="cap-selected-heading d-flex align-items-center justify-content-between">
              <strong>Selected tables</strong>

              <span>{selected.length}</span>
            </div>

            <div className="cap-selected-list">
              {selected.map((table) => (
                <div
                  className="cap-selected-item d-flex align-items-center"
                  key={table.id}
                >
                  <span className="cap-table-symbol">
                    <i className="bi bi-table" aria-hidden="true" />
                  </span>

                  <span className="d-flex flex-column">
                    <strong>{table.name}</strong>

                    <small>{table.seatCount} seats</small>
                  </span>

                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => onToggle(table.id)}
                    aria-label={`Remove ${table.name}`}
                  >
                    <i className="bi bi-x-lg" aria-hidden="true" />
                  </button>
                </div>
              ))}
            </div>

            <div className="cap-selected-total d-flex flex-column mt-auto">
              <small>Total capacity</small>

              <strong>{capacity} seats</strong>
            </div>
          </Col>
        </Row>
      </Modal.Body>

      <Modal.Footer className="border-top-0">
        <button
          type="button"
          className="cap-outline"
          disabled={saving}
          onClick={onHide}
        >
          {allowAssignLater ? "Assign later" : "Cancel"}
        </button>

        <button
          type="button"
          className="cap-primary"
          disabled={saving || !slot}
          onClick={onSave}
        >
          {saving ? (
            <Spinner animation="border" size="sm" />
          ) : allowAssignLater ? (
            "Assign tables"
          ) : (
            "Save changes"
          )}
        </button>
      </Modal.Footer>
    </Modal>
  );
}
