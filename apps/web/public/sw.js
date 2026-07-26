const CACHE = 'darwin-wasm-dev'
const CORE = /* __PRECACHE__ */ [
  '/',
  '/manifest.webmanifest',
  '/wasm-vips/vips-es6.js',
  '/wasm-vips/vips.wasm',
  '/wasm-vips/vips-heif.wasm',
  '/wasm-vips/vips-jxl.wasm',
]

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(CORE)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return
  event.respondWith(
    caches.match(event.request).then(async cached => cached
      || (event.request.mode === 'navigate' && await caches.match('/index.html'))
      || fetch(event.request).then(response => {
      if (response.ok) caches.open(CACHE).then(cache => cache.put(event.request, response.clone()))
      return response
      })),
  )
})
