/* Cache-first: after the first visit every file comes from this cache, so a
 * returning student costs GitHub Pages no requests and no bandwidth (Pages
 * itself only allows a 10-minute HTTP cache).
 *
 * The catch: nobody sees a deploy until VERSION changes. Bump it in any commit
 * that changes a served file; the new worker then drops the old cache.
 */
const VERSION = "2026-10-09.2";

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener("fetch", (e) => {
  // Same origin only: Google Fonts sets its own year-long cache headers.
  if (e.request.method !== "GET" || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(caches.open(VERSION).then(async (cache) => {
    const hit = await cache.match(e.request);
    if (hit) return hit;
    const res = await fetch(e.request);
    if (res.ok) cache.put(e.request, res.clone());
    return res;
  }));
});
