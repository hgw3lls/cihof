import { mkdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { chromium } from '@playwright/test';

/**
 * Draws the app icon from the Hall of Fame's skyline: the four lens bands on
 * the exhibit's ground, as the brand guide sets them
 * (docs/brand/skyline-guidelines.md). The skyline is the supplied mask, never
 * redrawn; this only fills it and places it.
 *
 *   node apps/kiosk-app/scripts/icon.mjs
 *
 * Writes apps/kiosk-app/build/icon.png (1024 x 1024), which electron-builder
 * turns into the Windows, macOS and Linux icons. Run it again only if the mask
 * or the colours change; the result is committed.
 */
const root = resolve(import.meta.dirname, '..', '..', '..');
// Inline, because a CSS mask will not load a file from a blank page.
const mask = `data:image/png;base64,${readFileSync(join(root, 'apps', 'exhibit', 'public', 'brand', 'skyline-mask.png')).toString('base64')}`;
const out = join(root, 'apps', 'kiosk-app', 'build');
mkdirSync(out, { recursive: true });

const browser = await chromium.launch(process.env.CIHOF_CHROMIUM ? { executablePath: process.env.CIHOF_CHROMIUM } : {});
const page = await browser.newPage({ viewport: { width: 1024, height: 1024 } });
// Clear space of half the tallest tower on every side, as the guide asks:
// 820px wide leaves more than that at this size.
await page.setContent(`<!doctype html><body style="margin:0;width:1024px;height:1024px;display:grid;place-items:center;background:#121211">
  <div style="width:820px;aspect-ratio:724/469;
    -webkit-mask:url('${mask}') center/contain no-repeat;mask:url('${mask}') center/contain no-repeat;
    background:linear-gradient(90deg,#24d2fc 0 41%,#e7b643 41% 58%,#75d78d 58% 71%,#ff9b7f 71% 100%)"></div>
</body>`);
await page.waitForTimeout(300);
await page.screenshot({ path: join(out, 'icon.png') });
await browser.close();
console.log(`Wrote ${join(out, 'icon.png')}`);
