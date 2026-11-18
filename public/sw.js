/**
 * Valley Security System (VSA) - Service Worker
 * Phase 11: Offline PWA Capabilities, Asset Resilience & Cache Sentinel
 */

const CACHE_NAME = 'vsa-cache-v1';

// Critical core application shell assets to pre-cache on install
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/login.html',
  '/register.html',
  '/verification.html',
  '/upload-photo.html',
  '/offline.html',
  '/styles.css',
  '/firm-config.js',
  '/favicon.png',
  '/manifest.json'
];

// Secondary static assets to lazily cache on first request
const STATIC_EXTENSIONS = [
  '.css', '.js', '.png', '.jpg', '.jpeg', '.svg', '.webp', '.ico',
  '.woff', '.woff2', '.ttf', '.eot'
];

// Read-only API endpoints eligible for stale-while-revalidate / cache fallback
const CACHEABLE_API_PREFIXES = [
  '/api/firm-config',
  '/api/clients',
  '/api/departments',
  '/api/classifications',
  '/api/settings'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      // Use individual caching to prevent one 401/404 from failing the entire service worker installation
      const cachePromises = PRECACHE_ASSETS.map(async (url) => {
        try {
          const response = await fetch(url, { cache: 'no-cache' });
          if (response && response.status === 200) {
            await cache.put(url, response);
          }
        } catch (err) {
          // Non-blocking: will be cached on first successful access
        }
      });
      await Promise.all(cachePromises);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME) {
            return caches.delete(name);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // 1. Only intercept same-origin requests
  if (url.origin !== self.location.origin) {
    return;
  }

  // 2. Pass non-GET requests to network directly
  if (request.method !== 'GET') {
    event.respondWith(
      fetch(request).catch(() => {
        return new Response(
          JSON.stringify({
            offline: true,
            error: 'Network unavailable. Changes cannot be synchronized offline.'
          }),
          {
            status: 503,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      })
    );
    return;
  }

  // 3. Navigation requests (HTML documents) -> Network-First with Cache Fallback, then /offline.html
  const isNavigation = request.mode === 'navigate' || 
    (request.headers.get('accept') && request.headers.get('accept').includes('text/html'));

  if (isNavigation) {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return networkResponse;
        })
        .catch(async () => {
          const cachedResponse = await caches.match(request);
          if (cachedResponse) {
            return cachedResponse;
          }
          // Fallback to offline page
          const offlinePage = await caches.match('/offline.html');
          return offlinePage || new Response('Offline - Valley Security System', {
            status: 503,
            headers: { 'Content-Type': 'text/plain' }
          });
        })
    );
    return;
  }

  // 4. Cacheable API endpoints -> Network-First with Stale Fallback
  const isCacheableApi = CACHEABLE_API_PREFIXES.some(prefix => url.pathname.startsWith(prefix));
  if (isCacheableApi) {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return networkResponse;
        })
        .catch(async () => {
          const cachedResponse = await caches.match(request);
          if (cachedResponse) return cachedResponse;
          return new Response(
            JSON.stringify({ error: 'Network offline and no cached data available.' }),
            { status: 503, headers: { 'Content-Type': 'application/json' } }
          );
        })
    );
    return;
  }

  // 5. Static Assets (CSS, JS, Fonts, Images) -> Cache-First with Network Fallback
  const isStaticAsset = STATIC_EXTENSIONS.some(ext => url.pathname.endsWith(ext)) ||
    url.pathname.startsWith('/fonts/') ||
    url.pathname.startsWith('/lib/') ||
    url.pathname.startsWith('/img/');

  if (isStaticAsset) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          // Revalidate in background for CSS and JS
          if (url.pathname.endsWith('.css') || url.pathname.endsWith('.js')) {
            fetch(request).then((networkResponse) => {
              if (networkResponse && networkResponse.status === 200) {
                caches.open(CACHE_NAME).then((cache) => cache.put(request, networkResponse));
              }
            }).catch(() => {});
          }
          return cachedResponse;
        }

        return fetch(request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return networkResponse;
        });
      })
    );
    return;
  }

  // 6. Default fetch strategy: Network with Cache Fallback
  event.respondWith(
    fetch(request).catch(() => caches.match(request))
  );
});
