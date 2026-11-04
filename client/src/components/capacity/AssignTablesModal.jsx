import { useState } from 'react';
import { Col, Modal, Row, Spinner } from 'react-bootstrap';

import Alert from '../common/AutoDismissAlert.jsx';

/**
 * @typedef {import('../../models/models.js').MealSlotDTO} MealSlotDTO
 * @typedef {import('../../models/models.js').DiningTableDTO} DiningTableDTO
 */

/**
 * @param {Object} props
 * @param {boolean} props.show
 * @param {() => void} props.onHide
 * @param {MealSlotDTO | null | undefined} props.slot
 * @param {DiningTableDTO[]} props.tables
 * @param {number[]} props.selectedIds
 * @param {(tableId: number) => void} props.onToggle
 * @param {() => void | Promise<void>} props.onSave
 * @param {boolean} props.saving
 * @param {string} props.error
 * @param {number} props.capacity
 */
export default function AssignTablesModal({
  show,
  onHide,
  slot,
  tables,
  selectedIds,
  onToggle,
  onSave,
  saving,
  error,
  capacity,
}) {
  const [query, setQuery] = useState('');

  const selected = tables.filter((table) =>
    selectedIds.some((id) => String(id) === String(table.id)),
  );

  const visible = tables.filter((table) =>
    table.name.toLowerCase().includes(query.toLowerCase()),
  );

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
        {error && (
          <Alert variant="danger">
            {error}
          </Alert>
        )}

        <Row className="g-0 cap-assign-grid">
          <Col xs={12} className="cap-assign-picker">
            <div className="cap-search">
              <i
                className="bi bi-search"
                aria-hidden="true"
              />

              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search tables..."
                aria-label="Search assignment tables"
              />
            </div>

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
                    disabled={!table.isActive || saving}
                    onChange={() => onToggle(table.id)}
                    aria-label={`Select ${table.name}`}
                  />

                  <span className="cap-table-symbol">
                    <i
                      className="bi bi-table"
                      aria-hidden="true"
                    />
                  </span>

                  <strong>{table.name}</strong>

                  <small>{table.seatCount} seats</small>
                </label>
              ))}

              {visible.length === 0 && (
                <p className="cap-empty">No tables found.</p>
              )}
            </div>

            <small className="cap-list-count">
              {tables.length} tables
            </small>
          </Col>

          <Col
            xs={12}
            className="cap-selected-panel d-flex flex-column"
          >
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
                    <i
                      className="bi bi-table"
                      aria-hidden="true"
                    />
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
                    <i
                      className="bi bi-x-lg"
                      aria-hidden="true"
                    />
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
          Cancel
        </button>

        <button
          type="button"
          className="cap-primary"
          disabled={saving || !slot}
          onClick={onSave}
        >
          {saving ? (
            <Spinner animation="border" size="sm" />
          ) : (
            'Assign tables'
          )}
        </button>
      </Modal.Footer>
    </Modal>
  );
}