import { useMemo, useState } from 'react';

/**
 * @typedef {import('../models/models.js').MealSlotDTO} MealSlotDTO
 * @typedef {import('../models/models.js').DiningTableDTO} DiningTableDTO
 * @typedef {import('../models/models.js').MealSlotInputDTO} MealSlotInputDTO
 * @typedef {import('../models/models.js').DiningTableInputDTO} DiningTableInputDTO
 * @typedef {import('../models/models.js').MealSlotCapacityDTO} MealSlotCapacityDTO
 */

/* TEMPORARY DATA */

// TEMPORARY: sample configuration kept in memory until the "Connect staff
// interface to capacity API" task loads and saves it through capacity-api.js.
// Changes are lost when the page is reloaded.

/** @type {MealSlotDTO[]} */
const TEMPORARY_MEAL_SLOTS = [
  { id: 1, name: 'Lunch 12:00', startTime: '12:00', endTime: '13:00', isActive: true },
  { id: 2, name: 'Lunch 13:00', startTime: '13:00', endTime: '14:00', isActive: true },
  { id: 3, name: 'Dinner 19:00', startTime: '19:00', endTime: '20:30', isActive: true },
];

/** @type {DiningTableDTO[]} */
const TEMPORARY_DINING_TABLES = [
  { id: 1, name: 'Table 1', seatCount: 4, isActive: true },
  { id: 2, name: 'Table 2', seatCount: 4, isActive: true },
  { id: 3, name: 'Table 3', seatCount: 6, isActive: true },
  { id: 4, name: 'Table 4', seatCount: 2, isActive: true },
  { id: 5, name: 'Terrace', seatCount: 8, isActive: false },
];

/** @type {Record<number, number[]>} */
const TEMPORARY_SLOT_TABLE_IDS = {
  1: [1, 2, 3],
  2: [1, 2],
  3: [1, 2, 3, 4],
};

/* HELPERS */

/**
 * @param {{ name: string }} first
 * @param {{ name: string }} second
 */
function compareByName(first, second) {
  return first.name.localeCompare(second.name, undefined, { numeric: true });
}

/**
 * @param {MealSlotDTO} first
 * @param {MealSlotDTO} second
 */
function compareByStartTime(first, second) {
  return first.startTime.localeCompare(second.startTime) || compareByName(first, second);
}

/**
 * @param {{ id: number }[]} items
 */
function nextId(items) {
  return Math.max(0, ...items.map((item) => item.id)) + 1;
}

/**
 * Mirrors the server rule: inactive tables stay assigned but add no seats.
 *
 * @param {MealSlotDTO} slot
 * @param {DiningTableDTO[]} sortedTables
 * @param {number[]} tableIds
 * @returns {MealSlotCapacityDTO}
 */
function buildCapacity(slot, sortedTables, tableIds) {
  const tables = sortedTables.filter((table) => tableIds.includes(table.id));

  return {
    slotId: slot.id,
    slotName: slot.name,
    tables,
    totalSeatCapacity: tables.reduce(
      (total, table) => total + (table.isActive ? table.seatCount : 0),
      0,
    ),
  };
}

/* HOOK */

/**
 * Staff configuration of meal slots, dining tables, and slot assignments.
 * Actions are asynchronous so they can be backed by the capacity API.
 */
export function useStaffCapacity() {
  const [mealSlots, setMealSlots] = useState(TEMPORARY_MEAL_SLOTS);
  const [diningTables, setDiningTables] = useState(TEMPORARY_DINING_TABLES);
  const [slotTableIds, setSlotTableIds] = useState(TEMPORARY_SLOT_TABLE_IDS);

  const sortedMealSlots = useMemo(
    () => [...mealSlots].sort(compareByStartTime),
    [mealSlots],
  );

  const sortedDiningTables = useMemo(
    () => [...diningTables].sort(compareByName),
    [diningTables],
  );

  const capacityBySlotId = useMemo(
    () =>
      new Map(
        sortedMealSlots.map((slot) => [
          slot.id,
          buildCapacity(slot, sortedDiningTables, slotTableIds[slot.id] ?? []),
        ]),
      ),
    [sortedMealSlots, sortedDiningTables, slotTableIds],
  );

  /**
   * Creates a meal slot, or updates it when its ID is given.
   *
   * @param {MealSlotInputDTO} input
   * @param {number} [slotId]
   * @returns {Promise<MealSlotDTO>}
   */
  async function saveMealSlot(input, slotId) {
    /** @type {MealSlotDTO} */
    const mealSlot = {
      ...input,
      id: slotId ?? nextId(mealSlots),
      isActive: input.isActive ?? true,
    };

    setMealSlots((current) =>
      slotId === undefined
        ? [...current, mealSlot]
        : current.map((slot) => (slot.id === slotId ? mealSlot : slot)),
    );

    return mealSlot;
  }

  /**
   * Creates a dining table, or updates it when its ID is given.
   *
   * @param {DiningTableInputDTO} input
   * @param {number} [tableId]
   * @returns {Promise<DiningTableDTO>}
   */
  async function saveDiningTable(input, tableId) {
    /** @type {DiningTableDTO} */
    const diningTable = {
      ...input,
      id: tableId ?? nextId(diningTables),
      isActive: input.isActive ?? true,
    };

    setDiningTables((current) =>
      tableId === undefined
        ? [...current, diningTable]
        : current.map((table) => (table.id === tableId ? diningTable : table)),
    );

    return diningTable;
  }

  /**
   * Replaces the complete set of tables assigned to a meal slot.
   *
   * @param {MealSlotDTO} slot
   * @param {number[]} tableIds
   * @returns {Promise<MealSlotCapacityDTO>}
   */
  async function saveSlotTables(slot, tableIds) {
    setSlotTableIds((current) => ({ ...current, [slot.id]: tableIds }));

    return buildCapacity(slot, sortedDiningTables, tableIds);
  }

  return {
    mealSlots: sortedMealSlots,
    diningTables: sortedDiningTables,
    capacityBySlotId,
    saveMealSlot,
    saveDiningTable,
    saveSlotTables,
  };
}
