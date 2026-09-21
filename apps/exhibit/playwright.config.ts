import { defineConfig } from '@playwright/test';

const port = Number(process.env.CIHOF_EXHIBIT_PLAYWRIGHT_PORT ?? 4331);
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://localhost:${port}/cihof/`;

export default defineConfig({
  testDir: './tests',
  testMatch: /.*\.spec\.ts/,
  timeout: 60_000,
  workers: 1,
  expect: { timeout: 15_000 },
  use: { baseURL, viewport: { width: 1280, height: 900 } },
  webServer: process.env.PLAYWRIGHT_SKIP_WEB_SERVER === '1' ? undefined : {
    command: `CIHOF_SITE_URL=https://clevelandinternationalhalloffame.com/cihof/ VITE_CIHOF_TEST_MODE=1 VITE_CIHOF_IDLE_MS=2500 VITE_CIHOF_WARNING_MS=1200 npm run build && npx vite preview --port ${port}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
