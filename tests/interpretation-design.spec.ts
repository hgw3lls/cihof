import { expect, test, type Page } from '@playwright/test';

const alexId = 'alex-machaskee-2010';

test.use({ serviceWorkers: 'block' });

async function routeBundle(page: Page, mutate: (bundle: any) => void) {
  await page.route('**/data/cihof-runtime-data.json', async (route) => {
    const response = await route.fetch();
    const bundle = await response.json();
    mutate(bundle);
    await route.fulfill({ response, json: bundle });
  });
}

async function boot(page: Page, query = '') {
  await page.addInitScript(() => window.localStorage.clear());
  await page.goto(`./${query}`);
  await expect(page.locator('.person-tile')).toHaveCount(111);
}

async function openAlexRecord(page: Page) {
  await page.getByRole('searchbox', { name: 'Find a person or year' }).fill('Alex Machaskee');
  await page.getByRole('button', { name: /Select Alex Machaskee/ }).click();
  await page.getByRole('button', { name: 'Open full record for Alex Machaskee' }).click();
  await expect(page.getByRole('region', { name: 'Alex Machaskee full record' })).toBeVisible();
}

test('the neutral state offers non-blocking, non-typing ways to begin', async ({ page }) => {
  await boot(page);

  const overview = page.getByRole('complementary', { name: 'Archive overview' });
  await expect(overview.getByRole('heading', { name: 'Choose a person' })).toBeVisible();
  await expect(overview).toContainText('Browse by contribution, community, or induction year');
  await expect(page.getByRole('combobox', { name: 'Filter by contribution' })).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Filter by induction year' })).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Filter by community' })).toBeVisible();
  await expect(page.locator('.person-tile')).toHaveCount(111);
});

test('approved contribution, year, and community filters combine and reset with the session', async ({ page }) => {
  await boot(page);

  await page.getByRole('combobox', { name: 'Filter by contribution' }).selectOption('Education');
  await page.getByRole('combobox', { name: 'Filter by induction year' }).selectOption('2010');
  await page.getByRole('combobox', { name: 'Filter by community' }).selectOption('European Heritage');
  await expect(page.locator('.people-tools__count')).toContainText('5 OF 111');
  await expect(page.locator('.person-tile')).toHaveCount(5);
  await expect(page.locator('.person-tile')).toContainText([
    'August Pust',
    'Jeanette Grasselli Brown',
    'Lonnie McCauley',
    'Paul Sciria',
    'Robert J. Haas',
  ]);

  await page.getByRole('button', { name: 'START OVER' }).click();
  await expect(page.getByRole('combobox', { name: 'Filter by contribution' })).toHaveValue('');
  await expect(page.getByRole('combobox', { name: 'Filter by induction year' })).toHaveValue('');
  await expect(page.getByRole('combobox', { name: 'Filter by community' })).toHaveValue('');
  await expect(page.locator('.person-tile')).toHaveCount(111);
});

test('search ignores accents without changing displayed names', async ({ page }) => {
  await boot(page);
  await page.getByRole('searchbox', { name: 'Find a person or year' }).fill('Jose C');

  await expect(page.locator('.person-tile')).toHaveCount(1);
  await expect(page.getByRole('button', { name: /Select José C\. Feliciano,/ })).toBeVisible();
  await page.getByRole('searchbox', { name: 'Find a person or year' }).fill('Jose A');
  await expect(page.locator('.person-tile')).toHaveCount(1);
  await expect(page.getByRole('button', { name: /Select Honorable José A\. Villanueva,/ })).toBeVisible();
});

test('the record preserves source text and publishes only approved context and archival material', async ({ page }) => {
  const biography = 'lowercase source opening remains exact.\n\nA second source paragraph stays unchanged.';
  const contribution = 'Exact approved contribution text remains unchanged.';
  await routeBundle(page, (bundle) => {
    const person = bundle.inductees.find((candidate: any) => candidate.id === alexId);
    person.bioText = biography;
    person.honoredForSummary = contribution;
    bundle.storySections.records[alexId] = {
      inducteeId: alexId,
      provenance: 'curated',
      beats: [{
        id: 'fixture-cleveland-context',
        contextScope: 'cleveland',
        reviewStatus: 'approved',
        sourceReference: 'CIHOF source biography',
        headline: 'A sourced Cleveland chapter',
        body: 'Exact curated Cleveland context from the synthetic fixture.',
        place: 'Cleveland',
        organization: 'Fixture archive',
        provenance: 'curated',
      }, {
        id: 'fixture-draft-context', contextScope: 'cleveland', reviewStatus: 'draft',
        sourceReference: 'Draft reference', headline: 'Unapproved context', body: 'Must remain hidden.', provenance: 'curated',
      }, {
        id: 'fixture-unsourced-context', contextScope: 'cleveland', reviewStatus: 'approved',
        headline: 'Unsourced context', body: 'Must also remain hidden.', provenance: 'curated',
      }],
    };
    bundle.archiveLeads.records.push({
      id: 'fixture-approved-archive',
      inducteeId: alexId,
      title: 'Approved fixture program',
      repository: 'Fixture Historical Society',
      collectionTitle: 'Fixture programs',
      callNumber: 'FIX-04',
      displayText: 'Exact approved archival description.',
      creditLine: 'Courtesy of the fixture collection.',
      rightsNote: 'Synthetic test permission for public-web description only.',
      sourceUrl: 'https://example.org/fixture-program',
      approvedForPublicWeb: true,
      approvedForKiosk: false,
      status: 'visitor-ready',
      visibility: 'visitor-ready',
      connectionStrength: 'direct',
    }, {
      id: 'fixture-staff-only-archive',
      inducteeId: alexId,
      title: 'Staff-only catalog lead',
      repository: 'Fixture Historical Society',
      displayText: 'This unapproved lead must remain hidden.',
      status: 'catalog-lead',
      visibility: 'staff-review',
      connectionStrength: 'contextual',
    }, {
      id: 'fixture-kiosk-only', inducteeId: alexId, title: 'Kiosk-only archive',
      repository: 'Fixture archive', displayText: 'Not cleared for public web.',
      status: 'visitor-ready', visibility: 'visitor-ready', connectionStrength: 'direct',
      sourceUrl: 'https://example.org/kiosk', rightsNote: 'Kiosk only', approvedForKiosk: true,
    });
  });
  await boot(page);
  await openAlexRecord(page);

  const record = page.getByRole('region', { name: 'Alex Machaskee full record' });
  await expect(record.getByText(contribution, { exact: true })).toBeVisible();
  const biographyText = await record.locator('.record-view__story p:not(.record-view__kicker)').allTextContents();
  expect(biographyText.join(' ')).toBe(biography);
  await expect(record).not.toContainText(`Alex Machaskee ${biography}`);
  await expect(record.getByRole('heading', { name: 'Cleveland context' })).toBeVisible();
  await expect(record).toContainText('Exact curated Cleveland context from the synthetic fixture.');
  await expect(record).toContainText('Source: CIHOF source biography');
  await expect(record.getByRole('heading', { name: 'Archival material' })).toBeVisible();
  await expect(record).toContainText('Approved fixture program');
  await expect(record).toContainText('FIX-04');
  await expect(record).not.toContainText('Staff-only catalog lead');
  await expect(record).not.toContainText('Kiosk-only archive');
  await expect(record).not.toContainText('Unapproved context');
  await expect(record).not.toContainText('Unsourced context');
  await expect(record).toContainText('Additional published items2');
});

test('records without approved context or archival material do not invent placeholders', async ({ page }) => {
  await boot(page);
  await openAlexRecord(page);

  const record = page.getByRole('region', { name: 'Alex Machaskee full record' });
  await expect(record.getByRole('heading', { name: 'Cleveland context' })).toHaveCount(0);
  await expect(record.getByRole('heading', { name: 'Archival material' })).toHaveCount(0);
  await expect(record).toContainText('None published with this record');
  await expect(record).not.toContainText(/placeholder|coming soon|catalog lead/i);
});

test('curated focal points reach every portrait crop', async ({ page }) => {
  await routeBundle(page, (bundle) => {
    bundle.inductees.find((candidate: any) => candidate.id === alexId).imageFocalPoint = '20% 80%';
  });
  await boot(page, `?person=${alexId}`);

  await expect(page.locator('.focus .photo img')).toHaveCSS('object-position', '20% 80%');
  await expect(page.locator(`.person-tile[data-person-id="${alexId}"] .photo img`)).toHaveCSS('object-position', '20% 80%');
});

test('long-form reading remains contained and readable in both themes on mobile', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  try {
    await boot(page);
    await openAlexRecord(page);
    await page.evaluate(() => document.fonts.ready);

    const metrics = await page.evaluate(() => {
      const paragraph = document.querySelector<HTMLElement>('.record-view__story p:not(.record-view__kicker)');
      const style = paragraph ? getComputedStyle(paragraph) : null;
      return {
        viewport: window.innerWidth,
        page: document.documentElement.scrollWidth,
        fontFamily: style?.fontFamily ?? '',
        lineHeight: Number.parseFloat(style?.lineHeight ?? '0'),
        fontSize: Number.parseFloat(style?.fontSize ?? '1'),
      };
    });
    expect(metrics.page).toBeLessThanOrEqual(metrics.viewport + 1);
    expect(metrics.fontFamily).toContain('Newsreader');
    expect(metrics.lineHeight / metrics.fontSize).toBeGreaterThanOrEqual(1.4);

    await page.getByRole('button', { name: 'Switch to dark mode' }).click();
    await expect(page.locator('.installation')).toHaveAttribute('data-theme', 'dark');
    await expect(page.locator('#recordTitle')).toHaveText('Alex Machaskee');
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  } finally {
    await context.close();
  }
});

test('the public fallback feed preserves every approved and source text field byte-for-byte', async ({ request }) => {
  const bundleResponse = await request.get('./data/cihof-runtime-data.json');
  const fallbackResponse = await request.get('./data/inductees.json');
  expect(bundleResponse.ok()).toBe(true);
  expect(fallbackResponse.ok()).toBe(true);
  const bundle = await bundleResponse.json();
  const fallback = await fallbackResponse.json();
  const fallbackById = new Map(fallback.map((person: any) => [person.id, person]));

  expect(bundle.inductees).toHaveLength(111);
  for (const person of bundle.inductees) {
    const twin: any = fallbackById.get(person.id);
    expect(twin, person.id).toBeTruthy();
    for (const field of ['bioText', 'storySummary', 'honoredForSummary', 'lifeWorkSummary']) {
      expect(twin[field], `${person.id}.${field}`).toBe(person[field]);
    }
  }
});
