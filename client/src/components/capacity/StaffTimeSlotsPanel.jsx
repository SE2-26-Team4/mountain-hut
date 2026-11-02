import StaffIcon from './StaffIcons.jsx';

/**
 * @typedef {import('../../models/models.js').MealSlotDTO} MealSlotDTO
 * @typedef {import('../../models/models.js').MealSlotCapacityDTO} MealSlotCapacityDTO
 */

/**
 * Meal slots with their assigned tables and total seat capacity.
 *
 * @param {{
 *   mealSlots: MealSlotDTO[],
 *   capacityBySlotId: Map<number, MealSlotCapacityDTO>,
 *   onAdd: () => void,
 *   onEdit: (slot: MealSlotDTO) => void,
 *   onAssign: (slot: MealSlotDTO) => void,
 * }} props
 */
export default function StaffTimeSlotsPanel({
  mealSlots,
  capacityBySlotId,
  onAdd,
  onEdit,
  onAssign,
}) {
  return (
    <section className="staff-panel" aria-labelledby="staff-slots-title">
      <div className="staff-panel__header">
        <div>
          <h2 id="staff-slots-title">Time slots &amp; availability</h2>
          <p>Set the available tables for each time slot.</p>
        </div>
        <button type="button" className="staff-button staff-button--primary" onClick={onAdd}>
          <StaffIcon name="plus" />
          Add time slot
        </button>
      </div>

      {mealSlots.length === 0 ? (
        <p className="staff-empty">No time slots yet. Add the first one.</p>
      ) : (
        <div className="staff-slots-scroll">
          <table className="staff-slots">
            <thead>
              <tr>
                <th scope="col">Time slot</th>
                <th scope="col">Assigned tables</th>
                <th scope="col">Total seats</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {mealSlots.map((slot) => {
                const capacity = capacityBySlotId.get(slot.id);
                const assignedTables = capacity?.tables ?? [];

                return (
                  <tr key={slot.id} className={slot.isActive ? undefined : 'is-inactive'}>
                    <th scope="row">
                      <span className="staff-slot">
                        <StaffIcon name="clock" />
                        <span>
                          <span className="staff-slot__time">
                            {slot.startTime} – {slot.endTime}
                          </span>
                          <span className="staff-slot__name">
                            {slot.name}
                            {!slot.isActive && <span className="staff-badge">Inactive</span>}
                          </span>
                        </span>
                      </span>
                    </th>
                    <td>
                      {assignedTables.length === 0 ? (
                        <span className="staff-muted">No tables assigned</span>
                      ) : (
                        <ul className="staff-chips">
                          {assignedTables.map((table) => (
                            <li
                              key={table.id}
                              className={`staff-chip${table.isActive ? '' : ' is-inactive'}`}
                              title={table.isActive ? undefined : 'Inactive table: not counted'}
                            >
                              {table.name}
                            </li>
                          ))}
                        </ul>
                      )}
                    </td>
                    <td>
                      <span className="staff-seat-total">{capacity?.totalSeatCapacity ?? 0}</span>
                    </td>
                    <td>
                      <span className="staff-slot-actions">
                        <button
                          type="button"
                          className="staff-button staff-button--secondary"
                          onClick={() => onAssign(slot)}
                        >
                          <StaffIcon name="grid" />
                          Assign tables
                        </button>
                        <button
                          type="button"
                          className="staff-button staff-button--icon"
                          aria-label={`Edit ${slot.name}`}
                          onClick={() => onEdit(slot)}
                        >
                          <StaffIcon name="pencil" />
                        </button>
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
