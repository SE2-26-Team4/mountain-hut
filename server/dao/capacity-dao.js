class CapacityDAO {
  constructor(db) {
    this.db = db;
  }

  async listMealSlots() {
    return this.all(
      `SELECT id, name, start_time AS startTime, end_time AS endTime,
              is_active AS isActive
       FROM meal_slots
       ORDER BY id`,
    );
  }

  async getMealSlotById(id) {
    return this.get(
      `SELECT id, name, start_time AS startTime, end_time AS endTime,
              is_active AS isActive
       FROM meal_slots
       WHERE id = ?`,
      [id],
    );
  }

  async saveMealSlot(slot) {
    const values = [
      slot.name,
      slot.startTime,
      slot.endTime,
      slot.isActive === undefined ? 1 : Number(slot.isActive),
    ];

    if (slot.id === undefined) {
      const result = await this.run(
        `INSERT INTO meal_slots (name, start_time, end_time, is_active)
         VALUES (?, ?, ?, ?)`,
        values,
      );
      return { id: result.lastID, ...slot };
    }

    await this.run(
      `INSERT INTO meal_slots (id, name, start_time, end_time, is_active)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         name = excluded.name,
         start_time = excluded.start_time,
         end_time = excluded.end_time,
         is_active = excluded.is_active`,
      [slot.id, ...values],
    );
    return { ...slot };
  }

  async listDiningTables() {
    return this.all(
      `SELECT id, name, seat_count AS seatCount, is_active AS isActive
       FROM dining_tables
       ORDER BY id`,
    );
  }

  async getDiningTableById(id) {
    return this.get(
      `SELECT id, name, seat_count AS seatCount, is_active AS isActive
       FROM dining_tables
       WHERE id = ?`,
      [id],
    );
  }

  async saveDiningTable(table) {
    const values = [
      table.name,
      table.seatCount,
      table.isActive === undefined ? 1 : Number(table.isActive),
    ];

    if (table.id === undefined) {
      const result = await this.run(
        `INSERT INTO dining_tables (name, seat_count, is_active)
         VALUES (?, ?, ?)`,
        values,
      );
      return { id: result.lastID, ...table };
    }

    await this.run(
      `INSERT INTO dining_tables (id, name, seat_count, is_active)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         name = excluded.name,
         seat_count = excluded.seat_count,
         is_active = excluded.is_active`,
      [table.id, ...values],
    );
    return { ...table };
  }

  async setMealSlotTables(slotId, tableIds) {
    await this.run('DELETE FROM slot_tables WHERE slot_id = ?', [slotId]);

    for (const tableId of tableIds) {
      await this.run(
        'INSERT INTO slot_tables (slot_id, table_id) VALUES (?, ?)',
        [slotId, tableId],
      );
    }

    return this.getMealSlotCapacity(slotId);
  }

  async getMealSlotCapacity(slotId) {
    const slot = await this.get(
      'SELECT id, name FROM meal_slots WHERE id = ?',
      [slotId],
    );

    if (!slot) {
      return null;
    }

    const tables = await this.all(
      `SELECT t.id, t.name, t.seat_count AS seatCount,
              t.is_active AS isActive
       FROM dining_tables t
       JOIN slot_tables st ON st.table_id = t.id
       WHERE st.slot_id = ?
       ORDER BY t.id`,
      [slotId],
    );

    return {
      slotId: slot.id,
      slotName: slot.name,
      tables,
      totalSeatCapacity: tables.reduce(
        (total, table) => total + table.seatCount,
        0,
      ),
    };
  }

  run(sql, parameters = []) {
    return new Promise((resolve, reject) => {
      this.db.run(sql, parameters, function (error) {
        if (error) {
          reject(error);
          return;
        }
        resolve(this);
      });
    });
  }

  get(sql, parameters = []) {
    return new Promise((resolve, reject) => {
      this.db.get(sql, parameters, (error, row) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(row ?? null);
      });
    });
  }

  all(sql, parameters = []) {
    return new Promise((resolve, reject) => {
      this.db.all(sql, parameters, (error, rows) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(rows ?? []);
      });
    });
  }
}

export default CapacityDAO;
