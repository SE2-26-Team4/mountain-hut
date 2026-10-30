import { execFile } from 'node:child_process';
import {
  copyFile,
  mkdtemp,
  realpath,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import { it } from 'vitest';

const execFileAsync = promisify(execFile);

const serverDirectory = fileURLToPath(
  new URL('../../', import.meta.url),
);

it('rejects initialization when the SQL schema file is missing', async () => {
  const temporaryDirectory = await mkdtemp(
    path.join(os.tmpdir(), 'mountain-hut-missing-schema-test-'),
  );

  try {
    // Resolve filesystem aliases before comparing absolute paths.
    const resolvedDirectory = await realpath(temporaryDirectory);

    await copyFile(
      path.join(serverDirectory, 'db.js'),
      path.join(resolvedDirectory, 'db.js'),
    );

    await writeFile(
      path.join(resolvedDirectory, 'package.json'),
      JSON.stringify({ type: 'module' }),
    );

    await symlink(
      path.join(serverDirectory, 'node_modules'),
      path.join(resolvedDirectory, 'node_modules'),
      'dir',
    );

    const scriptPath = path.join(
      resolvedDirectory,
      'check-schema.mjs',
    );

    const expectedSchemaPath = path.join(
      resolvedDirectory,
      'mountain-hut-schema.sql',
    );

    await writeFile(
      scriptPath,
      `
        import assert from 'node:assert/strict';

        import database, {
          initializeDatabase,
        } from './db.js';

        try {
          await assert.rejects(
            () => initializeDatabase(),
            {
              message: ${JSON.stringify(
                `Database schema file not found: ${expectedSchemaPath}`,
              )},
            }
          );
        } finally {
          await new Promise((resolve, reject) => {
            database.close((error) => {
              if (error) {
                reject(error);
                return;
              }

              resolve();
            });
          });
        }
      `,
    );

    await execFileAsync(process.execPath, [scriptPath], {
      env: {
        ...process.env,
        NODE_ENV: 'test',
        DB_PATH: path.join(resolvedDirectory, 'test.sqlite'),
        SEED_DEMO_ACCOUNTS: 'false',
      },
      timeout: 10000,
    });
  } finally {
    await rm(temporaryDirectory, {
      recursive: true,
      force: true,
    });
  }
}, 15000);