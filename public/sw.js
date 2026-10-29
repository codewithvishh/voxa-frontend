// Voxa Service Worker for PWA & Mobile Background Audio
const CACHE_NAME = 'voxa-cache-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // CRITICAL: Let media, audio streams, and range requests pass directly to the browser's native audio engine
  if (
    event.request.headers.get('range') ||
    event.request.destination === 'audio' ||
    url.pathname.endsWith('.mp3') ||
    url.pathname.endsWith('.m4a') ||
    url.hostname.includes('jiosaavn') ||
    url.hostname.includes('soundhelix') ||
    url.pathname.includes('/api/songs')
  ) {
    return;
  }

  // Network-first strategy for app shell
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
