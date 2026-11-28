import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getMealSlotMenu: vi.fn(),
  getPreviousMealSlotMenus: vi.fn(),
  saveMealSlotMenu: vi.fn(),
}));

vi.mock("../../dao/menu-dao.js", () => mocks);

import {
  getMenuReuseDraft,
  MenuServiceError,
  saveMenuForSlot,
} from "../../services/menu-service.js";

const sourceMenu = {
  id: 11,
  slotId: 1,
  content: "  **Soup**\n- Bread\n  - Rye  ",
  updatedAt: "2091-01-01T00:00:00.000Z",
  slotName: "Lunch",
  slotDate: "2091-01-01",
  startTime: "12:00",
  endTime: "14:00",
};

beforeEach(() => {
  vi.resetAllMocks();
  mocks.getMealSlotMenu.mockResolvedValue(sourceMenu);
  mocks.getPreviousMealSlotMenus.mockResolvedValue([sourceMenu]);
});

describe("menu validation", () => {
  it.each([undefined, null, 0, -1, 1.5, "1", NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])(
    "rejects invalid source and target slot IDs: %s",
    async (id) => {
      await expect(getMenuReuseDraft(id, 2)).rejects.toMatchObject({
        code: "INVALID_MENU",
      });
      await expect(getMenuReuseDraft(1, id)).rejects.toMatchObject({
        code: "INVALID_MENU",
      });
      await expect(saveMenuForSlot(id, "Menu")).rejects.toMatchObject({
        code: "INVALID_MENU",
      });
      expect(mocks.getMealSlotMenu).not.toHaveBeenCalled();
      expect(mocks.getPreviousMealSlotMenus).not.toHaveBeenCalled();
      expect(mocks.saveMealSlotMenu).not.toHaveBeenCalled();
    },
  );

  it.each([undefined, null, 1, {}, "", " \n\t "])(
    "rejects invalid or blank menu text: %s",
    async (content) => {
      const result = saveMenuForSlot(2, content);
      await expect(result).rejects.toBeInstanceOf(MenuServiceError);
      await expect(result).rejects.toMatchObject({
        code: "INVALID_MENU",
      });
      expect(mocks.saveMealSlotMenu).not.toHaveBeenCalled();
    },
  );
});

describe("menu reuse and saving", () => {
  it("returns an editable draft without saving and saves only the final text", async () => {
    const saved = { ...sourceMenu, id: 12, slotId: 2, content: "Edited menu" };
    mocks.saveMealSlotMenu.mockResolvedValue(saved);

    const draft = await getMenuReuseDraft(1, 2);

    expect(draft).toBe(sourceMenu.content);
    expect(mocks.getMealSlotMenu).toHaveBeenCalledWith(1);
    expect(mocks.getPreviousMealSlotMenus).toHaveBeenCalledWith(2);
    expect(mocks.saveMealSlotMenu).not.toHaveBeenCalled();

    const finalText = `${draft}\n- Apple pie`;
    mocks.saveMealSlotMenu.mockResolvedValue({ ...saved, content: finalText });
    expect(await saveMenuForSlot(2, finalText)).toMatchObject({
      slotId: 2,
      content: finalText,
    });
    expect(mocks.saveMealSlotMenu).toHaveBeenCalledOnce();
    expect(mocks.saveMealSlotMenu).toHaveBeenCalledWith(2, finalText);
  });

  it("rejects a source without a reusable previous menu", async () => {
    mocks.getMealSlotMenu.mockResolvedValue(null);
    mocks.getPreviousMealSlotMenus.mockResolvedValue([]);

    await expect(getMenuReuseDraft(1, 2)).rejects.toMatchObject({
      code: "MENU_NOT_REUSABLE",
    });
    expect(mocks.saveMealSlotMenu).not.toHaveBeenCalled();
  });

  it("rejects a source that is not earlier than the target", async () => {
    mocks.getPreviousMealSlotMenus.mockResolvedValue([]);

    await expect(getMenuReuseDraft(1, 2)).rejects.toMatchObject({
      code: "MENU_NOT_REUSABLE",
    });
  });

  it("rejects previous text consisting only of Unicode whitespace", async () => {
    mocks.getPreviousMealSlotMenus.mockResolvedValue([
      { ...sourceMenu, content: "\u00a0" },
    ]);

    await expect(getMenuReuseDraft(1, 2)).rejects.toMatchObject({
      code: "MENU_NOT_REUSABLE",
    });
  });

  it("propagates a missing source slot", async () => {
    const error = Object.assign(new Error("Missing source"), {
      code: "MEAL_SLOT_NOT_FOUND",
      slotId: 1,
    });
    mocks.getMealSlotMenu.mockRejectedValue(error);

    await expect(getMenuReuseDraft(1, 2)).rejects.toBe(error);
    expect(mocks.getPreviousMealSlotMenus).not.toHaveBeenCalled();
  });

  it("propagates a missing target slot for draft and save", async () => {
    const error = Object.assign(new Error("Missing target"), {
      code: "MEAL_SLOT_NOT_FOUND",
      slotId: 2,
    });
    mocks.getPreviousMealSlotMenus.mockRejectedValue(error);
    mocks.saveMealSlotMenu.mockRejectedValue(error);

    await expect(getMenuReuseDraft(1, 2)).rejects.toBe(error);
    await expect(saveMenuForSlot(2, "Menu")).rejects.toBe(error);
  });
});
