import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const testDbPath = fileURLToPath(new URL('./tests/mh-test.sqlite', import.meta.url));

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
    globalSetup: ['tests/globalSetup.js'],
    setupFiles: ['tests/setup.js'],
    env: {
      NODE_ENV: 'test',
      DB_PATH: testDbPath,
      SEED_DEMO_ACCOUNTS: 'true',
    },
    fileParallelism: false, // all test files share mh-test.sqlite, so avoid races
    coverage: {
      provider: 'v8',
      include: ['**/*.js'],
      exclude: ['tests/**', 'coverage/**', 'vitest.config.js', 'index.js'],
      reporter: ['text-summary', 'html', 'lcov'],
    },
  },
});
