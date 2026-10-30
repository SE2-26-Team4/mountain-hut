import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import sqlite3 from 'sqlite3';
import CapacityDAO from '../../dao/capacity-dao.js';

describe('CapacityDAO integration tests', () => {
  let db;
  let capacityDao;

  beforeEach(async () => {
    db = new sqlite3.Database(':memory:');
    capacityDao = new CapacityDAO(db);

    await new Promise((resolve, reject) => {
      db.exec(`
        PRAGMA foreign_keys = ON;
        CREATE TABLE meal_slots (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL UNIQUE,
          start_time TEXT NOT NULL,
          end_time TEXT NOT NULL,
          is_active INTEGER NOT NULL DEFAULT 1
        );
        CREATE TABLE dining_tables (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL UNIQUE,
          seat_count INTEGER NOT NULL CHECK (seat_count > 0),
          is_active INTEGER NOT NULL DEFAULT 1
        );
        CREATE TABLE slot_tables (
          slot_id INTEGER NOT NULL REFERENCES meal_slots(id),
          table_id INTEGER NOT NULL REFERENCES dining_tables(id),
          PRIMARY KEY (slot_id, table_id)
        );
      `, (error) => (error ? reject(error) : resolve()));
    });
  });

  afterEach(async () => {
    await new Promise((resolve) => db.close(resolve));
  });

  test('creates, lists, and retrieves a meal slot', async () => {
    const saved = await capacityDao.saveMealSlot({
      name: 'Dinner',
      startTime: '19:00',
      endTime: '21:00',
      isActive: true,
    });

    expect(saved.id).toBe(1);
    expect(await capacityDao.listMealSlots()).toEqual([
      {
        id: 1,
        name: 'Dinner',
        startTime: '19:00',
        endTime: '21:00',
        isActive: 1,
      },
    ]);
    expect(await capacityDao.getMealSlotById(1)).toMatchObject({
      id: 1,
      name: 'Dinner',
      startTime: '19:00',
      endTime: '21:00',
    });
  });

  test('updates a meal slot and returns null for an unknown slot', async () => {
    await capacityDao.saveMealSlot({
      id: 1,
      name: 'Lunch',
      startTime: '12:00',
      endTime: '14:00',
      isActive: 1,
    });

    await capacityDao.saveMealSlot({
      id: 1,
      name: 'Late lunch',
      startTime: '13:00',
      endTime: '15:00',
      isActive: 0,
    });

    expect(await capacityDao.getMealSlotById(1)).toMatchObject({
      name: 'Late lunch',
      startTime: '13:00',
      isActive: 0,
    });
    expect(await capacityDao.getMealSlotById(999)).toBeNull();
  });

  test('creates, lists, and retrieves dining tables with seat counts', async () => {
    await capacityDao.saveDiningTable({
      name: 'Table 1',
      seatCount: 6,
      isActive: true,
    });

    expect(await capacityDao.listDiningTables()).toEqual([
      { id: 1, name: 'Table 1', seatCount: 6, isActive: 1 },
    ]);
    expect(await capacityDao.getDiningTableById(1)).toMatchObject({
      name: 'Table 1',
      seatCount: 6,
    });
  });

  test('updates table seat count and active status', async () => {
    await capacityDao.saveDiningTable({
      id: 1,
      name: 'Table 1',
      seatCount: 4,
      isActive: 1,
    });

    await capacityDao.saveDiningTable({
      id: 1,
      name: 'Table 1',
      seatCount: 8,
      isActive: 0,
    });

    expect(await capacityDao.getDiningTableById(1)).toMatchObject({
      seatCount: 8,
      isActive: 0,
    });
  });

  test('returns assigned tables and their total seat capacity', async () => {
    const slot = await capacityDao.saveMealSlot({
      name: 'Dinner',
      startTime: '19:00',
      endTime: '21:00',
    });
    const firstTable = await capacityDao.saveDiningTable({
      name: 'Table 1',
      seatCount: 6,
    });
    const secondTable = await capacityDao.saveDiningTable({
      name: 'Table 2',
      seatCount: 4,
    });

    const capacity = await capacityDao.setMealSlotTables(slot.id, [
      firstTable.id,
      secondTable.id,
    ]);

    expect(capacity).toMatchObject({
      slotId: slot.id,
      slotName: 'Dinner',
      totalSeatCapacity: 10,
    });
    expect(capacity.tables).toMatchObject([
      { id: firstTable.id, seatCount: 6 },
      { id: secondTable.id, seatCount: 4 },
    ]);
  });

  test('returns null capacity for an unknown meal slot', async () => {
    expect(await capacityDao.getMealSlotCapacity(999)).toBeNull();
  });
});
