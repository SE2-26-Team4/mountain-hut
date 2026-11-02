import {
  afterEach,
  beforeEach,
  expect,
  it,
  vi,
} from 'vitest';

let db;

beforeEach(() => {
  vi.resetModules();

  vi.stubEnv('NODE_ENV', 'production');
  vi.stubEnv('SESSION_SECRET', undefined);
  vi.stubEnv('DB_PATH', ':memory:');
});

afterEach(async () => {
  try {
    if (db) {
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
    db = undefined;
    vi.unstubAllEnvs();
  }
});

it('rejects production startup without a session secret', async () => {
  db = await import('../../db.js');

  await expect(
    import('../../app.js'),
  ).rejects.toThrow(
    'SESSION_SECRET must be set in production.',
  );
});