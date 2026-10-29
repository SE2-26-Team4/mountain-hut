import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import sqlite3 from 'sqlite3';
import CapacityDAO from '../../dao/capacity-dao.js';

describe('CapacityDAO Integration Tests', () => {
  let db;
  let capacityDao;

  beforeEach(async () => {


    db = new sqlite3.Database(':memory:');
    capacityDao = new CapacityDAO(db);

    await new Promise((resolve, reject) => {
      db.serialize(() => {
        db.run(`
          CREATE TABLE meal_slots (
            id INTEGER PRIMARY KEY,
            date TEXT NOT NULL,
            meal_type TEXT NOT NULL,
            max_capacity INTEGER NOT NULL,
            active INTEGER DEFAULT 1
          )
        `);
        db.run(`
          CREATE TABLE dining_tables (
            id INTEGER PRIMARY KEY,
            table_number INTEGER NOT NULL,
            seat_count INTEGER NOT NULL,
            active INTEGER DEFAULT 1
          )
        `, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    });
  });

  afterEach(async () => {
    await new Promise((resolve) => db.close(() => resolve()));
  });

  test('should create and retrieve a meal slot', async () => {
    const slot = { id: 1, date: '2026-11-01', mealType: 'dinner', maxCapacity: 50, active: 1 };
    await capacityDao.saveMealSlot(slot);

    const retrieved = await capacityDao.getMealSlotById(1);
    expect(retrieved).toMatchObject(slot);
  });

  test('should return null when meal slot does not exist', async () => {
    const retrieved = await capacityDao.getMealSlotById(999);
    expect(retrieved).toBeNull();
  });

  test('should update an existing meal slot', async () => {
    const slot = { id: 1, date: '2026-11-01', mealType: 'lunch', maxCapacity: 40, active: 1 };
    await capacityDao.saveMealSlot(slot);


    slot.maxCapacity = 60;
    slot.active = 0;
    await capacityDao.saveMealSlot(slot);

    const updated = await capacityDao.getMealSlotById(1);
    expect(updated.maxCapacity).toBe(60);
    expect(updated.active).toBe(0);
  });

  test('should create and retrieve a dining table', async () => {
    const table = { id: 1, tableNumber: 5, seatCount: 6, active: 1 };
    await capacityDao.saveDiningTable(table);

    const retrieved = await capacityDao.getDiningTableById(1);
    expect(retrieved).toMatchObject(table);
  });

  test('should return null when dining table does not exist', async () => {
    const retrieved = await capacityDao.getDiningTableById(999);
    expect(retrieved).toBeNull();
  });

  test('should update an existing dining table seat count and active status', async () => {
    const table = { id: 2, tableNumber: 3, seatCount: 4, active: 1 };
    await capacityDao.saveDiningTable(table);

    table.seatCount = 8;
    table.active = 0;
    await capacityDao.saveDiningTable(table);

    const updated = await capacityDao.getDiningTableById(2);
    expect(updated.seatCount).toBe(8);
    expect(updated.active).toBe(0);
  });
});