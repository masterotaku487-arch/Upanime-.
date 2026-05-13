// functions/api/token.js
// CORS proxy APENAS para pegar o token do AnimeFire
// Browser chama /api/token?slug=naruto&ep=1
// Token vem com ip=<IP DO USUÁRIO> pois o IP forwarding é do browser
// Browser então streama DIRETO do lightspeedst.net com seu IP — sem 401!

const AF = 'https://animefire.io'

export async function onRequest({ request }) {
  const cors = {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': '*',
    'Content-Type':                 'application/json',
  }

  if (request.method === 'OPTIONS')
    return new Response(null, { status: 204, headers: cors })

  const url  = new URL(request.url)
  const slug = url.searchParams.get('slug')
  const ep   = parseInt(url.searchParams.get('ep') || '1')

  if (!slug)
    return new Response(JSON.stringify({ error: 'slug obrigatório' }), { status: 400, headers: cors })

  // IP real do usuário — Cloudflare sempre passa isso
  const userIp = request.headers.get('CF-Connecting-IP') || ''

  try {
    const res = await fetch(`${AF}/video/${slug}/${ep}`, {
      headers: {
        'User-Agent':      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer':         `${AF}/`,
        'Origin':          AF,
        'Accept':          'application/json, */*',
        'X-Forwarded-For': userIp,
        'X-Real-IP':       userIp,
      },
    })

    const data = await res.json()
    const raw  = data.data || data.sources || []

    const sources = raw
      .map(s => ({ url: s.src || s.url || s.file || '', label: s.label || 'HD' }))
      .filter(s => s.url)

    if (!sources.length)
      return new Response(JSON.stringify({ error: 'Sem fontes' }), { status: 404, headers: cors })

    // Retorna as URLs diretas — browser streama com seu próprio IP
    return new Response(JSON.stringify({ sources, tokenIp: userIp }), { headers: cors })

  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: cors })
  }
}
