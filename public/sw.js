const CACHE_VERSION = 'cihof-runtime-v1';
const DOCUMENT_CACHE = `${CACHE_VERSION}:documents`;
const DATA_CACHE = `${CACHE_VERSION}:data`;
const ASSET_CACHE = `${CACHE_VERSION}:assets`;

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith('cihof-runtime-') && !key.startsWith(CACHE_VERSION)).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin || !['http:', 'https:'].includes(url.protocol)) return;

  if (request.mode === 'navigate' || request.destination === 'document') {
    event.respondWith(networkFirst(request, DOCUMENT_CACHE));
    return;
  }

  if (url.pathname.includes('/data/')) {
    event.respondWith(networkFirst(request, DATA_CACHE));
    return;
  }

  if (isStaticAssetRequest(request, url)) {
    event.respondWith(cacheFirst(request, ASSET_CACHE));
    return;
  }

  event.respondWith(staleWhileRevalidate(request, ASSET_CACHE));
});

function isStaticAssetRequest(request, url) {
  if (['font', 'image', 'script', 'style', 'video', 'audio', 'track'].includes(request.destination)) return true;
  return /\.(?:avif|css|gif|html|jpe?g|js|json|m4a|mp3|mp4|png|svg|vtt|webm|woff2?)$/i.test(url.pathname);
}

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response.ok) await cache.put(request, response.clone());
    return response;
  } catch (error) {
    const cached = await cache.match(request);
    if (cached) return cached;
    throw error;
  }
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (response.ok) await cache.put(request, response.clone());
  return response;
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const refresh = fetch(request)
    .then((response) => {
      if (response.ok) void cache.put(request, response.clone());
      return response;
    })
    .catch(() => null);

  return cached ?? refresh.then((response) => {
    if (response) return response;
    return new Response('', { status: 504, statusText: 'Offline' });
  });
}
