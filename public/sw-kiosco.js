const CACHE = "kiosco-respaldo-v1"
const RESPALDO = "/kiosco/respaldo.html"

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll([RESPALDO])))
  self.skipWaiting()
})

self.addEventListener("activate", (e) => {
  e.waitUntil(self.clients.claim())
})

self.addEventListener("fetch", (e) => {
  if (e.request.mode === "navigate") {
    e.respondWith(fetch(e.request).catch(() => caches.match(RESPALDO)))
  }
})
