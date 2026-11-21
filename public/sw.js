// Service Worker - Suite Gestionale C. Milella (PWA & Offline Support - Network First Sempre Aggiornato)
const CACHE_NAME = 'milella-suite-v216';
const CORE_ASSETS = [
  '/',
  '/launcher.html',
  '/manifest.json',
  '/cm_logo_gold.ico',
  '/icon-512.png'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(CORE_ASSETS).catch((err) => console.warn('Cache warning:', err));
    })
  );
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
  if (event.request.method !== 'GET') return;
  const url = event.request.url;
  // Non cachare chiamate API dinamiche o MongoDB
  if (url.includes('/api/')) return;

  // Network-First: scarica sempre l'ultima versione live da Render, usa la cache solo se offline!
  event.respondWith(
    fetch(event.request, { cache: 'no-cache' })
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const toCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, toCache));
        }
        return networkResponse;
      })
      .catch(() => caches.match(event.request, { ignoreSearch: true }))
  );
});
