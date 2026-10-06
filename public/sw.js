const CACHE_NAME = 'cocoapp-shell-v1'
const SHELL_URLS = ['/', '/index.html', '/manifest.webmanifest', '/favicon.svg']
const STATIC_DESTINATIONS = new Set(['script', 'style', 'font', 'image'])

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_URLS))
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => Promise.all(
      cacheNames
        .filter((cacheName) => cacheName.startsWith('cocoapp-shell-') && cacheName !== CACHE_NAME)
        .map((cacheName) => caches.delete(cacheName))
    ))
  )
  self.clients.claim()
})

function isCacheableStaticRequest(request, url) {
  if (request.method !== 'GET' || url.origin !== self.location.origin) return false
  if (request.headers.has('authorization')) return false

  return SHELL_URLS.includes(url.pathname)
    || url.pathname.startsWith('/assets/')
    || STATIC_DESTINATIONS.has(request.destination)
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  if (request.method !== 'GET' || url.origin !== self.location.origin) return

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone()
            event.waitUntil(
              caches.open(CACHE_NAME).then((cache) => cache.put('/index.html', copy))
            )
          }
          return response
        })
        .catch(async () => (
          await caches.match('/index.html')
          || await caches.match('/')
          || Response.error()
        ))
    )
    return
  }

  if (!isCacheableStaticRequest(request, url)) return

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(request)
      const networkResponse = fetch(request).then(async (response) => {
        if (response.ok && response.type === 'basic') {
          await cache.put(request, response.clone())
        }
        return response
      })

      if (!cached) return networkResponse

      event.waitUntil(networkResponse.catch(() => undefined))
      return cached
    })
  )
})
