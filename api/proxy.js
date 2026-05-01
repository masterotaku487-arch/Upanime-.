// Vercel Serverless — Proxy de vídeo com Referer correto
// ESTRATÉGIA: stream direto sem HEAD redirect (tokens IP-locked ao Worker)
// Arquivo: /api/proxy.js

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS, HEAD')
  if (req.method === 'OPTIONS') return res.status(200).end()

  const { url } = req.query
  if (!url) return res.status(400).json({ error: 'url obrigatorio' })

  const allowed = [
    'lightspeedst.net', 'animefire.io', 'animefire.plus', 'animefire.net',
    'animeonlinecc.net', 'animesonlinecloud.com', 'animesonlinecc.to',
    'cdn-fastly.net', 'cloudfront.net', 'akamaihd.net',
  ]
  let videoHost
  try { videoHost = new URL(url).hostname } catch {
    return res.status(400).json({ error: 'url invalida' })
  }
  if (!allowed.some(d => videoHost.endsWith(d))) {
    return res.status(403).json({ error: `Dominio nao permitido: ${videoHost}` })
  }

  // Referer correto por domínio
  const refererMap = {
    'animesonlinecloud.com': 'https://animesonline.cloud/',
    'animesonlinecc.to':     'https://animesonlinecc.to/',
    'animeonlinecc.net':     'https://animesonlinecc.to/',
  }
  const referer = Object.entries(refererMap).find(([d]) => videoHost.endsWith(d))?.[1]
    || 'https://animefire.io/'

  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Referer':    referer,
    'Origin':     referer.replace(/\/$/, ''),
    'Accept':     '*/*',
  }
  if (req.headers.range) headers['Range'] = req.headers.range

  try {
    // Stream direto — NÃO faz HEAD nem segue redirect para outro host
    // (tokens são IP-locked ao Cloudflare Worker, redirect muda o IP)
    const videoRes = await fetch(url, {
      headers,
      redirect: 'follow',
      signal: AbortSignal.timeout(30000),
    })

    if (!videoRes.ok && videoRes.status !== 206) {
      return res.status(videoRes.status).json({ error: `CDN retornou ${videoRes.status}` })
    }

    // Repassa headers relevantes
    const ct = videoRes.headers.get('Content-Type') || 'video/mp4'
    res.setHeader('Content-Type', ct)
    res.setHeader('Accept-Ranges', 'bytes')
    res.setHeader('Cache-Control', 'public, max-age=3600')

    const cr = videoRes.headers.get('Content-Range')
    if (cr) res.setHeader('Content-Range', cr)

    const cl = videoRes.headers.get('Content-Length')
    if (cl) res.setHeader('Content-Length', cl)

    res.status(videoRes.status === 206 ? 206 : 200)

    // Pipe em chunks de 256KB (não guarda tudo na memória)
    const CHUNK = 256 * 1024
    const MAX   = 20 * 1024 * 1024 // 20MB por request Vercel
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
