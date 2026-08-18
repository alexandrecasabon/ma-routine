/* Service worker : rend l'app utilisable hors ligne.
   Change VERSION à chaque mise à jour pour forcer le rafraîchissement. */
const VERSION = 'routine-v1';
const FICHIERS = [
  './', './index.html', './styles.css', './app.js',
  './manifest.webmanifest', './icon-192.png', './icon-512.png', './icon-180.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(FICHIERS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(cles => Promise.all(cles.filter(c => c !== VERSION).map(c => caches.delete(c))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then(rep => rep || fetch(e.request).then(r => {
      const copie = r.clone();
      caches.open(VERSION).then(c => c.put(e.request, copie));
      return r;
    }).catch(() => caches.match('./index.html')))
  );
});
