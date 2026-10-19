import { defineConfig, devices } from '@playwright/test';

declare const process: {
  env: Record<string, string | undefined>;
};

export default defineConfig({
  testDir: './e2e',
  timeout: 60 * 1000,
  expect: {
    timeout: 10 * 1000,
  },
  fullyParallel: false,
  forbidOnly: Boolean(typeof process !== 'undefined' && process.env?.CI),
  retries: typeof process !== 'undefined' && process.env?.CI ? 2 : 0,
  workers: 1,
  reporter: [
    ['html', { open: 'never' }],
    ['list']
  ],
  use: {
    baseURL: (typeof process !== 'undefined' && process.env?.PLAYWRIGHT_BASE_URL) || 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'on',
    viewport: { width: 1440, height: 900 },
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
