const CACHE_NAME = 'matutonet-cache-v3'; // Mudamos para v3 para limpar os bugs da v1 e v2
const urlsToCache = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json',
  './logo.png'
];

// Instalação: Salva a estrutura básica
self.addEventListener('install', event => {
  self.skipWaiting(); // Força a atualização imediata
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache))
  );
});

// Ativação: Limpa caches antigos
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cache => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    })
  );
});

// Interceptador de Rede
self.addEventListener('fetch', event => {
  // Ignora requisições do Firebase (para não bugar o banco de dados)
  if (event.request.url.includes('firestore') || event.request.url.includes('firebaseio')) {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Se já estiver no cache, retorna
        if (response) {
          return response;
        }
        // Se não, busca na internet
        return fetch(event.request).then(
          networkResponse => {
            // Salva na memória para a próxima vez (offline)
            if(!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
              return networkResponse;
            }
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, responseToCache);
            });
            return networkResponse;
          }
        );
      })
  );
});
