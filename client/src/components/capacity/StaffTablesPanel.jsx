import { useState } from 'react';

import { formatCount } from './formatCount.js';
import StaffIcon from './StaffIcons.jsx';

/**
 * @typedef {import('../../models/models.js').DiningTableDTO} DiningTableDTO
 */

const PAGE_SIZE = 6;

/**
 * Searchable, paginated list of dining tables.
 *
 * @param {{
 *   tables: DiningTableDTO[],
 *   onAdd: () => void,
 *   onEdit: (table: DiningTableDTO) => void,
 * }} props
 */
export default function StaffTablesPanel({ tables, onAdd, onEdit }) {
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);

  const normalizedQuery = query.trim().toLowerCase();
  const filteredTables = tables.filter((table) =>
    table.name.toLowerCase().includes(normalizedQuery),
  );
  const pageCount = Math.max(1, Math.ceil(filteredTables.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const visibleTables = filteredTables.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );

  return (
    <section className="staff-panel" aria-labelledby="staff-tables-title">
      <div className="staff-panel__header">
        <div>
          <h2 id="staff-tables-title">Tables</h2>
          <p>Manage your tables and seating capacity.</p>
        </div>
        <button type="button" className="staff-button staff-button--primary" onClick={onAdd}>
          <StaffIcon name="plus" />
          Add table
        </button>
      </div>

      <label className="staff-search">
        <StaffIcon name="search" />
        <input
          type="search"
          placeholder="Search tables..."
          aria-label="Search tables"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setPage(1);
          }}
        />
      </label>

      {visibleTables.length === 0 ? (
        <p className="staff-empty">
          {tables.length === 0 ? 'No tables yet. Add the first one.' : 'No tables match your search.'}
        </p>
      ) : (
        <ul className="staff-table-list">
          {visibleTables.map((table) => (
            <li key={table.id} className={`staff-table-item${table.isActive ? '' : ' is-inactive'}`}>
              <span className="staff-table-item__icon">
                <StaffIcon name="grid" />
              </span>
              <span className="staff-table-item__text">
                <span className="staff-table-item__name">
                  {table.name}
                  {!table.isActive && <span className="staff-badge">Inactive</span>}
                </span>
                <span className="staff-table-item__seats">{formatCount(table.seatCount, 'seat')}</span>
              </span>
              <button
                type="button"
                className="staff-button staff-button--icon"
                aria-label={`Edit ${table.name}`}
                onClick={() => onEdit(table)}
              >
                <StaffIcon name="pencil" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="staff-panel__footer">
        <span>{formatCount(filteredTables.length, 'table')}</span>
        <span className="staff-pagination">
          <button
            type="button"
            className="staff-button staff-button--icon"
            aria-label="Previous page"
            disabled={currentPage === 1}
            onClick={() => setPage(currentPage - 1)}
          >
            <StaffIcon name="chevronLeft" />
          </button>
          <span>
            {currentPage} / {pageCount}
          </span>
          <button
            type="button"
            className="staff-button staff-button--icon"
            aria-label="Next page"
            disabled={currentPage === pageCount}
            onClick={() => setPage(currentPage + 1)}
          >
            <StaffIcon name="chevronRight" />
          </button>
        </span>
      </div>
    </section>
  );
}
