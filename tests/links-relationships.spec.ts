import { expect, test, type Page } from '@playwright/test';

test('record return preserves the explored connection and Start over clears it', async ({ page }) => {
  await page.goto('./?person=alex-machaskee-2010&scene=links');
  const node = page.locator('.map-node:not(.map-node--center)').first();
  await node.click();
  const title = page.locator('#linkConnectionDetail h2');
  const before = await title.innerText();
  expect(before).not.toBe('SELECT A PORTRAIT');
  for (let visit = 0; visit < 2; visit += 1) {
    await page.locator('#mapCenterButton').click();
    await page.getByRole('button', { name: 'CLOSE', exact: true }).click();
    await expect(title).toHaveText(before);
    await expect(page.locator('#mapCenterButton')).toBeFocused();
  }
  await page.getByRole('button', { name: 'START OVER', exact: true }).click();
  await page.getByRole('button', { name: /Select Alex Machaskee,/ }).click();
  await page.getByRole('button', { name: 'LINKS', exact: true }).click();
  await expect(page.locator('#linkConnectionDetail')).toBeHidden();
});

const alexId = 'alex-machaskee-2010';
const augustId = 'august-pust-2010';

test.use({ serviceWorkers: 'block' });

for (const input of ['mouse', 'touch', 'keyboard', 'phone'] as const) {
  test(`portrait preview then recenter works with ${input}`, async ({ browser }) => {
    const context = await browser.newContext({ hasTouch: input === 'touch' || input === 'phone', serviceWorkers: 'block',
      ...(input === 'phone' ? { viewport: { width: 390, height: 844 }, isMobile: true } : {}) });
    const page = await context.newPage();
    // Deliberately no try/finally around the body. Closing the context in a
    // finally throws "Test ended" once a test has timed out, and that error
    // replaces the assertion that actually failed — which made the first CI
    // failure of this test undiagnosable. Playwright tears the context down
    // with the worker, so the real error survives instead.
    {
      await page.goto(`${test.info().project.use.baseURL}?scene=links&person=alex-machaskee-2010`);
      const center = page.locator('#mapCenterButton');
      const nodes = page.locator('.map-node:not(.map-node--center)');
      await expect(center).toContainText('Alex Machaskee');
      const firstId = await nodes.nth(0).getAttribute('data-person-id');
      const secondId = await nodes.nth(1).getAttribute('data-person-id');
      const first = page.locator(`.map-node[data-person-id="${firstId}"]`);
      const second = page.locator(`.map-node[data-person-id="${secondId}"]`);
      const activate = async (node: typeof first) => {
        if (input === 'touch' || input === 'phone') await node.tap();
        else if (input === 'keyboard') { await node.focus(); await page.keyboard.press('Enter'); }
        else await node.click();
      };
      await activate(first);
      await expect(first).toHaveAttribute('aria-pressed', 'true');
      const preview = page.locator('.link-map__preview');
      await expect(preview).toHaveAttribute('aria-hidden', 'true');
      await expect(preview).toHaveCSS('pointer-events', 'none');
      await expect(preview.locator('button, a, input, [tabindex]')).toHaveCount(0);
      expect(await preview.locator('.network-preview-person').count()).toBeGreaterThan(1);
      await expect(center).toContainText('Alex Machaskee');
      await expect(page.locator('#linkConnectionDetail h2')).toHaveText(await first.locator('strong').innerText());
      await activate(second);
      await expect(first).toHaveAttribute('aria-pressed', 'false');
      await expect(center).toContainText('Alex Machaskee');
      await expect(second).toHaveAccessibleName(/Center connections on/);
      await activate(second);
      await expect(center).toHaveAttribute('data-person-id', secondId!);
      await expect(page.locator('#linkConnectionDetail')).toBeHidden();
      await expect(preview).toHaveCount(0);
      if (input === 'keyboard') await expect(center).toBeFocused();
      expect(new URL(page.url()).searchParams.get('person')).toBe(secondId);
    }
    await context.close();
  });
}

test('map context dismisses with Escape or background and keeps the list optional', async ({ page }) => {
  await bootLinks(page);
  await expect(page.locator('#connectionList')).toBeHidden();
  const node = page.locator('.map-node:not(.map-node--center)').first();
  await node.click();
  await expect(page.locator('#linkConnectionDetail')).toBeVisible();
  await page.locator('#linkConnectionDetail summary').first().click();
  await expect(page.locator('#linkConnectionDetail dl').first()).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#linkConnectionDetail')).toBeHidden();
  await expect(node).toBeFocused();
  await node.click();
  await page.locator('.link-map__viewport').click({ position: { x: 5, y: 5 } });
  await expect(page.locator('.link-map__preview')).toHaveCount(0);
  await page.getByRole('button', { name: 'Connection list' }).click();
  await expect(page.locator('#linkRelationListTitle')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Connection list' })).toBeFocused();
  await expect(page.locator('#connectionList')).toBeHidden();
});

function approvedRelationships() {
  return [
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
}

async function routeBundle(page: Page, mutate: (bundle: any) => void) {
  await page.route('**/data/cihof-runtime-data.json', async (route) => {
    const response = await route.fetch();
    const bundle = await response.json();
    mutate(bundle);
    await route.fulfill({ response, json: bundle });
  });
}

async function bootLinks(page: Page, personId = alexId) {
  await page.addInitScript(() => window.localStorage.clear());
  await page.goto(`./?scene=links&person=${personId}`);
  await expect(page.locator('.map-node--center')).toBeVisible();
}

test('a directional relationship keeps its meaning and source from either endpoint', async ({ page }) => {
  await routeBundle(page, (bundle) => { bundle.relationships = [approvedRelationships()[0]]; });
  await bootLinks(page);

  await page.locator(`.map-node[data-person-id="${augustId}"]`).click();
  const detail = page.locator('#linkConnectionDetail');
  await expect(detail).toContainText('Alex Machaskee was inducted by August Pust.');
  await expect(detail).toContainText('FROM CENTER RECORD');
  await expect(detail).toContainText('reviewed induction program, page 4');
  await expect(detail).toContainText('DOCUMENTED SOURCE');

  await detail.getByRole('button', { name: 'CENTER ON August Pust' }).click();
  await expect(page.locator('.map-node--center')).toContainText('August Pust');
  await page.locator(`.map-node[data-person-id="${alexId}"]`).click();
  await expect(detail).toContainText('Alex Machaskee was inducted by August Pust.');
  await expect(detail).toContainText('TO CENTER RECORD');
});

test('multiple approved relationships for one pair remain distinct from same-year context', async ({ page }) => {
  await routeBundle(page, (bundle) => { bundle.relationships = approvedRelationships(); });
  await bootLinks(page);

  await expect(page.locator('.link-map__legend')).toContainText('2 DOCUMENTED RELATIONSHIPS');
  await expect(page.locator(`.map-node[data-person-id="${augustId}"]`)).toHaveCount(1);
  await page.locator(`.map-node[data-person-id="${augustId}"]`).click();

  const detail = page.locator('#linkConnectionDetail');
  await expect(detail.getByText('INDUCTION', { exact: true })).toBeVisible();
  await expect(detail.getByText('CIVIC COLLABORATION', { exact: true })).toBeVisible();
  await expect(detail.getByText('SHARED INDUCTION YEAR', { exact: true })).toBeVisible();
  await expect(detail).toContainText('Honored in the same year: 2010.');
  await expect(page.locator('.link-relation-list li').filter({ hasText: 'August Pust' })).toHaveCount(3);
});

test('provisional, unsourced, and manually duplicated same-class rows remain unpublished', async ({ page }) => {
  const records = [
    approvedRelationships()[0],
    { ...approvedRelationships()[1], id: 'fixture:provisional', provenance: 'inferred', displayLabel: 'Provisional friendship claim' },
    { ...approvedRelationships()[1], id: 'fixture:unsourced', referenceNote: '', displayLabel: 'Unsourced colleague claim' },
    { ...approvedRelationships()[1], id: 'fixture:manual-class', type: 'same_class', displayLabel: 'Classmates claim' },
  ];
  await routeBundle(page, (bundle) => { bundle.relationships = records; });
  await bootLinks(page);

  await expect(page.locator('.link-map__legend')).toContainText('1 DOCUMENTED RELATIONSHIP');
  await expect(page.getByText('Provisional friendship claim')).toHaveCount(0);
  await expect(page.getByText('Unsourced colleague claim')).toHaveCount(0);
  await expect(page.getByText('Classmates claim')).toHaveCount(0);
  await expect(page.getByText(/classmates/i)).toHaveCount(0);
});

test('same-year-only context is explicit and does not imply a personal relationship', async ({ page }) => {
  await routeBundle(page, (bundle) => { bundle.relationships = []; });
  await bootLinks(page);

  await expect(page.locator('.link-map__legend')).toContainText('0 DOCUMENTED RELATIONSHIPS');
  await page.getByRole('button', { name: 'Connection list' }).click();
  await expect(page.getByText('NO APPROVED DOCUMENTED RELATIONSHIPS')).toBeVisible();
  await page.getByRole('button', { name: 'Connection list' }).click();
  await page.locator('.map-node--class').first().click();
  await expect(page.locator('#linkConnectionDetail')).toContainText('Honored in the same year: 2010.');
  await expect(page.locator('#linkConnectionDetail')).toContainText('SHARED CONTEXT');
  await expect(page.locator('#linkConnectionDetail')).toContainText('CIHOF induction year in both records.');
});

test('an unknown induction year does not create an artificial cohort', async ({ page }) => {
  await routeBundle(page, (bundle) => {
    bundle.relationships = [];
    bundle.inductees.find((person: any) => person.id === alexId).classYear = null;
  });
  await bootLinks(page);

  await expect(page.locator('.map-node')).toHaveCount(1);
  await expect(page.locator('.link-map__notice')).toHaveText('NO DOCUMENTED CONNECTIONS OR SHARED INDUCTION-YEAR CONTEXT.');
  await expect(page.getByText(/honored in the same year/i)).toHaveCount(1);
});

test('relationship loading failure stays distinct from an empty approved set and offers retry', async ({ page }) => {
  await page.addInitScript(() => window.localStorage.clear());
  await page.route('**/data/cihof-runtime-data.json', (route) => route.fulfill({ status: 503, body: 'offline fixture' }));
  await page.route('**/data/relationships.json', (route) => route.fulfill({ status: 503, body: 'offline fixture' }));
  await page.goto(`./?scene=links&person=${alexId}`);

  await expect(page.locator('.map-node--center')).toBeVisible();
  const alert = page.getByRole('alert');
  await expect(alert).toContainText(/relationships request failed|could not load relationships/i);
  await expect(alert.getByRole('button', { name: 'RETRY' })).toBeVisible();
  await expect(page.getByText('NO APPROVED DOCUMENTED RELATIONSHIPS')).toHaveCount(0);
});

test('the relationship list is keyboard-operable and repeated re-centering remains predictable', async ({ page }) => {
  await routeBundle(page, (bundle) => { bundle.relationships = approvedRelationships(); });
  await bootLinks(page);

  const augustRow = page.locator('.link-relation-list__select').filter({ hasText: 'August Pust' }).first();
  await page.getByRole('button', { name: 'Connection list' }).click();
  await augustRow.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#linkConnectionDetail')).toContainText('August Pust');
  await page.locator('#linkConnectionDetail').getByRole('button', { name: 'CENTER ON August Pust' }).click();
  await expect(page.locator('.map-node--center')).toContainText('August Pust');

  const alexRow = page.locator('.link-relation-list__select').filter({ hasText: 'Alex Machaskee' }).first();
  await page.getByRole('button', { name: 'Connection list' }).click();
  await alexRow.focus();
  await page.keyboard.press('Enter');
  await page.locator('#linkConnectionDetail').getByRole('button', { name: 'CENTER ON Alex Machaskee' }).click();
  await expect(page.locator('.map-node--center')).toContainText('Alex Machaskee');
});

test('long evidence labels remain readable without page overflow on a narrow screen', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  try {
    await routeBundle(page, (bundle) => { bundle.relationships = approvedRelationships(); });
    await bootLinks(page);
    const row = page.locator('.link-relation-list li').filter({ hasText: 'synthetic civic history program' });
    await page.getByRole('button', { name: 'Connection list' }).click();
    await expect(row).toBeVisible();
    const dimensions = await page.evaluate(() => ({ viewport: window.innerWidth, page: document.documentElement.scrollWidth }));
    expect(dimensions.page).toBeLessThanOrEqual(dimensions.viewport + 1);
    const action = row.getByRole('button', { name: 'READ RECORD' });
    await expect(action).toBeVisible();
    const box = await action.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x + box!.width).toBeLessThanOrEqual(390);
  } finally {
    await context.close();
  }
});

test('the public artifact withholds provisional relationship graph payloads', async ({ request }) => {
  const provisionalTypes = ['inducted_by_candidate', 'legacy_related_candidate', 'related_to'];
  const isProvisional = (value: unknown) => provisionalTypes.includes(String(value));

  const bundleResponse = await request.get('./data/cihof-runtime-data.json');
  expect(bundleResponse.ok()).toBe(true);
  const bundle = await bundleResponse.json();
  expect(bundle.inductees.every((person: any) => !Object.hasOwn(person, 'relatedIds'))).toBe(true);
  expect(bundle.entities.entities.some((entity: any) => entity.attributes?.candidateEntity === true)).toBe(false);
  expect(bundle.entities.entities.some((entity: any) => Object.hasOwn(entity.attributes ?? {}, 'relatedIds'))).toBe(false);
  expect(bundle.entityRelationships.relationships.some((relationship: any) => isProvisional(relationship.type))).toBe(false);

  const inducteesResponse = await request.get('./data/inductees.json');
  expect(inducteesResponse.ok()).toBe(true);
  const inductees = await inducteesResponse.json();
  expect(inductees.every((person: any) => !Object.hasOwn(person, 'relatedIds'))).toBe(true);

  const entitiesResponse = await request.get('./data/entities.json');
  expect(entitiesResponse.ok()).toBe(true);
  const entities = await entitiesResponse.json();
  expect(entities.entities.some((entity: any) => entity.attributes?.candidateEntity === true)).toBe(false);
  expect(entities.entities.some((entity: any) => Object.hasOwn(entity.attributes ?? {}, 'relatedIds'))).toBe(false);

  const graphResponse = await request.get('./data/entity-relationships.json');
  expect(graphResponse.ok()).toBe(true);
  const graph = await graphResponse.json();
  expect(graph.relationships.some((relationship: any) => isProvisional(relationship.type))).toBe(false);

  const linkedArtResponse = await request.get('./data/linked-art-export.json');
  expect(linkedArtResponse.ok()).toBe(true);
  const linkedArt = await linkedArtResponse.json();
  expect(linkedArt._cihof_relationship_assertions.some((assertion: any) => isProvisional(assertion.type))).toBe(false);

  const cidocResponse = await request.get('./data/cidoc-crm-export.json');
  expect(cidocResponse.ok()).toBe(true);
  const cidoc = await cidocResponse.json();
  expect(cidoc['crm:P67_refers_to'].some((relationship: any) => isProvisional(relationship['crm:P2_has_type']))).toBe(false);
});
