import {
  afterAll,
  beforeAll,
  describe,
  expect,
  it,
} from 'vitest';

import {
  createDiningTable,
  createMealSlot,
  copyWeeklySchedule,
  DiningTablesNotFoundError,
  DuplicateMealSlotError,
  DuplicateNameError,
  getDiningTables,
  WeeklyScheduleConflictError,
  getMealSlotCapacity,
  getMealSlots,
  setMealSlotTables,
  updateDiningTable,
  updateMealSlot,
} from '../../dao/capacity-dao.js';

import {
  initializeDatabase,
  runAsync,
} from '../../db.js';

// Generate unique names for the shared test fixtures.
const uniqueSuffix = `${Date.now()}-${Math.random()}`;

// Keep the shared slot and table available for updates and cleanup.
let slotId;
let tableId;

// Initialize the database and create the shared fixtures before the suites.
beforeAll(async () => {
  await initializeDatabase();

  const slot = await createMealSlot({
    slotDate: '2099-12-30',
    name: `Capacity test slot ${uniqueSuffix}`,
    startTime: '18:00',
    endTime: '20:00',
  });

  slotId = slot.id;

  const table = await createDiningTable({
    name: `Capacity test table ${uniqueSuffix}`,
    seatCount: 4,
  });

  tableId = table.id;
});

// Remove assignments before deleting the shared slot and table.
afterAll(async () => {
  if (slotId) {
    await runAsync(
      'DELETE FROM slot_tables WHERE slot_id = ?',
      [slotId],
    );

    await runAsync(
      'DELETE FROM meal_slots WHERE id = ?',
      [slotId],
    );
  }

  if (tableId) {
    await runAsync(
      'DELETE FROM slot_tables WHERE table_id = ?',
      [tableId],
    );

    await runAsync(
      'DELETE FROM dining_tables WHERE id = ?',
      [tableId],
    );
  }
});

describe('meal-slot and dining-table data access', () => {
  it('copies a weekly schedule with new slots and table assignments', async () => {
    const suffix = `${Date.now()}-${Math.random()}`;
    const table = await createDiningTable({
      name: `Weekly copy table ${suffix}`,
      seatCount: 4,
      isActive: false,
    });

    const sourceSlots = [];
    const destinationSlots = [];

    try {
      sourceSlots.push(
        await createMealSlot({
          slotDate: '2098-01-05',
          name: `Weekly copy dinner ${suffix}`,
          startTime: '18:00',
          endTime: '20:00',
          isActive: false,
        }),
        await createMealSlot({
          slotDate: '2098-01-06',
          name: `Weekly copy lunch ${suffix}`,
          startTime: '12:00',
          endTime: '14:00',
        }),
      );
      await setMealSlotTables(sourceSlots[0].id, [table.id]);

      destinationSlots.push(
        await createMealSlot({
          slotDate: '2098-02-05',
          name: `Old destination slot ${suffix}`,
          startTime: '10:00',
          endTime: '11:00',
        }),
      );

      const copied = await copyWeeklySchedule({
        sourceWeekStart: '2098-01-05',
        destinationWeekStart: '2098-02-02',
      });

      expect(copied).toHaveLength(2);
      expect(copied).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            slotDate: '2098-02-02',
            name: `Weekly copy dinner ${suffix}`,
            startTime: '18:00',
            endTime: '20:00',
            isActive: false,
            tableIds: [table.id],
          }),
          expect.objectContaining({
            slotDate: '2098-02-03',
            name: `Weekly copy lunch ${suffix}`,
            isActive: true,
            tableIds: [],
          }),
        ]),
      );
      expect(copied.every((slot) =>
        !sourceSlots.some((source) => source.id === slot.id),
      )).toBe(true);

      const remainingDestination = await getMealSlots();
      expect(
        remainingDestination.some(
          (slot) => slot.id === destinationSlots[0].id,
        ),
      ).toBe(false);
    } finally {
      const slotsToDelete = [
        ...sourceSlots,
        ...destinationSlots,
      ];
      const copiedSlots = await getMealSlots();
      const testSlots = copiedSlots.filter((slot) =>
        slot.name.endsWith(suffix),
      );

      for (const slot of [...slotsToDelete, ...testSlots]) {
        await runAsync(
          'DELETE FROM slot_tables WHERE slot_id = ?',
          [slot.id],
        );
        await runAsync(
          'DELETE FROM meal_slots WHERE id = ?',
          [slot.id],
        );
      }
      await runAsync(
        'DELETE FROM dining_tables WHERE id = ?',
        [table.id],
      );
    }
  });

  it('does not replace a destination week that contains bookings', async () => {
    const suffix = `${Date.now()}-${Math.random()}`;
    const destinationSlot = await createMealSlot({
      slotDate: '2098-04-07',
      name: `Booked destination slot ${suffix}`,
      startTime: '18:00',
      endTime: '20:00',
    });
    const hiker = await runAsync(
      `INSERT INTO users (full_name, email, password_hash, role)
       VALUES (?, ?, ?, 'hiker')`,
      [
        `Weekly copy hiker ${suffix}`,
        `weekly-copy-${suffix}@example.com`,
        'test-password-hash',
      ],
    );
    const booking = await runAsync(
      `INSERT INTO bookings (
         hiker_id, booking_date, slot_id, party_size, status
       )
       VALUES (?, ?, ?, ?, 'confirmed')`,
      [hiker.lastID, destinationSlot.slotDate, destinationSlot.id, 1],
    );

    try {
      await expect(
        copyWeeklySchedule({
          sourceWeekStart: '2098-03-02',
          destinationWeekStart: '2098-04-06',
        }),
      ).rejects.toBeInstanceOf(WeeklyScheduleConflictError);

      const unchanged = await getMealSlots();
      expect(
        unchanged.some((slot) => slot.id === destinationSlot.id),
      ).toBe(true);
    } finally {
      await runAsync(
        'DELETE FROM booking_table_allocations WHERE booking_id = ?',
        [booking.lastID],
      );
      await runAsync(
        'DELETE FROM bookings WHERE id = ?',
        [booking.lastID],
      );
      await runAsync(
        'DELETE FROM slot_tables WHERE slot_id = ?',
        [destinationSlot.id],
      );
      await runAsync(
        'DELETE FROM meal_slots WHERE id = ?',
        [destinationSlot.id],
      );
      await runAsync(
        'DELETE FROM users WHERE id = ?',
        [hiker.lastID],
      );
    }
  });

  // Created records must be returned with their configured values.
  it('reads the created meal slot and dining table', async () => {
    const slots = await getMealSlots();
    const tables = await getDiningTables();

    expect(
      slots.find((slot) => slot.id === slotId),
    ).toMatchObject({
      slotDate: '2099-12-30',
      name: `Capacity test slot ${uniqueSuffix}`,
      startTime: '18:00',
      endTime: '20:00',
      isActive: true,
    });

    expect(
      tables.find((table) => table.id === tableId),
    ).toMatchObject({
      name: `Capacity test table ${uniqueSuffix}`,
      seatCount: 4,
      isActive: true,
    });
  });

  // Updates must return the new values while preserving record IDs.
  it('updates a meal slot and a dining table', async () => {
    const updatedSlot = await updateMealSlot(slotId, {
      slotDate: '2099-12-30',
      name: `Updated capacity test slot ${uniqueSuffix}`,
      startTime: '19:00',
      endTime: '21:00',
      isActive: true,
    });

    const updatedTable = await updateDiningTable(tableId, {
      name: `Updated capacity test table ${uniqueSuffix}`,
      seatCount: 6,
      isActive: true,
    });

    expect(updatedSlot).toMatchObject({
      id: slotId,
      slotDate: '2099-12-30',
      name: `Updated capacity test slot ${uniqueSuffix}`,
      startTime: '19:00',
      endTime: '21:00',
      isActive: true,
    });

    expect(updatedTable).toMatchObject({
      id: tableId,
      name: `Updated capacity test table ${uniqueSuffix}`,
      seatCount: 6,
      isActive: true,
    });
  });

  // Updating a missing record must return null.
  it('returns null when updating a meal slot or table that does not exist', async () => {
    const missingSlot = await updateMealSlot(-1, {
      slotDate: '2099-12-30',
      name: 'Missing slot',
      startTime: '18:00',
      endTime: '20:00',
      isActive: true,
    });

    const missingTable = await updateDiningTable(-1, {
      name: 'Missing table',
      seatCount: 2,
      isActive: true,
    });

    expect(missingSlot).toBeNull();
    expect(missingTable).toBeNull();
  });

  // Inactive records must retain their status and remain available in listings.
  it('creates inactive meal slots and dining tables', async () => {
    let inactiveSlotId;
    let inactiveTableId;

    try {
      const slot = await createMealSlot({
        slotDate: '2099-12-30',
        name: `Inactive slot ${uniqueSuffix}`,
        startTime: '08:00',
        endTime: '09:00',
        isActive: false,
      });

      inactiveSlotId = slot.id;

      const table = await createDiningTable({
        name: `Inactive table ${uniqueSuffix}`,
        seatCount: 4,
        isActive: false,
      });

      inactiveTableId = table.id;

      expect(slot.isActive).toBe(false);
      expect(table.isActive).toBe(false);

      expect(await getMealSlots()).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: inactiveSlotId,
            isActive: false,
          }),
        ]),
      );

      expect(await getDiningTables()).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: inactiveTableId,
            isActive: false,
          }),
        ]),
      );
    } finally {
      // Remove local fixtures even if an assertion fails.
      if (inactiveSlotId) {
        await runAsync(
          'DELETE FROM meal_slots WHERE id = ?',
          [inactiveSlotId],
        );
      }

      if (inactiveTableId) {
        await runAsync(
          'DELETE FROM dining_tables WHERE id = ?',
          [inactiveTableId],
        );
      }
    }
  });

  // Duplicate checks must ignore letter case and prevent duplicate records.
  it('rejects duplicate names on creation, ignoring letter case', async () => {
    const slotName = `Duplicate slot ${uniqueSuffix}`;
    const tableName = `Duplicate table ${uniqueSuffix}`;

    let duplicateSlotId;
    let duplicateTableId;

    try {
      duplicateSlotId = (await createMealSlot({
        slotDate: '2099-12-30',
        name: slotName,
        startTime: '08:00',
        endTime: '09:00',
      }))?.id;

      duplicateTableId = (await createDiningTable({
        name: tableName,
        seatCount: 2,
      }))?.id;

      await expect(
        createMealSlot({
          slotDate: '2099-12-30',
          name: slotName.toUpperCase(),
          startTime: '08:00',
          endTime: '09:00',
        }),
      ).rejects.toBeInstanceOf(DuplicateMealSlotError);

      await expect(
        createDiningTable({
          name: tableName.toLowerCase(),
          seatCount: 4,
        }),
      ).rejects.toThrow(
        `A dining table named "${tableName.toLowerCase()}" already exists.`,
      );

      // A rejected creation must leave only the original table.
      const sameNameTables = (await getDiningTables()).filter(
        (table) => table.name.toLowerCase() === tableName.toLowerCase(),
      );

      expect(sameNameTables).toHaveLength(1);
    } finally {
      if (duplicateSlotId) {
        await runAsync(
          'DELETE FROM meal_slots WHERE id = ?',
          [duplicateSlotId],
        );
      }

      if (duplicateTableId) {
        await runAsync(
          'DELETE FROM dining_tables WHERE id = ?',
          [duplicateTableId],
        );
      }
    }
  });

  // Updates must reject conflicting names while allowing a record's own name.
  it('rejects renaming to another record name but allows keeping its own', async () => {
    const createdSlotIds = [];
    const createdTableIds = [];

    try {
      const firstSlot = await createMealSlot({
        slotDate: '2099-12-30',
        name: `Rename slot A ${uniqueSuffix}`,
        startTime: '06:00',
        endTime: '07:00',
      });

      const secondSlot = await createMealSlot({
        slotDate: '2099-12-30',
        name: `Rename slot B ${uniqueSuffix}`,
        startTime: '07:00',
        endTime: '08:00',
      });

      const firstTable = await createDiningTable({
        name: `Rename table A ${uniqueSuffix}`,
        seatCount: 2,
      });

      const secondTable = await createDiningTable({
        name: `Rename table B ${uniqueSuffix}`,
        seatCount: 2,
      });

      createdSlotIds.push(firstSlot?.id, secondSlot?.id);
      createdTableIds.push(firstTable?.id, secondTable?.id);

      await expect(
        updateMealSlot(secondSlot?.id ?? -1, {
          slotDate: '2099-12-30',
          name: `Rename slot A ${uniqueSuffix}`,
          startTime: '06:00',
          endTime: '07:00',
          isActive: true,
        }),
      ).rejects.toBeInstanceOf(DuplicateMealSlotError);

      await expect(
        updateDiningTable(secondTable?.id ?? -1, {
          name: `RENAME TABLE A ${uniqueSuffix}`,
          seatCount: 2,
          isActive: true,
        }),
      ).rejects.toBeInstanceOf(DuplicateNameError);

      // A failed rename must preserve the table's original name.
      expect(
        (await getDiningTables()).find(
          (table) => table.id === secondTable?.id,
        )?.name,
      ).toBe(`Rename table B ${uniqueSuffix}`);

      // Keeping the same name with different letter case remains valid.
      const sameSlot = await updateMealSlot(firstSlot?.id ?? -1, {
        slotDate: '2099-12-30',
        name: `RENAME SLOT A ${uniqueSuffix}`,
        startTime: '06:00',
        endTime: '07:30',
        isActive: true,
      });

      expect(sameSlot?.name).toBe(`RENAME SLOT A ${uniqueSuffix}`);
    } finally {
      for (const id of createdSlotIds.filter(Boolean)) {
        await runAsync(
          'DELETE FROM meal_slots WHERE id = ?',
          [id],
        );
      }

      for (const id of createdTableIds.filter(Boolean)) {
        await runAsync(
          'DELETE FROM dining_tables WHERE id = ?',
          [id],
        );
      }
    }
  });

  // A missing record must return null even when the requested name is taken.
  it('reports a missing record as null even if its new name is taken', async () => {
    const takenName = `Updated capacity test table ${uniqueSuffix}`;

    await updateDiningTable(tableId, {
      name: takenName,
      seatCount: 6,
      isActive: true,
    });

    await expect(
      updateDiningTable(-1, {
        name: takenName,
        seatCount: 2,
        isActive: true,
      }),
    ).resolves.toBeNull();
  });
});

describe('slot-table assignment and capacity aggregation', () => {
  // Use dedicated fixtures with known seat counts for capacity assertions.
  const assignmentSlotName = `Assignment test slot ${uniqueSuffix}`;

  let assignmentSlotId;
  let fourSeatTableId;
  let twoSeatTableId;
  let inactiveTableId;

  /**
   * Returns a sorted copy of the IDs for order-independent comparisons.
   *
   * @param {number[]} ids
   * @returns {number[]}
   */
  const sortIds = (ids) => [...ids].sort(
    (firstId, secondId) => firstId - secondId,
  );

  /**
   * Reads the persisted assignment and its total active seat capacity.
   *
   * @returns {Promise<{ tableIds: number[], totalSeatCapacity: number }>}
   */
  async function readSavedAssignment() {
    const capacity = await getMealSlotCapacity(assignmentSlotId);

    return {
      tableIds: sortIds(capacity.tables.map((table) => table.id)),
      totalSeatCapacity: capacity.totalSeatCapacity,
    };
  }

  // Create one slot, two active tables, and one inactive table.
  beforeAll(async () => {
    const slot = await createMealSlot({
      slotDate: '2099-12-30',
      name: assignmentSlotName,
      startTime: '12:00',
      endTime: '13:00',
    });

    assignmentSlotId = slot.id;

    const fourSeatTable = await createDiningTable({
      name: `Four-seat assignment table ${uniqueSuffix}`,
      seatCount: 4,
    });

    fourSeatTableId = fourSeatTable.id;

    const twoSeatTable = await createDiningTable({
      name: `Two-seat assignment table ${uniqueSuffix}`,
      seatCount: 2,
    });

    twoSeatTableId = twoSeatTable.id;

    const inactiveTable = await createDiningTable({
      name: `Inactive assignment table ${uniqueSuffix}`,
      seatCount: 6,
      isActive: false,
    });

    inactiveTableId = inactiveTable.id;
  });

  // Remove all fixture assignments before deleting their slot and tables.
  afterAll(async () => {
    if (assignmentSlotId) {
      await runAsync(
        'DELETE FROM slot_tables WHERE slot_id = ?',
        [assignmentSlotId],
      );

      await runAsync(
        'DELETE FROM meal_slots WHERE id = ?',
        [assignmentSlotId],
      );
    }

    for (const id of [fourSeatTableId, twoSeatTableId, inactiveTableId]) {
      if (id) {
        await runAsync(
          'DELETE FROM slot_tables WHERE table_id = ?',
          [id],
        );

        await runAsync(
          'DELETE FROM dining_tables WHERE id = ?',
          [id],
        );
      }
    }
  });

  // Assigned active tables must contribute their seats to the saved capacity.
  it('assigns tables to a meal slot and calculates its total seat capacity', async () => {
    const capacity = await setMealSlotTables(
      assignmentSlotId,
      [fourSeatTableId, twoSeatTableId],
    );

    expect(capacity).toMatchObject({
      slotId: assignmentSlotId,
      slotName: assignmentSlotName,
      totalSeatCapacity: 6,
    });

    expect(
      sortIds(capacity.tables.map((table) => table.id)),
    ).toEqual(
      sortIds([fourSeatTableId, twoSeatTableId]),
    );

    await expect(
      getMealSlotCapacity(assignmentSlotId),
    ).resolves.toEqual(capacity);
  });

  // Inactive tables remain listed but do not contribute to seat capacity.
  it('excludes assigned inactive tables from the total seat capacity', async () => {
    const capacity = await setMealSlotTables(
      assignmentSlotId,
      [fourSeatTableId, inactiveTableId],
    );

    expect(
      capacity.tables.find((table) => table.id === inactiveTableId),
    ).toMatchObject({
      seatCount: 6,
      isActive: false,
    });

    expect(capacity.totalSeatCapacity).toBe(4);
  });

  // Deactivating an assigned table must remove its seats from capacity.
  it('excludes an assigned table from capacity after deactivation', async () => {
    await setMealSlotTables(
      assignmentSlotId,
      [twoSeatTableId],
    );

    try {
      const updatedSlot = await updateMealSlot(assignmentSlotId, {
        slotDate: '2099-12-30',
        name: assignmentSlotName,
        startTime: '12:00',
        endTime: '13:00',
        isActive: false,
      });

      const updatedTable = await updateDiningTable(twoSeatTableId, {
        name: `Two-seat assignment table ${uniqueSuffix}`,
        seatCount: 2,
        isActive: false,
      });

      expect(updatedSlot.isActive).toBe(false);
      expect(updatedTable.isActive).toBe(false);

      await expect(
        getMealSlotCapacity(assignmentSlotId),
      ).resolves.toMatchObject({
        totalSeatCapacity: 0,
        tables: [
          {
            id: twoSeatTableId,
            seatCount: 2,
            isActive: false,
          },
        ],
      });
    } finally {
      // Restore active status for the remaining assignment tests.
      await runAsync(
        'UPDATE meal_slots SET is_active = 1 WHERE id = ?',
        [assignmentSlotId],
      );

      await runAsync(
        'UPDATE dining_tables SET is_active = 1 WHERE id = ?',
        [twoSeatTableId],
      );
    }
  });

  // Each assignment replaces the previous list and stores each table once.
  it('replaces previous assignments and ignores duplicate table IDs', async () => {
    await setMealSlotTables(
      assignmentSlotId,
      [fourSeatTableId, twoSeatTableId],
    );

    const capacity = await setMealSlotTables(
      assignmentSlotId,
      [twoSeatTableId, twoSeatTableId],
    );

    expect(
      capacity.tables.map((table) => table.id),
    ).toEqual([twoSeatTableId]);

    expect(capacity.totalSeatCapacity).toBe(2);
  });

  // An empty table list must remove every assignment and reset capacity.
  it('clears all assignments when no tables are requested', async () => {
    await setMealSlotTables(
      assignmentSlotId,
      [fourSeatTableId],
    );

    const capacity = await setMealSlotTables(
      assignmentSlotId,
      [],
    );

    expect(capacity.tables).toEqual([]);
    expect(capacity.totalSeatCapacity).toBe(0);
  });

  // Missing table IDs must reject the update and preserve saved assignments.
  it('preserves existing assignments when a requested table does not exist', async () => {
    await setMealSlotTables(
      assignmentSlotId,
      [fourSeatTableId, twoSeatTableId],
    );

    const missingTableId = -1;

    const failedAssignment = setMealSlotTables(
      assignmentSlotId,
      [twoSeatTableId, missingTableId],
    );

    await expect(
      failedAssignment,
    ).rejects.toBeInstanceOf(DiningTablesNotFoundError);

    await expect(failedAssignment).rejects.toMatchObject({
      code: 'DINING_TABLES_NOT_FOUND',
      message: 'One or more dining tables were not found.',
      missingTableIds: [missingTableId],
    });

    await expect(readSavedAssignment()).resolves.toEqual({
      tableIds: sortIds([fourSeatTableId, twoSeatTableId]),
      totalSeatCapacity: 6,
    });
  });

  // A failure during assignment persistence must roll back all partial changes.
  it('rolls back partial changes when saving an assignment fails', async () => {
    await setMealSlotTables(
      assignmentSlotId,
      [fourSeatTableId, twoSeatTableId],
    );

    // Fail the second insert after deleting old rows and saving the first new row.
    await runAsync(
      `CREATE TEMP TRIGGER fail_slot_table_insert
       BEFORE INSERT ON slot_tables
       WHEN NEW.slot_id = ${assignmentSlotId}
         AND NEW.table_id = ${inactiveTableId}
       BEGIN
         SELECT RAISE(ABORT, 'Forced assignment failure');
       END`,
    );

    try {
      await expect(
        setMealSlotTables(
          assignmentSlotId,
          [twoSeatTableId, inactiveTableId],
        ),
      ).rejects.toThrow('Forced assignment failure');
    } finally {
      // Always remove the temporary failure trigger.
      await runAsync(
        'DROP TRIGGER IF EXISTS fail_slot_table_insert',
      );
    }

    // The original assignment and capacity must survive the failed transaction.
    await expect(readSavedAssignment()).resolves.toEqual({
      tableIds: sortIds([fourSeatTableId, twoSeatTableId]),
      totalSeatCapacity: 6,
    });
  });

  // Invalid inputs must fail without changing the persisted assignment.
  it('rejects table IDs that are not integers without changing assignments', async () => {
    await setMealSlotTables(
      assignmentSlotId,
      [fourSeatTableId],
    );

    await expect(
      setMealSlotTables(assignmentSlotId, null),
    ).rejects.toBeInstanceOf(TypeError);

    await expect(
      setMealSlotTables(assignmentSlotId, String(fourSeatTableId)),
    ).rejects.toBeInstanceOf(TypeError);

    await expect(
      setMealSlotTables(assignmentSlotId, [String(twoSeatTableId)]),
    ).rejects.toBeInstanceOf(TypeError);

    await expect(
      setMealSlotTables(assignmentSlotId, [true]),
    ).rejects.toBeInstanceOf(TypeError);

    await expect(readSavedAssignment()).resolves.toEqual({
      tableIds: [fourSeatTableId],
      totalSeatCapacity: 4,
    });
  });

  // Capacity reads and assignment updates must return null for a missing slot.
  it('returns null when requesting capacity for a meal slot that does not exist', async () => {
    await expect(
      getMealSlotCapacity(-1),
    ).resolves.toBeNull();

    await expect(
      setMealSlotTables(-1, [fourSeatTableId]),
    ).resolves.toBeNull();
  });
});

describe('dated meal-slot configuration', () => {
  // Track dated fixtures separately for cleanup.
  const slotIds = [];
  const tableIds = [];

  const suffix = `${Date.now()}-${Math.random()}`;

  /**
   * Creates and tracks a slot with the same service details on the given date.
   */
  async function createDatedSlot(slotDate) {
    const slot = await createMealSlot({
      slotDate,
      name: `Dated lunch ${suffix}`,
      startTime: '12:00',
      endTime: '13:00',
    });

    slotIds.push(slot.id);

    return slot;
  }

  // Remove dated slot assignments before deleting slots and reusable tables.
  afterAll(async () => {
    for (const id of slotIds) {
      await runAsync(
        'DELETE FROM slot_tables WHERE slot_id = ?',
        [id],
      );

      await runAsync(
        'DELETE FROM meal_slots WHERE id = ?',
        [id],
      );
    }

    for (const id of tableIds) {
      await runAsync(
        'DELETE FROM dining_tables WHERE id = ?',
        [id],
      );
    }
  });

  // Identical service details must be allowed when their dates differ.
  it('allows identical names and times on different dates', async () => {
    const first = await createDatedSlot('2099-11-01');
    const second = await createDatedSlot('2099-11-02');

    expect(first.id).not.toBe(second.id);

    expect(first.slotDate).toBe('2099-11-01');
    expect(second.slotDate).toBe('2099-11-02');

    const savedSlots = await getMealSlots();

    expect(savedSlots).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: first.id,
          slotDate: '2099-11-01',
        }),
        expect.objectContaining({
          id: second.id,
          slotDate: '2099-11-02',
        }),
      ]),
    );
  });

  // The same table may serve matching time slots on separate dates.
  it('allows reusing the same table at the same time on different dates', async () => {
    const first = await createDatedSlot('2099-11-03');
    const second = await createDatedSlot('2099-11-04');

    const table = await createDiningTable({
      name: `Reusable dated table ${suffix}`,
      seatCount: 4,
    });

    tableIds.push(table.id);

    await setMealSlotTables(
      first.id,
      [table.id],
    );

    await expect(
      setMealSlotTables(second.id, [table.id]),
    ).resolves.toMatchObject({
      totalSeatCapacity: 4,
    });
  });

  // Moving a slot must reject an identical service already present on that date.
  it('rejects moving a slot onto an existing identical slot', async () => {
    const first = await createDatedSlot('2099-11-05');
    const second = await createDatedSlot('2099-11-06');

    await expect(
      updateMealSlot(second.id, {
        slotDate: first.slotDate,
        name: second.name,
        startTime: second.startTime,
        endTime: second.endTime,
        isActive: true,
      }),
    ).rejects.toBeInstanceOf(DuplicateMealSlotError);

    // A rejected date change must preserve the slot's original date.
    const savedSlot = (await getMealSlots()).find(
      (slot) => slot.id === second.id,
    );

    expect(savedSlot.slotDate).toBe('2099-11-06');
  });
});