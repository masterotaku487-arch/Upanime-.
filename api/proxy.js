// Vercel Serverless — Proxy de video
// Combina o melhor das duas versões:
//   - Range request forçado (antigo) → CDN devolve 206 → browser pede chunks correctamente
//   - Sem 302 redirect para o browser (novo) → browser nunca vai ao CDN directamente
// Arquivo: /api/proxy.js

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin',  '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS, HEAD')
  res.setHeader('Access-Control-Allow-Headers', 'Range, Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()

  const { url } = req.query
  if (!url) return res.status(400).json({ error: 'url obrigatorio' })

  const allowed = [
    'lightspeedst.net', 'animefire.io', 'animefire.plus', 'animefire.net',
    'animeonlinecc.net', 'animesonlinecloud.com', 'animesonlinecc.to',
    'akamaihd.net', 'cloudfront.net', 'cdn-fastly.net',
  ]
  let videoHost
  try { videoHost = new URL(url).hostname } catch {
    return res.status(400).json({ error: 'url invalida' })
  }
  if (!allowed.some(d => videoHost.endsWith(d))) {
    return res.status(403).json({ error: 'Dominio nao permitido: ' + videoHost })
  }

  const baseHeaders = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Referer':    'https://animefire.io/',
    'Origin':     'https://animefire.io',
    'Accept':     '*/*',
  }

  try {
    // ── PASSO 1: HEAD para descobrir redirect sem expor IP ao CDN ──
    // O HEAD é leve e resolve a URL final. Se houver redirect para CDN externo,
    // o proxy STREAMA de lá (não faz 302 para o browser)
    const head = await fetch(url, {
      method: 'HEAD',
      headers: baseHeaders,
      redirect: 'follow',
      signal: AbortSignal.timeout(10000),
    })
    const finalUrl = head.url  // URL final após redirects

    // URL de onde vamos fazer o fetch real (pode ser diferente da original)
    const fetchUrl = finalUrl || url

    // ── PASSO 2: Range request → CDN devolve 206 → browser pede chunks correctamente
    // Sem Content-Length no response → browser não fica à espera do ficheiro completo
    const range = req.headers.range || 'bytes=0-'
    const headers = { ...baseHeaders, 'Range': range }

    const MAX = 10 * 1024 * 1024  // 10MB por invocação Vercel

    const videoRes = await fetch(fetchUrl, {
      headers,
      redirect: 'follow',
      signal: AbortSignal.timeout(55000),
    })

    if (!videoRes.ok && videoRes.status !== 206) {
      return res.status(videoRes.status).json({ error: `CDN retornou ${videoRes.status} em ${fetchUrl}` })
    }

    const ct = videoRes.headers.get('Content-Type') || 'video/mp4'
    res.setHeader('Content-Type',  ct)
    res.setHeader('Accept-Ranges', 'bytes')
    res.setHeader('Cache-Control', 'public, max-age=300')

    const cr = videoRes.headers.get('Content-Range')
    if (cr) res.setHeader('Content-Range', cr)

    // Só define Content-Length se couber no MAX (evita browser esperar o ficheiro todo)
    const cl = Number(videoRes.headers.get('Content-Length') || 0)
    if (cl && cl <= MAX) res.setHeader('Content-Length', String(cl))

    res.status(videoRes.status === 206 ? 206 : 200)

    const reader = videoRes.body.getReader()
    let total = 0
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      total += value.length
      res.write(Buffer.from(value))
      if (total >= MAX) break
    }
    res.end()

  } catch (e) {
    if (!res.headersSent)
      res.status(502).json({ error: e.message })
    else
      res.end()
  }
}
