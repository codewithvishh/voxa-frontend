// Voxa Service Worker for PWA & Uninterrupted Mobile Background Audio
const CACHE_NAME = 'voxa-cache-v2';

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

  // CRITICAL: Audio streams, byte-range requests (HTTP 206), media CDNs, and media decoders
  // MUST NEVER be intercepted by the Service Worker cache. They must stream directly
  // through the browser's native OS audio engine for continuous background/lock-screen playback.
  const isMediaStream =
    Boolean(event.request.headers.get('range')) ||
    event.request.destination === 'audio' ||
    event.request.destination === 'video' ||
    /\.(mp3|mp4|m4a|aac|ogg|wav|flac|webm)($|\?)/i.test(url.pathname) ||
    url.hostname.includes('saavncdn.com') ||
    url.hostname.includes('saavn.com') ||
    url.hostname.includes('jiosaavn') ||
    url.hostname.includes('jio.com') ||
    url.hostname.includes('soundhelix') ||
    url.hostname.includes('jamendo') ||
    url.pathname.includes('/api/songs') ||
    url.pathname.includes('/stream');

  if (isMediaStream) {
    return; // Pass-through directly to OS hardware media pipeline
  }

  // Network-first strategy for app shell
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
