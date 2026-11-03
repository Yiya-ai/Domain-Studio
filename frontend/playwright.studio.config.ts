import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/studio', timeout: 30_000, workers: 1, retries: 0,
  reporter: 'list',
  use: { launchOptions: { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH }, baseURL: 'http://127.0.0.1:18082', viewport: { width: 1440, height: 960 }, trace: 'retain-on-failure' },
  webServer: {
    command: 'node ../scripts/test-server.mjs', url: 'http://127.0.0.1:18082/api/v1/studio',
    reuseExistingServer: false, timeout: 60_000,
  },
});
