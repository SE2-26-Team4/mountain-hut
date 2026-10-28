import { removeTestDb } from './helpers/testDb.js';

export default function setup(project) {
  const dbPath = project.config.env.DB_PATH;
  if (!dbPath) throw new Error('DB_PATH must be set in vitest.config.js to isolate the test database');

  removeTestDb(dbPath); // remove test DBs BEFORE run (if a previous run stopped)
  return () => removeTestDb(dbPath); // remove test DBs AFTER run
}
