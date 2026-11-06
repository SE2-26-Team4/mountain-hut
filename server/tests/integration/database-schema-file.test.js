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

// Allow child-process execution to be awaited.
const execFileAsync = promisify(execFile);

// Locate the server directory relative to this test file.
const serverDirectory = fileURLToPath(
  new URL('../../', import.meta.url),
);

// Initialization must report the expected schema path when the file is missing.
it('rejects initialization when the SQL schema file is missing', async () => {
  const temporaryDirectory = await mkdtemp(
    path.join(os.tmpdir(), 'mountain-hut-missing-schema-test-'),
  );

  try {
    // Resolve filesystem aliases before comparing absolute paths.
    const resolvedDirectory = await realpath(temporaryDirectory);

    // Copy the database module without copying its SQL schema.
    await copyFile(
      path.join(serverDirectory, 'db.js'),
      path.join(resolvedDirectory, 'db.js'),
    );

    // Keep the copied database module running as an ES module.
    await writeFile(
      path.join(resolvedDirectory, 'package.json'),
      JSON.stringify({ type: 'module' }),
    );

    // Reuse the server's installed dependencies in the temporary directory.
    await symlink(
      path.join(serverDirectory, 'node_modules'),
      path.join(resolvedDirectory, 'node_modules'),
      'dir',
    );

    // Define the isolated script location and the missing schema's expected path.
    const scriptPath = path.join(
      resolvedDirectory,
      'check-schema.mjs',
    );

    const expectedSchemaPath = path.join(
      resolvedDirectory,
      'mountain-hut-schema.sql',
    );

    // Create a script that checks the rejection and always closes the database.
    await writeFile(
      scriptPath,
      `
        import assert from 'node:assert/strict';

        import database, {
          initializeDatabase,
        } from './db.js';

        try {
          // Verify that initialization reports the missing schema's exact path.
          await assert.rejects(
            () => initializeDatabase(),
            {
              message: ${JSON.stringify(
                `Database schema file not found: ${expectedSchemaPath}`,
              )},
            }
          );
        } finally {
          // Close the connection even if the assertion fails.
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

    // Run the check in a separate process with a dedicated test database.
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
    // Remove the temporary files and database even if the check fails.
    await rm(temporaryDirectory, {
      recursive: true,
      force: true,
    });
  }
}, 15000);