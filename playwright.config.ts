import { defineConfig } from '@playwright/test';

const port = Number(process.env.CIHOF_PLAYWRIGHT_PORT ?? 4174);
const basePath = process.env.CIHOF_PLAYWRIGHT_BASE_PATH ?? '/cihof/';
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${port}${basePath}`;

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  expect: {
    timeout: 10_000,
  },
  use: {
    baseURL,
    viewport: { width: 1920, height: 1080 },
    trace: 'retain-on-failure',
  },
  webServer: {
    command: `VITE_CIHOF_KIOSK_IDLE_MS=1600 VITE_CIHOF_KIOSK_RESET_WARNING_MS=500 npm run build:public && npm run preview -- --host 127.0.0.1 --port ${port}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
