const CACHE_NAME = 'progress-app-cache-v2';
const URLS_TO_CACHE = [
  '../index.html',
  '../styles.css',
  '../src/index.js',
  '../manifest.json'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(URLS_TO_CACHE))
  );
});

self.addEventListener('fetch', event => {
  const requestUrl = new URL(event.request.url);

  // Bypass the cache for Firestore API requests
  if (requestUrl.hostname === 'firestore.googleapis.com') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    )
    return;
  }

  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request).then(networkResponse => {
        return caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, networkResponse.clone());
          return networkResponse;
        })
      })
    })
  )
});

self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (!cacheWhitelist.includes(cacheName)) {
            return caches.delete(cacheName);
          }
        })
      )
    })
  )
})
