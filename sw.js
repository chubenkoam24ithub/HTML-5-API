const CACHE_NAME = 'html5-api-demo-v4';
const FILES_TO_CACHE = [
  '/',
  '/index.html',
  '/404.html',
  '/css/styles.css',
  '/script/app.js',
  '/script/worker.js'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(FILES_TO_CACHE).catch(err => {
        console.error('Cache addAll failed:', err);
      });
    })
  );
});

self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((response) => {
      return response || fetch(e.request);
    })
  );
});