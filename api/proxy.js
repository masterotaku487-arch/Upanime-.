// functions/api/proxy.js
// Cloudflare Pages Function — Video stream proxy
// Mesmo datacenter que /api/animefire → mesmo IP → token válido

export async function onRequest({ request }) {
  const url    = new URL(request.url)
  const target = url.searchParams.get('url')

  const cors = {
    'Access-Control-Allow-Origin':   '*',
    'Access-Control-Allow-Methods':  'GET, HEAD, OPTIONS',
    'Access-Control-Allow-Headers':  'Range, Content-Type',
    'Access-Control-Expose-Headers': 'Content-Range, Content-Length, Accept-Ranges',
  }

  if (request.method === 'OPTIONS')
    return new Response(null, { status: 204, headers: cors })

  if (!target)
    return new Response('Missing url param', { status: 400, headers: cors })

  const allowed = ['lightspeedst.net','animefire.io','animefire.plus','animefire.net',
                   'animeonlinecc.net','animesonlinecloud.com']
  let host
  try { host = new URL(decodeURIComponent(target)).hostname } catch {
    return new Response('URL inválida', { status: 400, headers: cors })
  }
  if (!allowed.some(d => host.endsWith(d)))
    return new Response('Domínio não permitido', { status: 403, headers: cors })

  const range = request.headers.get('Range')
  const res   = await fetch(decodeURIComponent(target), {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Referer':    'https://animefire.io/',
      'Origin':     'https://animefire.io',
      'Accept':     '*/*',
      ...(range ? { 'Range': range } : {}),
    },
  })

  const resHeaders = {
    ...cors,
    'Content-Type':  res.headers.get('Content-Type')  || 'video/mp4',
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'no-store',
  }
  const cr = res.headers.get('Content-Range')
  const cl = res.headers.get('Content-Length')
  if (cr) resHeaders['Content-Range']  = cr
  if (cl) resHeaders['Content-Length'] = cl

  return new Response(res.body, { status: res.status, headers: resHeaders })
}
