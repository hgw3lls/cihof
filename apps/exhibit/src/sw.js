/**
 * Offline worker for the installed display.
 *
 * Written against four requirements the previous worker inverted:
 *
 *   A new release must not take over a session in progress. This worker never
 *   calls skipWaiting on its own; it waits until the page asks, which the page
 *   only does at a reset or a restart.
 *
 *   The release that is working must survive until the new one is ready. Older
 *   caches are deleted on activation, which is only reached once the new cache
 *   is fully populated — never on install.
 *
 *   A provisioned display must open a person it has never visited. Everything
 *   in the release manifest is precached on install rather than cached as
 *   somebody happens to fetch it.
 *
 *   A failed cache write must never cost the page a response that already
 *   arrived. Every write is isolated from the response it was copying.
 *
 * Every cache read passes `ignoreVary`. Static hosts commonly send
 * `Vary: Origin`, and the Cache API honours Vary by default, so a response the
 * worker precached never matches the request the page later makes. The bytes do
 * not vary by origin; the header only says they might.
 */
const RELEASE = '__CIHOF_RELEASE__';
const CACHE = `cihof-exhibit:${RELEASE}`;
const CACHE_PREFIX = 'cihof-exhibit:';

self.addEventListener('install', (event) => {
  event.waitUntil(precache());
  // Deliberately no skipWaiting. The page decides when a new release takes over.
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    // Only now that this release is installed and activating is it safe to drop
    // the ones before it.
    const keys = await caches.keys();
    await Promise.all(
      keys.filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE).map((key) => caches.delete(key)),
    );
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  // The page asks for the handover at a moment it knows is safe.
  if (event.data === 'activate-release') self.skipWaiting();
  if (event.data === 'release-status') {
    event.source?.postMessage({ type: 'release', revision: RELEASE });
  }
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // A navigation to any route in scope is served the shell, so a deep link
  // opens offline rather than 404ing against a static host.
  if (request.mode === 'navigate') {
    event.respondWith(serveDocument(request));
    return;
  }

  event.respondWith(serveAsset(request));
});

async function precache() {
  const manifestUrl = new URL('release.json', self.location.href);
  const response = await fetch(manifestUrl, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Release manifest unavailable (${response.status}).`);

  const manifest = await response.json();
  const cache = await caches.open(CACHE);

  // Sequential rather than parallel: a display provisions once, and a hundred
  // simultaneous requests is a good way to be rate-limited or run out of memory
  // on modest hardware.
  for (const asset of manifest.assets) {
    const assetResponse = await fetch(asset.path, { cache: 'no-store' });
    if (!assetResponse.ok) throw new Error(`Release asset missing: ${asset.path}`);
    await cache.put(asset.path, assetResponse);
  }
}

async function serveDocument(request) {
  const cache = await caches.open(CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) void store(cache, request, response.clone());
    return response;
  } catch {
    const shell = new URL('index.html', self.location.href).href;
    return (await cache.match(request, { ignoreVary: true }))
      ?? (await cache.match(shell, { ignoreVary: true }))
      ?? Response.error();
  }
}

async function serveAsset(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request, { ignoreVary: true });
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) void store(cache, request, response.clone());
    return response;
  } catch (cause) {
    // Offline and not precached. Fail as a response rather than as a rejected
    // promise, so the page sees a network error it can handle.
    return Response.error();
  }
}

/**
 * Stores a copy without ever putting the original response at risk.
 *
 * Awaiting a cache write inside the same try as the fetch means a quota failure
 * discards a response the page had already received. This is fire-and-forget on
 * purpose.
 */
async function store(cache, request, response) {
  try {
    await cache.put(request, response);
  } catch {
    // Out of quota, or storage refused. The page already has its response.
  }
}
