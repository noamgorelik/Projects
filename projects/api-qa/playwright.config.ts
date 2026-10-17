import { defineConfig } from '@playwright/test';
import { fileURLToPath } from 'node:url';

const repositoryRoot = fileURLToPath(new URL('../../', import.meta.url));

export default defineConfig({
  testDir: './tests',
  workers: 1,
  retries: 0,
  outputDir: fileURLToPath(new URL('../../test-results/api/', import.meta.url)),
  reporter: [
    ['list'],
    ['html', {
      outputFolder: fileURLToPath(new URL('../../playwright-report/api/', import.meta.url)),
      open: 'never',
    }],
  ],
  use: { baseURL: 'http://127.0.0.1:3200' },
  webServer: {
    command: 'npm start',
    cwd: repositoryRoot,
    env: { PORT: '3200', PRACTICE_TEST_RESET: '1' },
    url: 'http://127.0.0.1:3200/health',
    reuseExistingServer: false,
  },
});
