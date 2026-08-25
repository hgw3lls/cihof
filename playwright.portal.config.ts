import { defineConfig } from '@playwright/test';

const port = Number(process.env.CIHOF_PORTAL_PLAYWRIGHT_PORT ?? 4175);
const basePath = process.env.CIHOF_PLAYWRIGHT_BASE_PATH ?? '/cihof/';
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${port}${basePath}`;
const skipWebServer = process.env.PLAYWRIGHT_SKIP_WEB_SERVER === '1';

export default defineConfig({
  testDir: './tests',
  testMatch: /portal-.*\.spec\.ts/,
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
      command: `npm run build:portal && npm run preview -- --host 127.0.0.1 --port ${port} --outDir dist-portal`,
      url: `${baseURL}portal.html`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
});
