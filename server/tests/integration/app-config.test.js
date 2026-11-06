import {
  afterEach,
  beforeEach,
  expect,
  it,
  vi,
} from 'vitest';

// Keep the imported database module available for cleanup.
let db;

// Prepare an isolated production configuration without a session secret.
beforeEach(() => {
  // Clear cached modules so imports read the test environment again.
  vi.resetModules();

  vi.stubEnv('NODE_ENV', 'production');
  vi.stubEnv('SESSION_SECRET', undefined);
  vi.stubEnv('DB_PATH', ':memory:');
});

// Close the test database and restore environment variables after each test.
afterEach(async () => {
  try {
    if (db) {
      // Wait for SQLite's callback-based close operation to finish.
      await new Promise((resolve, reject) => {
        db.default.close((error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        });
      });
    }
  } finally {
    // Restore the environment even if closing the database fails.
    db = undefined;
    vi.unstubAllEnvs();
  }
});

// Verify that production startup requires an explicit session secret.
it('rejects production startup without a session secret', async () => {
  // Import the database separately so it can be closed if app startup fails.
  db = await import('../../db.js');

  // Expect application initialization to reject the missing configuration.
  await expect(
    import('../../app.js'),
  ).rejects.toThrow(
    'SESSION_SECRET must be set in production.',
  );
});