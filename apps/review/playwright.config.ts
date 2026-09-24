import { defineConfig } from '@playwright/test';

// The review app saves by committing, so its browser test runs against a
// throwaway git worktree that the spec creates and removes itself. Build the
// pages first: npm run build --workspace @cihof/review.
export default defineConfig({
  testDir: './tests',
  testMatch: /.*\.spec\.ts/,
  timeout: 180_000,
  workers: 1,
  expect: { timeout: 30_000 },
  use: { viewport: { width: 1280, height: 900 } },
});
