// CÓDIGO DE AUTO-LIMPEZA DO CACHE FANTASMA
self.addEventListener('install', (e) => {
    self.skipWaiting();
});

self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cache) => {
                    console.log('Limpando cache velho:', cache);
                    return caches.delete(cache);
                })
            );
        }).then(() => {
            return self.registration.unregister();
        })
    );
});
