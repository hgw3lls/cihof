import { defineConfig } from 'astro/config';

// The companion route a visitor reaches by scanning a code at the wall. It is
// read on a phone, often on a weak connection, so every page is static HTML
// that needs no JavaScript to be read.
export default defineConfig({
  site: process.env.CIHOF_SITE_URL ?? 'https://clevelandinternationalhalloffame.com',
  base: process.env.CIHOF_BASE_PATH ?? '/cihof/',
  build: { format: 'directory' },
  devToolbar: { enabled: false },
});
