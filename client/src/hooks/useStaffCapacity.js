import { useEffect, useState } from 'react';

import CapacityAPI from '../API/capacity-api.js';


/**
 * @typedef {import('../models/models.js').MealSlotDTO} MealSlotDTO
 * @typedef {import('../models/models.js').DiningTableDTO} DiningTableDTO
 * @typedef {import('../models/models.js').MealSlotInputDTO} MealSlotInputDTO
 * @typedef {import('../models/models.js').DiningTableInputDTO} DiningTableInputDTO
 * @typedef {import('../API/capacity-api.js').ConfiguredMealSlot} ConfiguredMealSlot
 */

/** @type {MealSlotInputDTO & { isActive: boolean }} */
const emptySlotForm = {
  slotDate: '',
  name: '',
  startTime: '',
  endTime: '',
  isActive: true,
};

const emptyTableForm = {
  name: '',
  seatCount: '',
  isActive: true,
};

/**
 * @param {unknown} error
 * @returns {string}
 */
function getErrorMessage(error) {
  return error instanceof Error
    ? error.message
    : 'An unexpected error occurred.';
}

/** Returns today's date in the hut's time zone. */
function getTodayInHutTimeZone() {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Rome',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());

  /** @param {Intl.DateTimeFormatPartTypes} type */
  const value = (type) =>
    parts.find((part) => part.type === type)?.value;

  return `${value('year')}-${value('month')}-${value('day')}`;
}

export default function useStaffCapacity() {

  const [selectedDate, setSelectedDate] = useState(
    getTodayInHutTimeZone
  );

  const [mealSlots, setMealSlots] = useState(
    /** @type {ConfiguredMealSlot[]} */ ([]),
  );

  const [diningTables, setDiningTables] = useState(
    /** @type {DiningTableDTO[]} */ ([]),
  );

  const [selectedSlotId, setSelectedSlotId] = useState('');

  const [selectedTableIds, setSelectedTableIds] = useState(
    /** @type {number[]} */ ([]),
  );

  const [slotForm, setSlotForm] = useState(emptySlotForm);
  const [tableForm, setTableForm] = useState(emptyTableForm);

  const [editingSlotId, setEditingSlotId] = useState(
    /** @type {number | null} */ (null),
  );

  const [editingTableId, setEditingTableId] = useState(
    /** @type {number | null} */ (null),
  );

  const [isSlotModalOpen, setIsSlotModalOpen] = useState(false);
  const [isTableModalOpen, setIsTableModalOpen] = useState(false);
  const [isAssignmentModalOpen, setIsAssignmentModalOpen] =
    useState(false);

  const [errorMessage, setErrorMessage] = useState('');
  const [feedbackMessage, setFeedbackMessage] = useState('');

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const visibleMealSlots = mealSlots
  .filter((slot) => slot.slotDate === selectedDate)
  .sort(
    (first, second) =>
      first.startTime.localeCompare(second.startTime) ||
      first.id - second.id
  );

  const selectedSlot = mealSlots.find(
    (slot) => String(slot.id) === selectedSlotId,
  );

  /**
 * Returns an empty string when the table can be assigned,
 * otherwise the reason why it is unavailable.
 *
 * @param {DiningTableDTO} table
 * @returns {string}
 */
function getTableUnavailableReason(table) {
  if (!table.isActive) {
    return 'Inactive table';
  }

  if (!selectedSlot || !selectedSlot.isActive) {
    return '';
  }

  const conflictingSlot = mealSlots.find((slot) =>
      slot.id !== selectedSlot.id &&
      slot.slotDate === selectedSlot.slotDate &&
      slot.isActive &&
      slot.startTime < selectedSlot.endTime &&
      slot.endTime > selectedSlot.startTime &&
      slot.tableIds.includes(table.id)
    );

    if (!conflictingSlot) {
      return '';
    }

    return (
      `Already assigned to ${conflictingSlot.name}, ` +
      `${conflictingSlot.startTime}–${conflictingSlot.endTime}`
    );
  }

  const [previousSelectedSlot, setPreviousSelectedSlot] =
    useState(selectedSlot);

  if (selectedSlot !== previousSelectedSlot) {
    setPreviousSelectedSlot(selectedSlot);
    setSelectedTableIds(selectedSlot?.tableIds ?? []);
  }

  const activeSlots = mealSlots.filter((slot) => slot.isActive);
  const activeTables = diningTables.filter((table) => table.isActive);

  const totalActiveSeats = activeTables.reduce(
    (total, table) => total + table.seatCount,
    0,
  );

  /** @param {number} tableId */
  const isTableSelected = (tableId) =>
    selectedTableIds.some((id) => String(id) === String(tableId));

  const assignedCapacity = diningTables.reduce(
    (total, table) =>
      isTableSelected(table.id) && table.isActive
        ? total + table.seatCount
        : total,
    0,
  );

  /** @param {ConfiguredMealSlot} slot */
  const getSlotTableCount = (slot) => slot.tableIds.length;

  /** @param {ConfiguredMealSlot} slot */
  const getSlotCapacity = (slot) =>
    diningTables.reduce(
      (total, table) =>
        slot.tableIds.some(
          (id) => String(id) === String(table.id),
        ) && table.isActive
          ? total + table.seatCount
          : total,
      0,
    );

  useEffect(() => {
    let isMounted = true;

    CapacityAPI.getConfiguration()
      .then(
        ({
          mealSlots: loadedMealSlots,
          diningTables: loadedDiningTables,
        }) => {
          if (!isMounted) return;

          setMealSlots(loadedMealSlots);
          setDiningTables(loadedDiningTables);

          setSelectedSlotId(
            loadedMealSlots.length > 0
              ? String(loadedMealSlots[0].id)
              : '',
          );
        },
      )
      .catch((error) => {
        if (isMounted) {
          setErrorMessage(getErrorMessage(error));
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  /** @param {import('react').ChangeEvent<HTMLInputElement>} event */
  function updateSlotField(event) {
    const { name, value, type, checked } = event.target;

    setSlotForm((current) => ({
      ...current,
      [name]: type === 'checkbox' ? checked : value,
    }));
  }

  /** @param {import('react').ChangeEvent<HTMLInputElement>} event */
  function updateTableField(event) {
    const { name, value, type, checked } = event.target;

    setTableForm((current) => ({
      ...current,
      [name]: type === 'checkbox' ? checked : value,
    }));
  }

  function openNewSlotForm() {
    setEditingSlotId(null);
    setSlotForm({
      ...emptySlotForm,
      slotDate: selectedDate,
    });
    setErrorMessage('');
    setIsSlotModalOpen(true);
  }

  function openNewTableForm() {
    setEditingTableId(null);
    setTableForm(emptyTableForm);
    setErrorMessage('');
    setIsTableModalOpen(true);
  }

  /** @param {MealSlotDTO} slot */
  function startEditingSlot(slot) {
    setEditingSlotId(slot.id);

    setSlotForm({
      slotDate: slot.slotDate,
      name: slot.name,
      startTime: slot.startTime,
      endTime: slot.endTime,
      isActive: slot.isActive,
    });

    setErrorMessage('');
    setIsSlotModalOpen(true);
  }

  /** @param {DiningTableDTO} table */
  function startEditingTable(table) {
    setEditingTableId(table.id);

    setTableForm({
      name: table.name,
      seatCount: String(table.seatCount),
      isActive: table.isActive,
    });

    setErrorMessage('');
    setIsTableModalOpen(true);
  }

  /** @param {ConfiguredMealSlot} slot */
  function openAssignmentModal(slot) {
    setSelectedSlotId(String(slot.id));
    setSelectedTableIds(slot.tableIds);
    setErrorMessage('');
    setFeedbackMessage('');
    setIsAssignmentModalOpen(true);
  }

  /** @param {import('react').SubmitEvent<HTMLFormElement>} event */
  async function handleSlotSubmit(event) {
    event.preventDefault();

    setErrorMessage('');
    setFeedbackMessage('');

    if (!slotForm.name.trim()) {
      setErrorMessage('Enter a name for the meal slot.');

      return;
    }

    if (
      !slotForm.startTime ||
      !slotForm.endTime ||
      slotForm.endTime <= slotForm.startTime
    ) {
      setErrorMessage('Choose a valid start time and a later end time.');

      return;
    }

    const mealSlotData = {
      ...slotForm,
      name: slotForm.name.trim(),
    };

    setIsSaving(true);

    try {
      if (editingSlotId !== null) {
        const updatedMealSlot = await CapacityAPI.updateMealSlot(
          editingSlotId,
          mealSlotData,
        );

        setMealSlots((current) =>
          current.map((slot) =>
            slot.id === editingSlotId
              ? {
                  ...updatedMealSlot,
                  tableIds: slot.tableIds,
                }
              : slot,
          ),
        );

        setFeedbackMessage('Meal slot updated successfully.');
      } else {
        const createdMealSlot =
          await CapacityAPI.createMealSlot(mealSlotData);

        /** @type {ConfiguredMealSlot} */
        const newMealSlot = {
          ...createdMealSlot,
          tableIds: [],
        };

        setMealSlots((current) => [...current, newMealSlot]);
        setSelectedSlotId(String(newMealSlot.id));
        setFeedbackMessage('Meal slot added successfully.');
      }

      setIsSlotModalOpen(false);
      setEditingSlotId(null);
      setSlotForm(emptySlotForm);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  }

  /** @param {import('react').SubmitEvent<HTMLFormElement>} event */
  async function handleTableSubmit(event) {
    event.preventDefault();

    setErrorMessage('');
    setFeedbackMessage('');

    const seatCount = Number(tableForm.seatCount);

    if (!tableForm.name.trim()) {
      setErrorMessage('Enter a name for the dining table.');

      return;
    }

    if (!Number.isInteger(seatCount) || seatCount <= 0) {
      setErrorMessage('Seat count must be a positive whole number.');

      return;
    }

    /** @type {DiningTableInputDTO & { isActive: boolean }} */
    const diningTableData = {
      ...tableForm,
      name: tableForm.name.trim(),
      seatCount,
    };

    setIsSaving(true);

    try {
      if (editingTableId !== null) {
        const updatedDiningTable = await CapacityAPI.updateDiningTable(
          editingTableId,
          diningTableData,
        );

        setDiningTables((current) =>
          current.map((table) =>
            table.id === editingTableId ? updatedDiningTable : table,
          ),
        );

        setFeedbackMessage('Dining table updated successfully.');
      } else {
        const createdDiningTable =
          await CapacityAPI.createDiningTable(diningTableData);

        setDiningTables((current) => [...current, createdDiningTable]);
        setFeedbackMessage('Dining table added successfully.');
      }

      setIsTableModalOpen(false);
      setEditingTableId(null);
      setTableForm(emptyTableForm);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  }

  /** @param {number} tableId */
  function toggleTableAssignment(tableId) {
    setSelectedTableIds((current) =>
      current.some((id) => String(id) === String(tableId))
        ? current.filter((id) => String(id) !== String(tableId))
        : [...current, tableId],
    );
  }

  async function saveAssignments() {
    if (!selectedSlot) {
      setErrorMessage('Choose a meal service before assigning tables.');

      return;
    }

    setErrorMessage('');
    setFeedbackMessage('');
    setIsSaving(true);

    try {
      const capacity = await CapacityAPI.saveMealSlotTables(
        Number(selectedSlotId),
        selectedTableIds,
      );

      const savedTableIds = capacity.tables.map((table) => table.id);

      setMealSlots((current) =>
        current.map((slot) =>
          String(slot.id) === selectedSlotId
            ? { ...slot, tableIds: savedTableIds }
            : slot,
        ),
      );

      setSelectedTableIds(savedTableIds);
      setFeedbackMessage('Table assignments saved successfully.');
      setIsAssignmentModalOpen(false);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  }

  /** @param {string} value */
  function changeSelectedDate(value) {
    if (isSaving || !value) return;

    setSelectedDate(value);
    setSelectedSlotId('');
    setSelectedTableIds([]);
    setEditingSlotId(null);
    setSlotForm(emptySlotForm);
    setIsSlotModalOpen(false);
    setIsAssignmentModalOpen(false);
    setErrorMessage('');
    setFeedbackMessage('');
  }

  return {
    mealSlots,
    diningTables,
    activeSlots,
    activeTables,
    totalActiveSeats,
    selectedSlot,
    selectedSlotId,
    selectedTableIds,
    isTableSelected,
    getTableUnavailableReason,
    selectedDate,
    visibleMealSlots,
    changeSelectedDate,
    assignedCapacity,
    slotForm,
    tableForm,
    editingSlotId,
    editingTableId,
    isSlotModalOpen,
    isTableModalOpen,
    isAssignmentModalOpen,
    errorMessage,
    feedbackMessage,
    isLoading,
    isSaving,
    getSlotTableCount,
    getSlotCapacity,
    updateSlotField,
    updateTableField,
    openNewSlotForm,
    openNewTableForm,
    startEditingSlot,
    startEditingTable,
    openAssignmentModal,
    handleSlotSubmit,
    handleTableSubmit,
    toggleTableAssignment,
    saveAssignments,
    closeSlotModal: () => setIsSlotModalOpen(false),
    closeTableModal: () => setIsTableModalOpen(false),
    closeAssignmentModal: () => setIsAssignmentModalOpen(false),
  };
}
