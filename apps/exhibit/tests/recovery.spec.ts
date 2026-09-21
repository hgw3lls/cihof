import { expect, test, type Page } from '@playwright/test';

/**
 * O04 and O11: a release that works survives, and staff can recover.
 *
 * O04 — an interrupted download or a bad checksum leaves the last working
 * release serving.
 * O11 — staff can identify the release, inspect what is missing, restore the
 * last known good one, and record the outcome.
 */
async function provisioned(page: Page) {
  await page.goto('.');
  await expect(page.locator('.tile').first()).toBeVisible();
  await page.evaluate(async () => {
    const manifest = await (await fetch('release.json')).json();
    for (let attempt = 0; attempt < 120; attempt += 1) {
      const key = (await caches.keys()).find((name) => name.startsWith('cihof-exhibit:') && !name.endsWith(':state'));
      if (key && (await (await caches.open(key)).keys()).length >= manifest.assets.length) return;
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    throw new Error('precache did not complete');
  });
}

async function status(page: Page) {
  return page.evaluate(() => new Promise<Record<string, unknown>>((resolve) => {
    const onMessage = (event: MessageEvent) => {
      if (event.data?.type !== 'release-status') return;
      navigator.serviceWorker.removeEventListener('message', onMessage);
      resolve(event.data);
    };
    navigator.serviceWorker.addEventListener('message', onMessage);
    navigator.serviceWorker.controller!.postMessage('release-status');
  }));
}

test('an operator can identify the release being served', async ({ page }) => {
  await provisioned(page);
  const state = await status(page);

  expect(typeof state['serving']).toBe('string');
  expect(state['serving']).toBe(state['worker']);
  expect((state['provisioning'] as { missing: unknown[] }).missing).toEqual([]);
});

test('the recovery panel reports the release and offers no rollback when there is nothing to go back to', async ({ page }) => {
  await provisioned(page);
  await page.goto('./?recovery=1');
  await expect(page.locator('dialog.recovery')).toBeVisible();

  await expect(page.locator('.recovery__facts')).toContainText('Serving');
  await expect(page.locator('.recovery__facts')).toContainText('complete');
  // A first provision has no earlier release, and the control says so rather
  // than failing when pressed.
  await expect(page.getByRole('button', { name: 'No previous release to restore' })).toBeDisabled();
});

test('an install that cannot verify its assets never activates', async ({ browser, baseURL }) => {
  // A fresh context, with the tampering in place before anything registers a
  // worker. Routing after the fact silently tests nothing: the worker is
  // already running and never sees the route.
  const context = await browser.newContext({ serviceWorkers: 'allow' });
  await context.route('**/assets/*.css', (route) => route.fulfill({
    status: 200, contentType: 'text/css', body: '/* tampered in transit */',
  }));

  const page = await context.newPage();
  await page.goto(baseURL!);
  await expect(page.locator('.tile').first()).toBeVisible();

  const outcome = await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.register('sw.js', { scope: './' });
    const worker = registration.installing ?? registration.waiting ?? registration.active;
    if (!worker) return { state: 'none', missing: [] as unknown[] };

    const state = await new Promise<string>((resolve) => {
      const settle = () => { if (worker.state === 'redundant' || worker.state === 'activated') resolve(worker.state); };
      worker.addEventListener('statechange', settle);
      setTimeout(() => resolve(worker.state), 30_000);
      settle();
    });

    // What the worker recorded about why, which is what an operator would read.
    const cache = await caches.open('cihof-exhibit:state');
    const stored = await cache.match('https://cihof.invalid/release-state');
    const parsed = stored ? await stored.json() : {};
    return { state, missing: parsed?.provisioning?.missing ?? [] };
  });

  expect(outcome.state, 'a worker that cannot verify its assets must not activate').toBe('redundant');
  expect(outcome.missing.length, 'and it records what was wrong').toBeGreaterThan(0);
  expect(JSON.stringify(outcome.missing)).toContain('checksum mismatch');

  await context.close();
});

test('rollback is a stored decision, not a reinstall', async ({ page }) => {
  await provisioned(page);

  // Stage a previous release by hand: a cache to go back to, and state naming
  // it. This is the situation after one successful update.
  const restored = await page.evaluate(async () => {
    const current = (await caches.keys()).find((n) => n.startsWith('cihof-exhibit:') && !n.endsWith(':state'))!;
    const revision = current.slice('cihof-exhibit:'.length);

    const older = 'cihof-exhibit:older000000000000';
    const source = await caches.open(current);
    const destination = await caches.open(older);
    for (const request of await source.keys()) {
      const response = await source.match(request);
      if (response) await destination.put(request, response);
    }

    const state = await caches.open('cihof-exhibit:state');
    await state.put('https://cihof.invalid/release-state', new Response(JSON.stringify({
      serving: revision, previous: 'older000000000000', rolledBackFrom: null,
    }), { headers: { 'content-type': 'application/json' } }));

    return new Promise<Record<string, unknown>>((resolve) => {
      const onMessage = (event: MessageEvent) => {
        if (event.data?.type !== 'release-status') return;
        navigator.serviceWorker.removeEventListener('message', onMessage);
        resolve(event.data);
      };
      navigator.serviceWorker.addEventListener('message', onMessage);
      navigator.serviceWorker.controller!.postMessage('restore-previous');
    });
  });

  expect(restored['serving'], 'the previous release is now served').toBe('older000000000000');
  expect(restored['rolledBackFrom'], 'and the outcome is recorded').toBeTruthy();

  // The display still works, served from the restored release.
  await page.reload();
  await expect(page.locator('.tile')).toHaveCount(111);
});

test('a restored release is reported so the outcome can be written down', async ({ page }) => {
  await provisioned(page);
  await page.evaluate(async () => {
    const current = (await caches.keys()).find((n) => n.startsWith('cihof-exhibit:') && !n.endsWith(':state'))!;
    const state = await caches.open('cihof-exhibit:state');
    await state.put('https://cihof.invalid/release-state', new Response(JSON.stringify({
      serving: current.slice('cihof-exhibit:'.length), previous: null, rolledBackFrom: 'abcdef0123456789',
    }), { headers: { 'content-type': 'application/json' } }));
  });

  await page.goto('./?recovery=1');
  await expect(page.locator('.recovery__outcome')).toContainText('Restored to');
  await expect(page.locator('.recovery__outcome')).toContainText('abcdef0123456789');
  await expect(page.locator('.recovery__outcome')).toContainText('Record this');
});
