// =============================================
//  TWO DREAMERS — SERVICE WORKER
//  Incrementar CACHE_NAME a cada deploy
// =============================================

const CACHE_NAME = 'td-precificacao-v1';

const ASSETS = [
  './',
  './index.html',
  './app.js',
  './manifest.json',
];

// INSTALL — pré-cacheia os assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

// ACTIVATE — limpa caches antigos
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// FETCH — cache-first, fallback para rede
self.addEventListener('fetch', event => {
  // Só intercepta GET
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        // Cacheia respostas válidas de origem própria
        if (
          response.ok &&
          response.type === 'basic'
        ) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache =>
            cache.put(event.request, clone)
          );
        }
        return response;
      });
    }).catch(() => {
      // Fallback offline: retorna index.html para navegação
      if (event.request.mode === 'navigate') {
        return caches.match('./index.html');
      }
    })
  );
});
