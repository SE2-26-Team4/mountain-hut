import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  getMealSlotMenu,
  getPreviousMealSlotMenus,
  MealSlotNotFoundError,
  saveMealSlotMenu,
} from "../../dao/menu-dao.js";

import { allAsync, getAsync, initializeDatabase, runAsync } from "../../db.js";

// Generate unique slot names for this file's fixtures.
const uniqueSuffix = `${Date.now()}-${Math.random()}`;

// Every slot created here, removed with its menu after the suite.
const createdSlotIds = [];

const isoTimestamp = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

/**
 * Inserts a slot without the capacity DAO's overlap checks,
 * so tests can create slots that share a date and start time.
 */
async function insertSlot(slotDate, name, startTime, endTime) {
  const result = await runAsync(
    `INSERT INTO meal_slots (slot_date, name, start_time, end_time)
     VALUES (?, ?, ?, ?)`,
    [slotDate, `${name} ${uniqueSuffix}`, startTime, endTime],
  );

  createdSlotIds.push(result.lastID);

  return result.lastID;
}

/**
 * Keeps only the given slots' menus, preserving the DAO's order.
 * The test database is shared, so other files may add earlier menus.
 */
function onlySlots(menus, slotIds) {
  return menus.filter((menu) => slotIds.includes(menu.slotId));
}

beforeAll(async () => {
  await initializeDatabase();
});

afterAll(async () => {
  if (createdSlotIds.length === 0) return;

  const placeholders = createdSlotIds.map(() => "?").join(", ");

  await runAsync(
    `DELETE FROM meal_slot_menus WHERE slot_id IN (${placeholders})`,
    createdSlotIds,
  );
  await runAsync(
    `DELETE FROM meal_slots WHERE id IN (${placeholders})`,
    createdSlotIds,
  );
});

describe("meal-slot menu persistence", () => {
  it("saves a menu for a slot and reads it back", async () => {
    const slotId = await insertSlot("2091-03-10", "Dinner", "19:00", "21:00");

    expect(await getMealSlotMenu(slotId)).toBeNull();

    const saved = await saveMealSlotMenu(slotId, "**Polenta**\n- Mountain cheese");

    expect(saved).toEqual({
      id: expect.any(Number),
      slotId,
      content: "**Polenta**\n- Mountain cheese",
      updatedAt: expect.stringMatching(isoTimestamp),
    });
    expect(await getMealSlotMenu(slotId)).toEqual(saved);
  });

  it("updates the slot's existing menu instead of adding another one", async () => {
    const slotId = await insertSlot("2091-03-11", "Lunch", "12:00", "14:00");
    const created = await saveMealSlotMenu(slotId, "Soup");

    // Backdate the first save so the update's timestamp change is visible.
    await runAsync(
      "UPDATE meal_slot_menus SET updated_at = ? WHERE id = ?",
      ["2000-01-01T00:00:00.000Z", created.id],
    );

    const updated = await saveMealSlotMenu(slotId, "Soup and salad");

    expect(updated).toEqual({
      id: created.id,
      slotId,
      content: "Soup and salad",
      updatedAt: expect.stringMatching(isoTimestamp),
    });
    expect(updated.updatedAt > "2000-01-01T00:00:00.000Z").toBe(true);

    const rows = await allAsync(
      "SELECT id FROM meal_slot_menus WHERE slot_id = ?",
      [slotId],
    );

    expect(rows).toEqual([{ id: created.id }]);
  });

  it("keeps each menu associated with its own slot", async () => {
    const lunchId = await insertSlot("2091-03-12", "Lunch", "12:00", "14:00");
    const dinnerId = await insertSlot("2091-03-12", "Dinner", "19:00", "21:00");

    const lunch = await saveMealSlotMenu(lunchId, "Lunch menu");
    const dinner = await saveMealSlotMenu(dinnerId, "Dinner menu");

    expect(dinner.id).not.toBe(lunch.id);

    await saveMealSlotMenu(dinnerId, "Updated dinner menu");

    expect(await getMealSlotMenu(lunchId)).toEqual(lunch);
    expect(await getMealSlotMenu(dinnerId)).toMatchObject({
      id: dinner.id,
      slotId: dinnerId,
      content: "Updated dinner menu",
    });
  });

  it.each([
    ["reading", (slotId) => getMealSlotMenu(slotId)],
    ["saving", (slotId) => saveMealSlotMenu(slotId, "Soup")],
    ["listing previous menus for", (slotId) => getPreviousMealSlotMenus(slotId)],
  ])("rejects %s a missing slot", async (_, operation) => {
    const { missingId } = await getAsync(
      "SELECT COALESCE(MAX(id), 0) + 1 AS missingId FROM meal_slots",
    );

    const failure = operation(missingId);

    await expect(failure).rejects.toBeInstanceOf(MealSlotNotFoundError);
    await expect(failure).rejects.toMatchObject({
      code: "MEAL_SLOT_NOT_FOUND",
      slotId: missingId,
    });

    expect(
      await getAsync(
        "SELECT COUNT(*) AS count FROM meal_slot_menus WHERE slot_id = ?",
        [missingId],
      ),
    ).toEqual({ count: 0 });
  });
});

describe("previous menu lookup", () => {
  it("returns menus of earlier slots, most recent first", async () => {
    const targetId = await insertSlot("2091-05-10", "Dinner", "19:00", "21:00");
    const sameDayLunchId = await insertSlot("2091-05-10", "Lunch", "12:00", "14:00");
    const sameDayLaterId = await insertSlot("2091-05-10", "Late snack", "21:00", "22:00");
    const dayBeforeId = await insertSlot("2091-05-09", "Dinner", "19:00", "21:00");
    const withoutMenuId = await insertSlot("2091-05-08", "Breakfast", "08:00", "09:00");
    const blankMenuId = await insertSlot("2091-05-07", "Dinner", "19:00", "21:00");
    const weekBeforeId = await insertSlot("2091-05-03", "Lunch", "12:00", "14:00");
    const nextDayId = await insertSlot("2091-05-11", "Lunch", "12:00", "14:00");

    await saveMealSlotMenu(targetId, "Target menu");
    await saveMealSlotMenu(sameDayLunchId, "Same-day lunch");
    await saveMealSlotMenu(sameDayLaterId, "Same-day snack");
    await saveMealSlotMenu(dayBeforeId, "Day-before dinner");
    await saveMealSlotMenu(blankMenuId, " \n\t ");
    await saveMealSlotMenu(weekBeforeId, "Week-before lunch");
    await saveMealSlotMenu(nextDayId, "Next-day lunch");

    const previous = onlySlots(await getPreviousMealSlotMenus(targetId), [
      targetId,
      sameDayLunchId,
      sameDayLaterId,
      dayBeforeId,
      withoutMenuId,
      blankMenuId,
      weekBeforeId,
      nextDayId,
    ]);

    expect(previous.map((menu) => menu.slotId)).toEqual([
      sameDayLunchId,
      dayBeforeId,
      weekBeforeId,
    ]);
    expect(previous[0]).toEqual({
      id: expect.any(Number),
      slotId: sameDayLunchId,
      content: "Same-day lunch",
      updatedAt: expect.stringMatching(isoTimestamp),
      slotName: `Lunch ${uniqueSuffix}`,
      slotDate: "2091-05-10",
      startTime: "12:00",
      endTime: "14:00",
    });
  });

  it("orders slots sharing a date and start time by slot ID", async () => {
    const targetId = await insertSlot("2091-07-10", "Dinner", "19:00", "21:00");
    const firstId = await insertSlot("2091-07-09", "Dinner A", "19:00", "21:00");
    const secondId = await insertSlot("2091-07-09", "Dinner B", "19:00", "20:30");

    // Save in reverse ID order so the result cannot follow save time.
    await saveMealSlotMenu(secondId, "Second slot menu");
    await saveMealSlotMenu(firstId, "First slot menu");

    const lookup = async () =>
      onlySlots(await getPreviousMealSlotMenus(targetId), [firstId, secondId])
        .map((menu) => menu.slotId);

    expect(await lookup()).toEqual([secondId, firstId]);
    expect(await lookup()).toEqual([secondId, firstId]);
  });

  it("returns an empty list when no earlier slot has a menu", async () => {
    const slotId = await insertSlot("1900-01-01", "Breakfast", "07:00", "08:00");

    expect(await getPreviousMealSlotMenus(slotId)).toEqual([]);
  });

  it("leaves the source menu intact when reused text is edited", async () => {
    const sourceId = await insertSlot("2091-09-09", "Dinner", "19:00", "21:00");
    const targetId = await insertSlot("2091-09-10", "Dinner", "19:00", "21:00");

    const sourceMenu = await saveMealSlotMenu(
      sourceId,
      "**Gnocchi**\n- Butter and sage",
    );

    const [reused] = onlySlots(await getPreviousMealSlotMenus(targetId), [
      sourceId,
    ]);

    const copy = await saveMealSlotMenu(
      targetId,
      `${reused.content}\n- Apple strudel`,
    );

    expect(copy.id).not.toBe(sourceMenu.id);
    expect(copy.content).toBe("**Gnocchi**\n- Butter and sage\n- Apple strudel");
    expect(await getMealSlotMenu(sourceId)).toEqual(sourceMenu);
  });
});
