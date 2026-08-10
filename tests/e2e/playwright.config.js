const path = require('path');
const { defineConfig, devices } = require('@playwright/test');

const ROOT = path.resolve(__dirname, '..', '..');
const PORT = Number(process.env.E2E_PORT || 5055);
const DB_FILE = path.join(__dirname, '.tmp', 'e2e.db');

module.exports = defineConfig({
  testDir: __dirname,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],

  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    // Pinned so date-derived rendering (week grid, "today", RU/EN locale
    // formatting) is identical on every machine.
    timezoneId: 'UTC',
    locale: 'en-US',
    trace: 'retain-on-failure',
  },

  projects: [
    {
      name: 'desktop',
      testDir: path.join(__dirname, 'desktop'),
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
    {
      // Below the app's 720px breakpoint, with touch + mobile UA.
      name: 'mobile',
      testDir: path.join(__dirname, 'mobile'),
      use: { ...devices['Pixel 5'] },
    },
  ],

  webServer: {
    command: 'python tests/e2e/server.py',
    cwd: ROOT,
    url: `http://127.0.0.1:${PORT}/`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    stdout: 'ignore',
    stderr: 'pipe',
    env: { TODIES_DB_PATH: DB_FILE, E2E_PORT: String(PORT) },
  },
});
