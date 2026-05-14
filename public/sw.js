// public/sw.js
// Service Worker — injeta Referer: https://animefire.io/ em requests para lightspeedst.net
// Roda no browser do usuário — IP real, Referer correto → CDN aceita

const ANIMEFIRE_REFERER = 'https://animefire.io/'
const CDN_HOSTS = ['lightspeedst.net']

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()))

self.addEventListener('fetch', (event) => {
  const url = event.request.url

  // Só intercepta requests para o CDN do AnimeFire
  if (!CDN_HOSTS.some(h => url.includes(h))) return

  event.respondWith(
    fetch(event.request, {
      headers: {
        ...Object.fromEntries(event.request.headers.entries()),
        'Referer': ANIMEFIRE_REFERER,
        'Origin':  'https://animefire.io',
      },
      mode:        'cors',
      credentials: 'omit',
    }).catch(() =>
      // Fallback sem Origin se CORS falhar
      fetch(url, {
        headers: {
          'Referer':    ANIMEFIRE_REFERER,
          'User-Agent': navigator.userAgent,
        },
        mode: 'no-cors',
      })
    )
  )
})
