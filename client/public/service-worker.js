const CACHE_NAME = 'eatout-driver-v1';
const urlsToCache = [
  '/',
  '/driver/dashboard',
  '/driver/settings',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
      .catch((error) => {
        console.log('Cache addAll error:', error);
      })
  );
  self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  // Only handle GET requests for caching
  if (event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        if (response) {
          return response;
        }
        return fetch(event.request).then(
          (response) => {
            // Only cache successful GET responses that are basic (same-origin)
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }
            
            // Only cache navigation requests and assets, not API calls
            const url = new URL(event.request.url);
            const isApiRequest = url.pathname.startsWith('/api/');
            
            if (!isApiRequest) {
              const responseToCache = response.clone();
              caches.open(CACHE_NAME)
                .then((cache) => {
                  cache.put(event.request, responseToCache);
                });
            }
            
            return response;
          }
        );
      })
      .catch(() => {
        // Only provide fallback for navigation requests, let API calls fail naturally
        if (event.request.mode === 'navigate') {
          return caches.match('/driver/dashboard');
        }
        // Let the error propagate for API requests so the app can handle it
        throw new Error('Network request failed and no cache available');
      })
  );
});

self.addEventListener('activate', (event) => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});
