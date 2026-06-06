self.addEventListener('install', (event) => {
  self.skipWaiting()
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    self.clients.claim().then(() => self.registration.unregister())
  )
})

self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request))
})
