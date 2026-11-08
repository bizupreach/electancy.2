// Electancy's service worker (docs/PLATFORM_PLAN.md, step 7). It makes the site installable and opens the last
// page shell when offline. It never stores election data: requests under data/ always go to the network, so an
// installed app is no easier to copy from than the website.
const CACHE = 'electancy-shell-v1';
const BASE = new URL('./', self.location).pathname;           // '/' or '/electancy.2/'

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll([BASE])).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  const path = url.pathname.slice(BASE.length);
  if (path.startsWith('data/')) return;                         // election data: network only, never stored

  // pages: the network first, so a new release shows at once; the stored shell when offline
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then((res) => {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(BASE, copy));
      return res;
    }).catch(() => caches.match(BASE)));
    return;
  }

  // code, styles, fonts and icons have fixed names per release: stored on first use
  if (/^(assets|fonts|icons)\//.test(path)) {
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
      return res;
    })));
  }
});
