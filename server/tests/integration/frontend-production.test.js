import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  mkdtemp,
  rm,
  writeFile,
} from 'node:fs/promises';

import request from 'supertest';

import {
  afterEach,
  beforeEach,
  expect,
  it,
  vi,
} from 'vitest';

// Locate the server directory using the application module's path.
const serverDirectory = fileURLToPath(
  new URL('../../app.js', import.meta.url),
);

const serverPath = path.dirname(serverDirectory);

// Keep the database module and temporary frontend directory available for cleanup.
let db;
let temporaryDirectory;

// Reload modules with production settings and an isolated in-memory database.
beforeEach(() => {
  vi.resetModules();

  vi.stubEnv('NODE_ENV', 'production');
  vi.stubEnv('SESSION_SECRET', 'frontend-production-test-secret');
  vi.stubEnv('DB_PATH', ':memory:');
  vi.stubEnv('SEED_DEMO_ACCOUNTS', 'false');
});

// Restore mocked paths, close the database, and remove temporary frontend files.
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
    // Restore environment variables even if closing the database fails.
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

// Production routing must serve frontend pages while preserving genuine 404 responses.
it('serves production pages and assets without masking missing APIs or files', async () => {
  temporaryDirectory = await mkdtemp(
    path.join(os.tmpdir(), 'mountain-hut-frontend-test-'),
  );

  // Create a minimal frontend page and stylesheet as static-file fixtures.
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

  // Import the application after configuring its environment and frontend path.
  db = await import('../../db.js');

  const { default: app } = await import('../../app.js');

  // Both the root URL and frontend routes must return the HTML entry point.
  for (const url of ['/', '/frontend-test-route']) {
    const response = await request(app).get(url);

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toMatch(/text\/html/);
    expect(response.text).toBe(html);
  }

  // Existing static assets must return their actual contents.
  const assetResponse = await request(app).get('/style.css');

  expect(assetResponse.status).toBe(200);
  expect(assetResponse.text).toBe(stylesheet);

  // Missing API endpoints and files must not fall back to the frontend page.
  for (const url of [
    '/api',
    '/api/nonexistent-test-endpoint',
    '/missing-test-file.js',
  ]) {
    const response = await request(app).get(url);

    expect(response.status).toBe(404);
    expect(response.text).not.toBe(html);
  }

  // The frontend fallback must not handle POST requests.
  const postResponse = await request(app)
    .post('/frontend-test-route')
    .send({});

  expect(postResponse.status).toBe(404);
});