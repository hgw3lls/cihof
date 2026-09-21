import { defineConfig } from '@playwright/test';
import { readFileSync } from 'node:fs';

const port = Number(process.env.CIHOF_PLAYWRIGHT_PORT ?? 4174);
const basePath = process.env.CIHOF_PLAYWRIGHT_BASE_PATH ?? '/cihof/';
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${port}${basePath}`;
const skipWebServer = process.env.PLAYWRIGHT_SKIP_WEB_SERVER === '1';

// Single source of truth, shared with scripts/assert-test-count.mjs.
const minimumTests = Number(process.env.CIHOF_MINIMUM_TESTS ?? readMinimums().visitor);

function readMinimums() {
  return JSON.parse(readFileSync(new URL('./tests/minimum-tests.json', import.meta.url), 'utf8')) as Record<string, number>;
}

export default defineConfig({
  testDir: './tests',
  testIgnore: /portal-.*\.spec\.ts/,
  reporter: [['list'], ['./tests/reporters/collected-count.ts', { minimum: minimumTests }]],
  timeout: 30_000,
  workers: 1,
  expect: {
    timeout: 10_000,
  },
  use: {
    baseURL,
    viewport: { width: 1920, height: 1080 },
    trace: 'retain-on-failure',
  },
  webServer: skipWebServer
    ? undefined
    : {
      command: `VITE_CIHOF_ADMIN_PASSCODE=cihof-admin VITE_CIHOF_KIOSK_IDLE_MS=1600 VITE_CIHOF_KIOSK_RESET_WARNING_MS=500 VITE_CIHOF_QR_AUTO_CLOSE_MS=900 npm run build:public && npm run preview -- --host 127.0.0.1 --port ${port}`,
      url: baseURL,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
});
