import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';

const baseUrl = process.env.CIHOF_BASE_URL ?? 'http://127.0.0.1:4175/cihof/';
const outputDirectory = resolve(process.env.CIHOF_MG04_DIR ?? 'artifacts/mg04-review');
const alexId = 'alex-machaskee-2010';
const augustId = 'august-pust-2010';

const states = [
  { name: 'relationship-index-desktop', viewport: { width: 1920, height: 1080 }, path: '?scene=links' },
  { name: 'same-year-context-desktop', viewport: { width: 1920, height: 1080 }, path: `?scene=links&person=${alexId}`, selectContext: true },
  { name: 'approved-evidence-desktop', viewport: { width: 1920, height: 1080 }, path: `?scene=links&person=${alexId}`, approved: true, selectApproved: true },
  { name: 'approved-evidence-list-mobile', viewport: { width: 390, height: 844 }, hasTouch: true, path: `?scene=links&person=${alexId}`, approved: true, showList: true },
];

await mkdir(outputDirectory, { recursive: true });
const browser = await chromium.launch();
const browserVersion = browser.version();
const captures = [];

try {
  for (const state of states) {
    const context = await browser.newContext({ viewport: state.viewport, hasTouch: state.hasTouch, serviceWorkers: 'block', reducedMotion: 'reduce' });
    const page = await context.newPage();
    const consoleErrors = [];
    const pageErrors = [];
    page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
    page.on('pageerror', (error) => pageErrors.push(error.message));

    if (state.approved) await installRelationshipFixture(page);
    await page.goto(new URL(state.path, baseUrl).href, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);

    if (state.path.includes('person=')) await page.locator('.map-node--center').waitFor();
    else await page.locator('.link-index__person').first().waitFor();
    if (state.selectContext) await page.locator('.map-node--class').first().click();
    if (state.selectApproved) await page.locator(`.map-node[data-person-id="${augustId}"]`).click();
    if (state.showList) {
      const row = page.locator('.link-relation-list li').filter({ hasText: 'synthetic civic history program' });
      await row.scrollIntoViewIfNeeded();
      await row.click({ position: { x: 30, y: 30 } });
    }

    const fileName = `${state.viewport.width}x${state.viewport.height}-${state.name}.png`;
    await page.screenshot({ path: resolve(outputDirectory, fileName), fullPage: false });
    captures.push({ state: state.name, viewport: state.viewport, hasTouch: Boolean(state.hasTouch), file: fileName, url: page.url(), consoleErrors, pageErrors });
    await context.close();
  }
} finally {
  await browser.close();
}

const manifest = {
  capturedAt: new Date().toISOString(),
  baseUrl,
  browser: { name: chromium.name(), version: browserVersion },
  platform: process.platform,
  architecture: process.arch,
  node: process.version,
  captureCount: captures.length,
  captures,
};
await writeFile(resolve(outputDirectory, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);

const errorCount = captures.reduce((count, capture) => count + capture.consoleErrors.length + capture.pageErrors.length, 0);
console.log(`Captured ${captures.length} MG-04 review images in ${outputDirectory}.`);
console.log(`Recorded ${errorCount} console or page errors.`);

async function installRelationshipFixture(page) {
  await page.route('**/data/cihof-runtime-data.json', async (route) => {
    const response = await route.fetch();
    const bundle = await response.json();
    bundle.relationships = [
      {
        id: 'fixture:alex-august-induction',
        sourcePersonId: alexId,
        targetEntityId: augustId,
        targetEntityType: 'person',
        type: 'inducted_by',
        displayLabel: 'Inducted by August Pust',
        reverseDisplayLabel: 'Inducted Alex Machaskee',
        referenceNote: 'Synthetic MG-04 fixture: reviewed induction program, page 4.',
        provenance: 'documented',
      },
      {
        id: 'fixture:alex-august-civic-work',
        sourcePersonId: alexId,
        targetEntityId: augustId,
        targetEntityType: 'person',
        type: 'civic_collaboration',
        displayLabel: 'Worked together on a synthetic civic history program used only to verify long, wrapping relationship explanations.',
        referenceNote: 'Synthetic MG-04 fixture: curator test register, item 18.',
        provenance: 'curated',
      },
    ];
    await route.fulfill({ response, json: bundle });
  });
}
