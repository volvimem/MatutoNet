const CACHE_NAME = 'matutonet-cache-v7'; // Versão 7 para forçar a limpeza imediata do celular
const urlsToCache = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json',
  './logo.png'
];

// Instalação
self.addEventListener('install', event => {
  self.skipWaiting(); // Força o novo código a assumir o controle na mesma hora
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache)));
});

// Ativação e Limpeza do Lixo Antigo
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => Promise.all(
      cacheNames.map(cache => { if (cache !== CACHE_NAME) return caches.delete(cache); })
    )).then(() => self.clients.claim()) // Exige o controle de todas as abas abertas
  );
});

// INTERCEPTADOR DE REDE (A MÁGICA DO TEMPO REAL AQUI)
self.addEventListener('fetch', event => {
  // Ignora o Firebase para não bugar o banco de dados
  if (event.request.url.includes('firestore') || event.request.url.includes('firebaseio')) return;

  event.respondWith(
    // 1º TENTA PEGAR DA INTERNET (Para garantir que está sempre atualizado)
    fetch(event.request).then(networkResponse => {
      if(!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
        return networkResponse;
      }
      // Se a internet funcionou e pegou o arquivo novo, salva uma cópia nova na memória
      const responseToCache = networkResponse.clone();
      caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseToCache));
      return networkResponse;
    }).catch(() => {
      // 2º SE ESTIVER SEM INTERNET, PEGA DA MEMÓRIA
      return caches.match(event.request);
    })
  );
});
