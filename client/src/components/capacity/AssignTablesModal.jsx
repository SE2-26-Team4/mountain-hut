import { useId, useRef, useState } from 'react';

import { useModalDialog } from '../../hooks/useModalDialog.js';
import { formatCount } from './formatCount.js';
import StaffIcon from './StaffIcons.jsx';

/**
 * @typedef {import('../../models/models.js').MealSlotDTO} MealSlotDTO
 * @typedef {import('../../models/models.js').DiningTableDTO} DiningTableDTO
 */

/**
 * Dialog to choose the complete set of tables assigned to a meal slot.
 *
 * @param {{
 *   slot: MealSlotDTO,
 *   tables: DiningTableDTO[],
 *   assignedTableIds: number[],
 *   onSubmit: (tableIds: number[]) => Promise<void>,
 *   onClose: () => void,
 * }} props
 */
export default function AssignTablesModal({
  slot,
  tables,
  assignedTableIds,
  onSubmit,
  onClose,
}) {
  const titleId = useId();
  const searchRef = useRef(/** @type {HTMLInputElement | null} */ (null));
  const dialogRef = useModalDialog(searchRef);

  const [selectedIds, setSelectedIds] = useState(assignedTableIds);
  const [query, setQuery] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const normalizedQuery = query.trim().toLowerCase();
  const matchingTables = tables.filter((table) =>
    table.name.toLowerCase().includes(normalizedQuery),
  );
  const selectedTables = tables.filter((table) => selectedIds.includes(table.id));
  const totalSeats = selectedTables.reduce(
    (total, table) => total + (table.isActive ? table.seatCount : 0),
    0,
  );

  /**
   * @param {number} tableId
   */
  function toggleTable(tableId) {
    setSelectedIds((current) =>
      current.includes(tableId)
        ? current.filter((id) => id !== tableId)
        : [...current, tableId],
    );
  }

  async function handleSave() {
    setSubmitError('');
    setSubmitting(true);

    try {
      await onSubmit(selectedTables.map((table) => table.id));
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'The tables could not be assigned.');
      setSubmitting(false);
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="staff-modal staff-modal--wide"
      aria-labelledby={titleId}
      onCancel={(event) => {
        if (submitting) {
          event.preventDefault();
        }
      }}
      onClose={onClose}
    >
      <div className="staff-modal__header">
        <div>
          <h2 id={titleId}>Assign tables</h2>
          <p>
            {slot.name} · {slot.startTime} – {slot.endTime}
          </p>
        </div>
        <button
          type="button"
          className="staff-button staff-button--icon"
          aria-label="Close"
          disabled={submitting}
          onClick={onClose}
        >
          <StaffIcon name="close" />
        </button>
      </div>

      <div className="staff-modal__body staff-assign">
        <div className="staff-assign__column">
          <label className="staff-search">
            <StaffIcon name="search" />
            <input
              ref={searchRef}
              type="search"
              placeholder="Search tables..."
              aria-label="Search tables"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>

          {matchingTables.length === 0 ? (
            <p className="staff-empty">
              {tables.length === 0
                ? 'No tables yet. Add tables in the Tables panel first.'
                : 'No tables match your search.'}
            </p>
          ) : (
            <ul className="staff-assign__options">
              {matchingTables.map((table) => {
                const selected = selectedIds.includes(table.id);

                return (
                  <li key={table.id}>
                    <label className={`staff-assign__option${selected ? ' is-selected' : ''}`}>
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => toggleTable(table.id)}
                      />
                      <StaffIcon name="grid" />
                      <span className="staff-assign__name">
                        {table.name}
                        {!table.isActive && <span className="staff-badge">Inactive</span>}
                      </span>
                      <span className="staff-muted">{formatCount(table.seatCount, 'seat')}</span>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}

          <p className="staff-muted">{formatCount(matchingTables.length, 'table')}</p>
        </div>

        <div className="staff-assign__column staff-assign__summary">
          <h3>
            Selected tables
            <span className="staff-count">{selectedTables.length}</span>
          </h3>

          {selectedTables.length === 0 ? (
            <p className="staff-muted">
              No tables selected. Saving leaves this time slot without seats.
            </p>
          ) : (
            <ul className="staff-assign__picked">
              {selectedTables.map((table) => (
                <li key={table.id} className={table.isActive ? undefined : 'is-inactive'}>
                  <span className="staff-table-item__icon">
                    <StaffIcon name="grid" />
                  </span>
                  <span className="staff-table-item__text">
                    <span className="staff-table-item__name">{table.name}</span>
                    <span className="staff-table-item__seats">
                      {table.isActive ? formatCount(table.seatCount, 'seat') : 'Inactive, not counted'}
                    </span>
                  </span>
                  <button
                    type="button"
                    className="staff-button staff-button--icon"
                    aria-label={`Remove ${table.name}`}
                    onClick={() => toggleTable(table.id)}
                  >
                    <StaffIcon name="close" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="staff-assign__total">
            <span>Total capacity</span>
            <strong>{formatCount(totalSeats, 'seat')}</strong>
          </div>
        </div>

        {submitError && (
          <p className="staff-form-error staff-assign__error" role="alert">
            {submitError}
          </p>
        )}
      </div>

      <div className="staff-modal__footer">
        <button
          type="button"
          className="staff-button staff-button--secondary"
          disabled={submitting}
          onClick={onClose}
        >
          Cancel
        </button>
        <button
          type="button"
          className="staff-button staff-button--primary"
          disabled={submitting}
          onClick={handleSave}
        >
          {submitting ? 'Saving…' : 'Save tables'}
        </button>
      </div>
    </dialog>
  );
}
