import { useMemo, useState } from 'react';

/**
 * @typedef {import('../../models/models.js').DiningTableDTO} DiningTableDTO
 */

/**
 * @param {Object} props
 * @param {DiningTableDTO[]} props.tables
 * @param {() => void} props.onAdd
 * @param {(table: DiningTableDTO) => void} props.onEdit
 */
export default function StaffTablesPanel({
  tables,
  onAdd,
  onEdit,
}) {
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);

  const filtered = useMemo(
    () =>
      tables.filter((table) =>
        table.name.toLowerCase().includes(query.toLowerCase()),
      ),
    [tables, query],
  );

  const pageSize = 9;
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const current = Math.min(page, pages);

  const visibleTables = filtered.slice(
    (current - 1) * pageSize,
    current * pageSize,
  );

  return (
    <section className="cap-panel cap-tables">
      <div className="cap-panel-heading d-flex align-items-start justify-content-between">
        <div>
          <h2>Tables</h2>

          <p>Manage your tables and seating capacity.</p>
        </div>

        <button
          type="button"
          className="cap-primary"
          onClick={onAdd}
        >
          <i
            className="bi bi-plus-lg"
            aria-hidden="true"
          />

          Add table
        </button>
      </div>

      <div className="cap-search">
        <i
          className="bi bi-search"
          aria-hidden="true"
        />

        <input
          placeholder="Search tables..."
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setPage(1);
          }}
          aria-label="Search tables"
        />
      </div>

      <div className="cap-table-list d-flex flex-column">
        {visibleTables.map((table) => (
          <div
            className="cap-table-item d-flex align-items-center"
            key={table.id}
          >
            <span className="cap-table-symbol">
              <i
                className="bi bi-people"
                aria-hidden="true"
              />
            </span>

            <span className="cap-table-copy d-flex flex-column">
              <strong>{table.name}</strong>

              <small>
                {table.seatCount} seats
                {!table.isActive ? ' · Inactive' : ''}
              </small>
            </span>

            <button
              type="button"
              className="cap-icon-button"
              onClick={() => onEdit(table)}
              aria-label={`Edit ${table.name}`}
            >
              <i
                className="bi bi-pencil"
                aria-hidden="true"
              />
            </button>
          </div>
        ))}

        {filtered.length === 0 && (
          <p className="cap-empty">No tables found.</p>
        )}
      </div>

      <div className="cap-panel-footer d-flex align-items-center justify-content-between cap-tables-footer">
        <span>{filtered.length} tables</span>

        <div className="cap-pagination d-flex align-items-center">
          <button
            type="button"
            disabled={current === 1}
            onClick={() => setPage(current - 1)}
            aria-label="Previous page"
          >
            <i
              className="bi bi-chevron-left"
              aria-hidden="true"
            />
          </button>

          <span>
            {current} / {pages}
          </span>

          <button
            type="button"
            disabled={current === pages}
            onClick={() => setPage(current + 1)}
            aria-label="Next page"
          >
            <i
              className="bi bi-chevron-right"
              aria-hidden="true"
            />
          </button>
        </div>
      </div>
    </section>
  );
}