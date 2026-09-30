import { mkdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { chromium } from '@playwright/test';

/**
 * Draws the staff review app's icon from the Hall of Fame's skyline: one
 * colour, the ink, on light paper, as the brand guide sets it for light
 * grounds (docs/brand/skyline-guidelines.md, 2C). That keeps it apart from
 * the exhibit's own icon, the four lens bands on the dark ground. The skyline
 * is the supplied mask, never redrawn; this only fills it and places it.
 *
 *   node apps/review-app/scripts/icon.mjs
 *
 * Writes apps/review-app/build/icon.png (1024 x 1024), which electron-builder
 * turns into the Windows, macOS and Linux icons. Run it again only if the mask
 * or the colours change; the result is committed.
 */
const root = resolve(import.meta.dirname, '..', '..', '..');
// Inline, because a CSS mask will not load a file from a blank page.
const mask = `data:image/png;base64,${readFileSync(join(root, 'apps', 'exhibit', 'public', 'brand', 'skyline-mask.png')).toString('base64')}`;
const out = join(root, 'apps', 'review-app', 'build');
mkdirSync(out, { recursive: true });

const browser = await chromium.launch(process.env.CIHOF_CHROMIUM ? { executablePath: process.env.CIHOF_CHROMIUM } : {});
const page = await browser.newPage({ viewport: { width: 1024, height: 1024 } });
// Clear space of half the tallest tower on every side, as the guide asks:
// 820px wide leaves more than that at this size.
await page.setContent(`<!doctype html><body style="margin:0;width:1024px;height:1024px;display:grid;place-items:center;background:#f4f2ec">
  <div style="width:820px;aspect-ratio:724/469;
    -webkit-mask:url('${mask}') center/contain no-repeat;mask:url('${mask}') center/contain no-repeat;
    background:#121211"></div>
</body>`);
await page.waitForTimeout(300);
await page.screenshot({ path: join(out, 'icon.png') });
await browser.close();
console.log(`Wrote ${join(out, 'icon.png')}`);
