import fs from 'node:fs';

export const removeTestDb = (dbPath) => {
  for (const suffix of ['', '-journal', '-wal', '-shm']) {
    fs.rmSync(dbPath + suffix, { force: true });
  }
};

