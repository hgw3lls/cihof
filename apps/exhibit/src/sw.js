/**
 * Offline worker for the installed display.
 *
 * Four requirements the previous worker inverted, and two it never attempted:
 *
 *   A new release must not take over a session in progress. This worker never
 *   calls skipWaiting on its own; the page asks, and only at a reset.
 *
 *   The release that works must survive. Two releases are kept — the one being
 *   served and the one before it — so there is something to go back to. The
 *   previous worker deleted every other cache on activation, which left nothing.
 *
 *   A provisioned display must open a person nobody has visited, so everything
 *   in the release manifest is precached rather than caught as it is fetched.
 *
 *   A failed cache write must never cost the page a response that already
 *   arrived, so every write is isolated from the response it was copying.
 *
 *   Precached bytes are verified against the manifest's checksums. "Offline
 *   ready" has to mean the assets are present *and* correct; a truncated file
 *   cached during a flaky provision is worse than a missing one, because
 *   nothing later notices.
 *
 *   Staff can see which release is serving, what it is missing, and go back to
 *   the previous one. Which release is served is a stored decision rather than
 *   whichever worker happens to be newest, so rollback does not require
 *   reinstalling anything.
 */
const RELEASE = '__CIHOF_RELEASE__';
const PREFIX = 'cihof-exhibit:';
const CACHE = `${PREFIX}${RELEASE}`;
const STATE = `${PREFIX}state`;
const STATE_KEY = 'https://cihof.invalid/release-state';

self.addEventListener('install', (event) => {
  event.waitUntil(precache());
  // Deliberately no skipWaiting. The page decides when a release takes over.
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const state = await readState();
    const previous = state.serving && state.serving !== RELEASE ? state.serving : state.previous ?? null;
    // Merge rather than replace: install wrote the provisioning record, and an
    // operator needs it after activation, not just during.
    await writeState({ ...state, serving: RELEASE, previous, rolledBackFrom: null });

    // Keep this release and the one before it. Anything older cannot be
    // returned to and is only taking up room on a modest device.
    const keep = new Set([CACHE, STATE, previous ? `${PREFIX}${previous}` : '']);
    for (const key of await caches.keys()) {
      if (key.startsWith(PREFIX) && !keep.has(key)) await caches.delete(key);
    }
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  const message = event.data;
  if (message === 'activate-release') { self.skipWaiting(); return; }

  if (message === 'release-status') {
    event.waitUntil(reportStatus(event.source));
    return;
  }

  if (message === 'restore-previous') {
    event.waitUntil((async () => {
      const state = await readState();
      if (!state.previous) { await reportStatus(event.source); return; }
      // Serving is a stored decision, so going back is a write, not a reinstall.
      await writeState({ serving: state.previous, previous: null, rolledBackFrom: state.serving });
      await reportStatus(event.source);
    })());
  }
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  // Films stream straight from the display's server: the release manifest
  // leaves them out, and a cached response cannot answer a range request.
  if (/\.(mp4|webm|mov|m4v|mkv|ogv|avi)$/i.test(url.pathname)) return;

  if (request.mode === 'navigate') { event.respondWith(serveDocument(request)); return; }
  event.respondWith(serveAsset(request));
});

/** The cache a request should be answered from, which may not be this worker's. */
async function servingCache() {
  const state = await readState();
  const name = state.serving ? `${PREFIX}${state.serving}` : CACHE;
  return (await caches.has(name)) ? caches.open(name) : caches.open(CACHE);
}

async function precache() {
  const manifest = await (await fetch(new URL('release.json', self.location.href), { cache: 'no-store' })).json();
  const cache = await caches.open(CACHE);
  const missing = [];

  // Sequential on purpose: a display provisions once, and a hundred parallel
  // requests is a good way to be throttled or to exhaust memory on modest
  // hardware.
  for (const asset of manifest.assets) {
    try {
      const response = await fetch(asset.path, { cache: 'no-store' });
      if (!response.ok) { missing.push({ path: asset.path, reason: `http ${response.status}` }); continue; }

      const bytes = await response.clone().arrayBuffer();
      if (asset.sha256 && (await sha256(bytes)) !== asset.sha256) {
        missing.push({ path: asset.path, reason: 'checksum mismatch' });
        continue;
      }
      await cache.put(asset.path, response);
    } catch (cause) {
      missing.push({ path: asset.path, reason: String(cause && cause.message ? cause.message : cause) });
    }
  }

  await writeState({ ...(await readState()), provisioning: { release: RELEASE, expected: manifest.assets.length, missing } });

  // An incomplete provision must not become the serving release. Failing the
  // install leaves the previous worker in charge, which is the whole point.
  if (missing.length > 0) throw new Error(`Provisioning incomplete: ${missing.length} of ${manifest.assets.length} assets unusable.`);
}

async function serveDocument(request) {
  const cache = await servingCache();
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
  const cache = await servingCache();
  const cached = await cache.match(request, { ignoreVary: true });
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) void store(cache, request, response.clone());
    return response;
  } catch {
    return Response.error();
  }
}

/** Copies a response without ever putting the original at risk. */
async function store(cache, request, response) {
  try {
    await cache.put(request, response);
  } catch {
    // Quota, or storage refused. The page already has what it asked for.
  }
}

async function reportStatus(client) {
  const state = await readState();
  const present = [];
  for (const key of await caches.keys()) {
    if (key.startsWith(PREFIX) && key !== STATE) present.push(key.slice(PREFIX.length));
  }
  client?.postMessage({
    type: 'release-status',
    worker: RELEASE,
    serving: state.serving ?? RELEASE,
    previous: state.previous ?? null,
    rolledBackFrom: state.rolledBackFrom ?? null,
    provisioning: state.provisioning ?? null,
    releasesHeld: present.sort(),
  });
}

async function readState() {
  try {
    const cache = await caches.open(STATE);
    const response = await cache.match(STATE_KEY);
    return response ? await response.json() : {};
  } catch {
    return {};
  }
}

async function writeState(state) {
  try {
    const cache = await caches.open(STATE);
    await cache.put(STATE_KEY, new Response(JSON.stringify(state), { headers: { 'content-type': 'application/json' } }));
  } catch {
    // Storage refused. The worker still serves; it just cannot remember.
  }
}

async function sha256(bytes) {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}
