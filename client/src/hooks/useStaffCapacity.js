import { useEffect, useState } from 'react';

import CapacityAPI from '../API/capacity-api.js';

/**
 * API data types used by the capacity configuration.
 *
 * @typedef {import('../models/models.js').MealSlotDTO} MealSlotDTO
 * @typedef {import('../models/models.js').DiningTableDTO} DiningTableDTO
 * @typedef {import('../models/models.js').MealSlotInputDTO} MealSlotInputDTO
 * @typedef {import('../models/models.js').DiningTableInputDTO} DiningTableInputDTO
 * @typedef {import('../API/capacity-api.js').ConfiguredMealSlot} ConfiguredMealSlot
 */

// Default values for creating or resetting a meal-slot form.
/** @type {MealSlotInputDTO & { isActive: boolean }} */
const emptySlotForm = {
  slotDate: '',
  name: '',
  startTime: '',
  endTime: '',
  isActive: true,
};

// Keep the seat count as text while the user edits the table form.
const emptyTableForm = {
  name: '',
  seatCount: '',
  isActive: true,
};

/**
 * Extracts an error message or provides a fallback.
 *
 * @param {unknown} error
 * @returns {string}
 */
function getErrorMessage(error) {
  return error instanceof Error
    ? error.message
    : 'An unexpected error occurred.';
}

/**
 * Returns today's calendar date in the hut's time zone.
 */
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

// Manage staff capacity data, forms, modal visibility, and table assignments.
export default function useStaffCapacity() {
  // Start with today's date in the hut's time zone.
  const [selectedDate, setSelectedDate] = useState(
    getTodayInHutTimeZone
  );

  // Store configured meal slots and reusable dining tables.
  const [mealSlots, setMealSlots] = useState(
    /** @type {ConfiguredMealSlot[]} */ ([]),
  );

  const [diningTables, setDiningTables] = useState(
    /** @type {DiningTableDTO[]} */ ([]),
  );

  // Track the slot and table selection used by the assignment modal.
  const [selectedSlotId, setSelectedSlotId] = useState('');

  const [selectedTableIds, setSelectedTableIds] = useState(
    /** @type {number[]} */ ([]),
  );

  const [usePreviousTableConfiguration, setUsePreviousTableConfiguration] =
    useState(false);

  // Store the values currently displayed in the configuration forms.
  const [slotForm, setSlotForm] = useState(emptySlotForm);
  const [tableForm, setTableForm] = useState(emptyTableForm);

  // A null editing ID indicates that the form creates a new record.
  const [editingSlotId, setEditingSlotId] = useState(
    /** @type {number | null} */ (null),
  );

  const [editingTableId, setEditingTableId] = useState(
    /** @type {number | null} */ (null),
  );

  // Control the visibility of the slot, table, and assignment modals.
  const [isSlotModalOpen, setIsSlotModalOpen] = useState(false);
  const [isTableModalOpen, setIsTableModalOpen] = useState(false);
  const [isAssignmentModalOpen, setIsAssignmentModalOpen] =
    useState(false);

  // Track messages and pending load or save operations.
  const [errorMessage, setErrorMessage] = useState('');
  const [feedbackMessage, setFeedbackMessage] = useState('');

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Show only slots for the selected date, ordered by start time and ID.
  const visibleMealSlots = mealSlots
    .filter((slot) => slot.slotDate === selectedDate)
    .sort(
      (first, second) =>
        first.startTime.localeCompare(second.startTime) ||
        first.id - second.id
    );

  // Resolve the slot currently selected for table assignment.
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
    // Inactive tables cannot contribute bookable seats.
    if (!table.isActive) {
      return 'Inactive table';
    }

    // Overlap checks apply only when the selected slot is active.
    if (!selectedSlot || !selectedSlot.isActive) {
      return '';
    }

    // Find another active slot using the same table at overlapping times.
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

    // Include the conflicting service and time range in the explanation.
    return (
      `Already assigned to ${conflictingSlot.name}, ` +
      `${conflictingSlot.startTime}–${conflictingSlot.endTime}`
    );
  }

  // Synchronize the table selection when the selected slot object changes.
  const [previousSelectedSlot, setPreviousSelectedSlot] =
    useState(selectedSlot);

  if (selectedSlot !== previousSelectedSlot) {
    setPreviousSelectedSlot(selectedSlot);
    setSelectedTableIds(selectedSlot?.tableIds ?? []);
  }

  // Derive active records and the total capacity of all active tables.
  const activeSlots = mealSlots.filter((slot) => slot.isActive);
  const activeTables = diningTables.filter((table) => table.isActive);

  const totalActiveSeats = activeTables.reduce(
    (total, table) => total + table.seatCount,
    0,
  );

  /**
   * Checks whether a table is included in the current selection.
   *
   * @param {number} tableId
   */
  const isTableSelected = (tableId) =>
    selectedTableIds.some((id) => String(id) === String(tableId));

  // Count seats only from selected tables that are active.
  const assignedCapacity = diningTables.reduce(
    (total, table) =>
      isTableSelected(table.id) && table.isActive
        ? total + table.seatCount
        : total,
    0,
  );

  /**
   * Returns the number of table IDs assigned to a slot.
   *
   * @param {ConfiguredMealSlot} slot
   */
  const getSlotTableCount = (slot) => slot.tableIds.length;

  /**
   * Calculates a slot's capacity using its assigned active tables.
   *
   * @param {ConfiguredMealSlot} slot
   */
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

  // Load configuration on mount and ignore results after unmounting.
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

          // Select the first loaded slot when configuration is available.
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

  /**
   * Updates a slot field, preserving boolean values for checkboxes.
   *
   * @param {import('react').ChangeEvent<HTMLInputElement>} event
   */
  function updateSlotField(event) {
    const { name, value, type, checked } = event.target;

    setSlotForm((current) => ({
      ...current,
      [name]: type === 'checkbox' ? checked : value,
    }));
  }

  /**
   * Updates a table field, preserving boolean values for checkboxes.
   *
   * @param {import('react').ChangeEvent<HTMLInputElement>} event
   */
  function updateTableField(event) {
    const { name, value, type, checked } = event.target;

    setTableForm((current) => ({
      ...current,
      [name]: type === 'checkbox' ? checked : value,
    }));
  }

  // Open a new slot form using the currently selected date.
  function openNewSlotForm() {
    setEditingSlotId(null);
    setUsePreviousTableConfiguration(
      mealSlots.some((slot) => slot.tableIds.length > 0),
    );

    setSlotForm({
      ...emptySlotForm,
      slotDate: selectedDate,
    });

    setErrorMessage('');
    setIsSlotModalOpen(true);
  }

  function togglePreviousTableConfiguration() {
    setUsePreviousTableConfiguration((current) => !current);
  }

  // Open an empty form for creating a reusable dining table.
  function openNewTableForm() {
    setEditingTableId(null);
    setTableForm(emptyTableForm);
    setErrorMessage('');
    setIsTableModalOpen(true);
  }

  /**
   * Populate the slot form with an existing slot's values.
   *
   * @param {MealSlotDTO} slot
   */
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

  /**
   * Populate the table form with an existing table's values.
   *
   * @param {DiningTableDTO} table
   */
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

  /**
   * Open the assignment modal with the slot's existing table selection.
   *
   * @param {ConfiguredMealSlot} slot
   */
  function openAssignmentModal(slot) {
    setSelectedSlotId(String(slot.id));
    setSelectedTableIds(slot.tableIds);
    setErrorMessage('');
    setFeedbackMessage('');
    setIsAssignmentModalOpen(true);
  }

  /**
   * Validate and save a new or existing meal slot.
   *
   * @param {import('react').SubmitEvent<HTMLFormElement>} event
   */
  async function handleSlotSubmit(event) {
    event.preventDefault();

    setErrorMessage('');
    setFeedbackMessage('');

    // Require a service name before contacting the server.
    if (!slotForm.name.trim()) {
      setErrorMessage('Enter a name for the meal slot.');

      return;
    }

    // Require an end time later than the start time.
    if (
      !slotForm.startTime ||
      !slotForm.endTime ||
      slotForm.endTime <= slotForm.startTime
    ) {
      setErrorMessage('Choose a valid start time and a later end time.');

      return;
    }

    // Remove surrounding whitespace from the service name.
    const mealSlotData = {
      ...slotForm,
      name: slotForm.name.trim(),
    };

    setIsSaving(true);

    try {
      if (editingSlotId !== null) {
        // Update the slot while retaining its existing table assignments.
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
        // Create a slot first, then let the employee confirm its table assignment.
        const createdMealSlot =
          await CapacityAPI.createMealSlot(mealSlotData);

        const previousSlot = [...mealSlots]
          .reverse()
          .find((slot) => slot.tableIds.length > 0);
        const suggestedTableIds = usePreviousTableConfiguration
          ? (previousSlot?.tableIds ?? [])
          : [];

        /** @type {ConfiguredMealSlot} */
        const newMealSlot = {
          ...createdMealSlot,
          tableIds: suggestedTableIds,
        };

        setMealSlots((current) => [...current, newMealSlot]);
        setSelectedSlotId(String(newMealSlot.id));
        setSelectedTableIds(suggestedTableIds);
        setFeedbackMessage('Meal slot added successfully.');
      }

      // Close and reset the form only after a successful save.
      setIsSlotModalOpen(false);
      setEditingSlotId(null);
      setSlotForm(emptySlotForm);
      setUsePreviousTableConfiguration(false);
      if (editingSlotId === null && usePreviousTableConfiguration) {
        setIsAssignmentModalOpen(true);
      }
    } catch (error) {
      // Keep the form open so the user can correct or retry the request.
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  }

  /**
   * Validate and save a new or existing dining table.
   *
   * @param {import('react').SubmitEvent<HTMLFormElement>} event
   */
  async function handleTableSubmit(event) {
    event.preventDefault();

    setErrorMessage('');
    setFeedbackMessage('');

    // Convert the input text to a number before validating the seat count.
    const seatCount = Number(tableForm.seatCount);

    if (!tableForm.name.trim()) {
      setErrorMessage('Enter a name for the dining table.');

      return;
    }

    if (!Number.isInteger(seatCount) || seatCount <= 0) {
      setErrorMessage('Seat count must be a positive whole number.');

      return;
    }

    // Prepare the normalized table data expected by the API.
    /** @type {DiningTableInputDTO & { isActive: boolean }} */
    const diningTableData = {
      ...tableForm,
      name: tableForm.name.trim(),
      seatCount,
    };

    setIsSaving(true);

    try {
      if (editingTableId !== null) {
        // Replace the edited table with the record returned by the server.
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
        // Add the newly created table to the reusable table list.
        const createdDiningTable =
          await CapacityAPI.createDiningTable(diningTableData);

        setDiningTables((current) => [...current, createdDiningTable]);
        setFeedbackMessage('Dining table added successfully.');
      }

      // Close and reset the form only after a successful save.
      setIsTableModalOpen(false);
      setEditingTableId(null);
      setTableForm(emptyTableForm);
    } catch (error) {
      // Preserve the entered values when the server rejects the save.
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  }

  /**
   * Add or remove a table from the unsaved assignment selection.
   *
   * @param {number} tableId
   */
  function toggleTableAssignment(tableId) {
    setSelectedTableIds((current) =>
      current.some((id) => String(id) === String(tableId))
        ? current.filter((id) => String(id) !== String(tableId))
        : [...current, tableId],
    );
  }

  /**
   * Select or clear all tables currently shown in the assignment list.
   *
   * @param {number[]} tableIds
   * @param {boolean} selectAll
   */
  function toggleAllTableAssignments(tableIds, selectAll) {
    setSelectedTableIds((current) => {
      if (!selectAll) {
        return current.filter(
          (id) => !tableIds.some((tableId) => String(tableId) === String(id)),
        );
      }

      return [
        ...current,
        ...tableIds.filter(
          (tableId) =>
            !current.some((id) => String(id) === String(tableId)),
        ),
      ];
    });
  }

  // Save the selected tables as the complete assignment for the chosen slot.
  async function saveAssignments() {
    // Require a selected slot before submitting table assignments.
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

      // Use the server response as the saved assignment.
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
      // Keep the modal open when assignments cannot be saved.
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  }

  /**
   * Change the displayed date and clear slot-related forms and selections.
   *
   * @param {string} value
   */
  function changeSelectedDate(value) {
    // Avoid changing the date during a save or to an empty value.
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

  // Expose configuration data, derived values, forms, and actions to components.
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
    usePreviousTableConfiguration,
    togglePreviousTableConfiguration,
    openNewTableForm,
    startEditingSlot,
    startEditingTable,
    openAssignmentModal,
    handleSlotSubmit,
    handleTableSubmit,
    toggleTableAssignment,
    toggleAllTableAssignments,
    saveAssignments,
    closeSlotModal: () => setIsSlotModalOpen(false),
    closeTableModal: () => setIsTableModalOpen(false),
    closeAssignmentModal: () => setIsAssignmentModalOpen(false),
  };
}