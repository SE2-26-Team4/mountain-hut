import fs from 'node:fs';

// Remove the test database and its journal, WAL, and shared-memory files.
export const removeTestDb = (dbPath) => {
  for (const suffix of ['', '-journal', '-wal', '-shm']) {
    // Ignore missing files so cleanup can be run repeatedly.
    fs.rmSync(dbPath + suffix, { force: true });
  }
};