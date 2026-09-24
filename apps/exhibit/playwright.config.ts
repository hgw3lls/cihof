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
    command: `npm run build && npx vite preview --port ${port}`,
    // These specs exercise the installed exhibit, so they need the kiosk
    // build: `recovery.spec.ts` opens the operator panel, which a public
    // target aliases to a stub that renders nothing. The target used to be
    // inherited from the fall-through default in `scripts/target.mjs`, which
    // is gone — an automated run now has to say which audience it is for, and
    // for this suite the answer is the one that is never published.
    //
    // It belongs here rather than inlined ahead of `npm run build`, because
    // `vite preview` loads `vite.config.ts` too, and that resolves the target
    // at module scope. A prefix on the build alone leaves the preview to fail
    // the same way one step later.
    //
    // The rest go here too, rather than as a `NAME=value` prefix on the command,
    // which Windows' command prompt cannot run. Test timings, and a site
    // address for the continuation-code specs to decode.
    env: {
      CIHOF_TARGET: 'kiosk',
      CIHOF_SITE_URL: 'https://clevelandinternationalhalloffame.com/cihof/',
      VITE_CIHOF_TEST_MODE: '1',
      VITE_CIHOF_IDLE_MS: '2500',
      VITE_CIHOF_WARNING_MS: '1200',
    },
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
