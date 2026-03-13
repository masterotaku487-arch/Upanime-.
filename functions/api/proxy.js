// functions/api/proxy.js
// Cloudflare Pages Function — equivalente ao api/proxy.js do Vercel

export async function onRequest({ request }) {
  const url    = new URL(request.url)
  const target = url.searchParams.get('url')
  const origin = request.headers.get('Origin') || ''

  const cors = {
    'Access-Control-Allow-Origin':  origin || 'https://upanime.pages.dev',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Range',
  }

  if (request.method === 'OPTIONS')
    return new Response(null, { status: 204, headers: cors })

  if (!target)
    return new Response('Missing url param', { status: 400, headers: cors })

  try {
    const res = await fetch(decodeURIComponent(target), {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer':    'https://www.animefire.plus/',
        'Origin':     'https://www.animefire.plus',
        'Range':      request.headers.get('Range') || '',
      },
    })

    return new Response(res.body, {
      status: res.status,
      headers: {
        ...cors,
        'Content-Type':   res.headers.get('content-type') || 'video/mp4',
        'Content-Length': res.headers.get('content-length') || '',
        'Accept-Ranges':  'bytes',
        'Content-Range':  res.headers.get('content-range') || '',
        'Cache-Control':  'no-store',
      },
    })
  } catch (e) {
    return new Response('Proxy error: ' + e.message, { status: 502, headers: cors })
  }
}
