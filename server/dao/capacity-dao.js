
class CapacityDAO {
  constructor(db) {
    this.db = db;
  }

 
  async listMealSlots() {
    return new Promise((resolve, reject) => {
      const query = `SELECT id, date, meal_type as mealType, max_capacity as maxCapacity, active FROM meal_slots`;
      this.db.all(query, [], (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
  }


  async getMealSlotById(id) {
    return new Promise((resolve, reject) => {
      const query = `SELECT id, date, meal_type as mealType, max_capacity as maxCapacity, active FROM meal_slots WHERE id = ?`;
      this.db.get(query, [id], (err, row) => {
        if (err) reject(err);
        else resolve(row || null);
      });
    });
  }


  async saveMealSlot(slot) {
    return new Promise((resolve, reject) => {
      const { id, date, mealType, maxCapacity, active } = slot;
      const query = `
        INSERT INTO meal_slots (id, date, meal_type, max_capacity, active)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          date = excluded.date,
          meal_type = excluded.meal_type,
          max_capacity = excluded.max_capacity,
          active = excluded.active
      `;
      this.db.run(query, [id, date, mealType, maxCapacity, active !== undefined ? active : 1], function(err) {
        if (err) reject(err);
        else resolve({ id: id || this.lastID, ...slot });
      });
    });
  }


  async listDiningTables() {
    return new Promise((resolve, reject) => {
      const query = `SELECT id, table_number as tableNumber, seat_count as seatCount, active FROM dining_tables`;
      this.db.all(query, [], (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
  }


  async getDiningTableById(id) {
    return new Promise((resolve, reject) => {
      const query = `SELECT id, table_number as tableNumber, seat_count as seatCount, active FROM dining_tables WHERE id = ?`;
      this.db.get(query, [id], (err, row) => {
        if (err) reject(err);
        else resolve(row || null);
      });
    });
  }


  async saveDiningTable(table) {
    return new Promise((resolve, reject) => {
      const { id, tableNumber, seatCount, active } = table;
      const query = `
        INSERT INTO dining_tables (id, table_number, seat_count, active)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          table_number = excluded.table_number,
          seat_count = excluded.seat_count,
          active = excluded.active
      `;
      this.db.run(query, [id, tableNumber, seatCount, active !== undefined ? active : 1], function(err) {
        if (err) reject(err);
        else resolve({ id: id || this.lastID, ...table });
      });
    });
  }
}

export default CapacityDAO;