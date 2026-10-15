import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './projects/ui-qa/tests',
  workers: 1,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:3100',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: 'npm start',
    env: { PORT: '3100' },
    url: 'http://127.0.0.1:3100/health',
    reuseExistingServer: false,
  },
});
