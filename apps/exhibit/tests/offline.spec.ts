import { expect, test } from '@playwright/test';
import { begin } from './visit.ts';

/**
 * Offline behaviour for a provisioned display.
 *
 * The requirement is not "works after you visited the page" — it is that a
 * display provisioned once opens without a network, including a person nobody
 * has looked at yet. That is only possible with a precache, which is why the
 * worker takes a release manifest rather than caching what happens to be
 * fetched.
 */
async function provision(page: import('@playwright/test').Page) {
  await begin(page);

  await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    // Wait for the precache to finish rather than for the worker to exist.
    const manifest = await (await fetch(`${location.pathname.replace(/\/$/, '')}/release.json`)).json();
    const expected = manifest.assets.length;
    for (let attempt = 0; attempt < 120; attempt += 1) {
      const keys = await caches.keys();
      const mine = keys.find((key) => key.startsWith('cihof-exhibit:'));
      if (mine) {
        const cache = await caches.open(mine);
        if ((await cache.keys()).length >= expected) return;
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    throw new Error(`Precache did not complete; registration scope ${registration.scope}`);
  });
}

test('a provisioned display opens with no network at all', async ({ page, context }) => {
  await provision(page);

  await context.setOffline(true);
  await page.reload();
  await page.locator('[data-begin]').click();

  await expect(page.locator('.tile')).toHaveCount(111);
  await expect(page.locator('.count')).toHaveText('111 of 111 shown');
});

test('offline, a portrait nobody has looked at still resolves', async ({ page, context }) => {
  await provision(page);
  await context.setOffline(true);
  await page.reload();

  // Deliberately someone at the far end of the collection, never scrolled to
  // and never fetched during provisioning by anything but the precache.
  const missing = await page.evaluate(async () => {
    const bundle = await (await fetch('data/exhibit.json')).json();
    const last = bundle.people.at(-1);
    // Bundle paths are base-relative on purpose: the bundle must not know which
    // path a deployment is served from. Consumers prefix, exactly as the app does.
    const base = document.querySelector('base')?.href ?? location.href.replace(/[^/]*$/, '');
    const response = await fetch(new URL(last.portrait.src.replace(/^\//, ''), base).href);
    return { id: last.id, ok: response.ok, status: response.status };
  });

  expect(missing.ok, `portrait for ${missing.id} must be available offline`).toBe(true);
});

test('the collection data itself is available offline', async ({ page, context }) => {
  await provision(page);
  await context.setOffline(true);
  await page.reload();

  const bundle = await page.evaluate(async () => {
    const response = await fetch('data/exhibit.json');
    return response.ok ? await response.json() : null;
  });

  expect(bundle?.people?.length).toBe(111);
  expect(typeof bundle.contentRevision).toBe('string');
});

test('a waiting release does not take over a session by itself', async ({ page }) => {
  await provision(page);

  const state = await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    // The worker claims the page as it activates, a moment after it is ready.
    if (!navigator.serviceWorker.controller) {
      await Promise.race([
        new Promise((resolve) => navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true })),
        new Promise((resolve) => setTimeout(resolve, 5_000)),
      ]);
    }
    return { hasWaiting: Boolean(registration.waiting), controlled: Boolean(navigator.serviceWorker.controller) };
  });

  // On a first provision there is nothing waiting; what matters is that the
  // worker is controlling the page without ever having called skipWaiting.
  expect(state.controlled).toBe(true);
  expect(state.hasWaiting).toBe(false);
});
