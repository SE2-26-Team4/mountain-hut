import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';

import request from 'supertest';
import {
  afterEach,
  beforeEach,
  expect,
  it,
  vi,
} from 'vitest';

const serverDirectory = fileURLToPath(
  new URL('../../app.js', import.meta.url),
);

const serverPath = path.dirname(serverDirectory);

let db;
let temporaryDirectory;

beforeEach(() => {
  vi.resetModules();

  vi.stubEnv('NODE_ENV', 'production');
  vi.stubEnv('SESSION_SECRET', 'frontend-production-test-secret');
  vi.stubEnv('DB_PATH', ':memory:');
  vi.stubEnv('SEED_DEMO_ACCOUNTS', 'false');
});

afterEach(async () => {
  vi.restoreAllMocks();

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

    if (temporaryDirectory) {
      await rm(temporaryDirectory, {
        recursive: true,
        force: true,
      });

      temporaryDirectory = undefined;
    }
  }
});

it('serves production pages and assets without masking missing APIs or files', async () => {
  temporaryDirectory = await mkdtemp(
    path.join(os.tmpdir(), 'mountain-hut-frontend-test-'),
  );

  const html =
    '<!doctype html><html><body>Frontend test page</body></html>';

  const stylesheet = 'body { color: navy; }';

  await writeFile(
    path.join(temporaryDirectory, 'index.html'),
    html,
  );

  await writeFile(
    path.join(temporaryDirectory, 'style.css'),
    stylesheet,
  );

  const originalResolve = path.resolve.bind(path);

  // Redirect only the frontend build directory to the temporary fixture.
  vi.spyOn(path, 'resolve').mockImplementation((...parts) => {
    if (
      parts.length === 2 &&
      parts[0] === serverPath &&
      parts[1] === '../client/dist'
    ) {
      return temporaryDirectory;
    }

    return originalResolve(...parts);
  });

  db = await import('../../db.js');
  const { default: app } = await import('../../app.js');

  for (const url of ['/', '/frontend-test-route']) {
    const response = await request(app).get(url);

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toMatch(/text\/html/);
    expect(response.text).toBe(html);
  }

  const assetResponse = await request(app).get('/style.css');

  expect(assetResponse.status).toBe(200);
  expect(assetResponse.text).toBe(stylesheet);

  for (const url of [
    '/api',
    '/api/nonexistent-test-endpoint',
    '/missing-test-file.js',
  ]) {
    const response = await request(app).get(url);

    expect(response.status).toBe(404);
    expect(response.text).not.toBe(html);
  }

  const postResponse = await request(app)
    .post('/frontend-test-route')
    .send({});

  expect(postResponse.status).toBe(404);
});