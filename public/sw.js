// public/sw.js
// Service Worker — usa fetch referrer option para enviar Referer: https://animefire.io/
// "referrer" é uma opção da Fetch API (não header proibido) — funciona no SW!

const CDN_HOSTS = ['lightspeedst.net']

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()))

self.addEventListener('fetch', (event) => {
  const url = event.request.url
  if (!CDN_HOSTS.some(h => url.includes(h))) return

  event.respondWith(
    fetch(url, {
      method:        event.request.method,
      headers:       event.request.headers,
      referrer:      'https://animefire.io/',  // fetch API option — não é header proibido!
      referrerPolicy:'unsafe-url',
      credentials:   'omit',
      mode:          'cors',
    })
  )
})
