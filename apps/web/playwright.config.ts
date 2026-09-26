import { defineConfig } from '@playwright/test';

const port = Number(process.env.CIHOF_WEB_PLAYWRIGHT_PORT ?? 4321);
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://localhost:${port}/cihof/`;

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  workers: 1,
  expect: { timeout: 10_000 },
  use: { baseURL, viewport: { width: 390, height: 844 } },
  webServer: process.env.PLAYWRIGHT_SKIP_WEB_SERVER === '1' ? undefined : {
    // Astro starts preview in the background, and returns at once, when it
    // detects a coding agent. Playwright would take that for a server that died
    // and leave it running. --ignore-lock keeps it in the foreground, so
    // Playwright owns it and stops it after the run.
    command: `npm run build && npx astro preview --port ${port} --ignore-lock`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
