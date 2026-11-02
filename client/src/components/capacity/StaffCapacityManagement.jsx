import { useState } from 'react';

import { useStaffCapacity } from '../../hooks/useStaffCapacity.js';
import AssignTablesModal from './AssignTablesModal.jsx';
import CapacityFormModal from './CapacityFormModal.jsx';
import { formatCount } from './formatCount.js';
import StaffDateSelector from './StaffDateSelector.jsx';
import StaffHeader from './StaffHeader.jsx';
import StaffIcon from './StaffIcons.jsx';
import StaffSidebar from './StaffSidebar.jsx';
import StaffTablesPanel from './StaffTablesPanel.jsx';
import StaffTimeSlotsPanel from './StaffTimeSlotsPanel.jsx';

/**
 * @typedef {import('../../models/models.js').MealSlotDTO} MealSlotDTO
 * @typedef {import('../../models/models.js').DiningTableDTO} DiningTableDTO
 * @typedef {import('../../models/models.js').MealSlotInputDTO} MealSlotInputDTO
 * @typedef {import('../../models/models.js').DiningTableInputDTO} DiningTableInputDTO
 * @typedef {import('./StaffHeader.jsx').StaffUser} StaffUser
 *
 * @typedef {(
 *   | { type: 'table', table?: DiningTableDTO }
 *   | { type: 'slot', slot?: MealSlotDTO }
 *   | { type: 'assign', slot: MealSlotDTO }
 * )} OpenModal
 */

/**
 * @param {{ id: number, name: string }[]} items
 * @param {number} [excludedId]
 */
function namesExcept(items, excludedId) {
  return items.filter((item) => item.id !== excludedId).map((item) => item.name);
}

/**
 * Staff interface to configure meal slots, dining tables, and the tables
 * assigned to each slot.
 *
 * Permissions mirror the server (requireStaff on every /api/capacity route):
 * employees and wardens can create, edit, and assign; hikers have no access.
 * The user stories define no deletion: tables and slots are deactivated.
 *
 * @param {{ user: StaffUser, onLogout: () => void }} props
 */
export default function StaffCapacityManagement({ user, onLogout }) {
  const {
    mealSlots,
    diningTables,
    capacityBySlotId,
    saveMealSlot,
    saveDiningTable,
    saveSlotTables,
  } = useStaffCapacity();

  const [openModal, setOpenModal] = useState(/** @type {OpenModal | null} */ (null));
  const [notice, setNotice] = useState('');

  /**
   * @param {OpenModal} modal
   */
  function showModal(modal) {
    setNotice('');
    setOpenModal(modal);
  }

  function closeModal() {
    setOpenModal(null);
  }

  /**
   * @param {DiningTableInputDTO} input
   * @param {DiningTableDTO} [table]
   */
  async function handleSaveTable(input, table) {
    const savedTable = await saveDiningTable(input, table?.id);

    closeModal();
    setNotice(`Table "${savedTable.name}" ${table ? 'updated' : 'added'}.`);
  }

  /**
   * @param {MealSlotInputDTO} input
   * @param {MealSlotDTO} [slot]
   */
  async function handleSaveSlot(input, slot) {
    const savedSlot = await saveMealSlot(input, slot?.id);

    closeModal();
    setNotice(`Time slot "${savedSlot.name}" ${slot ? 'updated' : 'added'}.`);
  }

  /**
   * @param {MealSlotDTO} slot
   * @param {number[]} tableIds
   */
  async function handleSaveAssignment(slot, tableIds) {
    const capacity = await saveSlotTables(slot, tableIds);

    closeModal();
    setNotice(
      `"${slot.name}" now has ${formatCount(capacity.tables.length, 'table')} ` +
        `and ${formatCount(capacity.totalSeatCapacity, 'seat')}.`,
    );
  }

  return (
    <div className="staff-layout">
      <StaffSidebar onLogout={onLogout} />

      <main className="staff-main">
        <StaffHeader
          user={user}
          title="Tables & Time Slots"
          description="Define your tables and the number of available seats for each time slot."
        />

        <StaffDateSelector />

        <div className="staff-notice-region" role="status">
          {notice && (
            <div className="staff-notice">
              <span>{notice}</span>
              <button
                type="button"
                className="staff-button staff-button--icon"
                aria-label="Dismiss message"
                onClick={() => setNotice('')}
              >
                <StaffIcon name="close" />
              </button>
            </div>
          )}
        </div>

        <div className="staff-panels">
          <StaffTablesPanel
            tables={diningTables}
            onAdd={() => showModal({ type: 'table' })}
            onEdit={(table) => showModal({ type: 'table', table })}
          />
          <StaffTimeSlotsPanel
            mealSlots={mealSlots}
            capacityBySlotId={capacityBySlotId}
            onAdd={() => showModal({ type: 'slot' })}
            onEdit={(slot) => showModal({ type: 'slot', slot })}
            onAssign={(slot) => showModal({ type: 'assign', slot })}
          />
        </div>
      </main>

      {openModal?.type === 'table' && (
        <CapacityFormModal
          kind="table"
          item={openModal.table}
          takenNames={namesExcept(diningTables, openModal.table?.id)}
          onSubmit={(input) => handleSaveTable(input, openModal.table)}
          onClose={closeModal}
        />
      )}

      {openModal?.type === 'slot' && (
        <CapacityFormModal
          kind="slot"
          item={openModal.slot}
          takenNames={namesExcept(mealSlots, openModal.slot?.id)}
          onSubmit={(input) => handleSaveSlot(input, openModal.slot)}
          onClose={closeModal}
        />
      )}

      {openModal?.type === 'assign' && (
        <AssignTablesModal
          slot={openModal.slot}
          tables={diningTables}
          assignedTableIds={
            capacityBySlotId.get(openModal.slot.id)?.tables.map((table) => table.id) ?? []
          }
          onSubmit={(tableIds) => handleSaveAssignment(openModal.slot, tableIds)}
          onClose={closeModal}
        />
      )}
    </div>
  );
}
