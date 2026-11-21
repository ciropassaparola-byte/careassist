// Service Worker per CareAssist Pro: 100% Funzionamento Offline Domiciliare + Notifiche a Schermo Spento
const CACHE_NAME = 'careassist-pro-v346-bottom-right-trash';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './turni.html',
  './style.css',
  './style.css?v=346',
  './app.js?v=346',
  './app.js',
  './suite_bridge.js',
  './turnario_admin.js',
  './turnario_admin.js?v=346',
  './TURNARIO_SETTIMANALE_A4.html',
  './qrcode_data_uri.js',
  './suite_nav.js',
  './suite_security_gate.js',
  './auth_token.js',
  './careassist_icon.jpg',
  './manifest.json',
  './DIARIO_GLICEMICO_ROSA.html',
  './GRIGLIA_SETTIMANALE_ROSA.html'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE).catch((err) => {
        console.warn('Avviso pre-caching asset:', err);
      });
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

// Gestione Notifiche Sistema Operativo anche a Display Spento / Bloccato
self.addEventListener('message', (event) => {
  if (!event.data) return;
  if (event.data.type === 'SHOW_LOCKSCREEN_ALERT') {
    const title = event.data.title || '🔔 CareAssist Pro — Avviso Terapia';
    const options = {
      body: event.data.body || 'È l\'ora della somministrazione programmata.',
      icon: './careassist_icon.jpg',
      badge: './careassist_icon.jpg',
      vibrate: [500, 180, 500, 180, 700, 200, 700],
      requireInteraction: true,
      renotify: true,
      tag: 'careassist-lockscreen-' + (event.data.tag || Date.now()),
      data: { url: './index.html' }
    };
    event.waitUntil(self.registration.showNotification(title, options));
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow('./index.html');
    })
  );
});

// Strategia: Network First (no-cache) con fallback immediato su Cache offline
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  if (event.request.url.includes('/api/')) return;

  event.respondWith(
    fetch(event.request, { cache: 'no-cache' })
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        return caches.match(event.request, { ignoreSearch: true });
      })
  );
});
