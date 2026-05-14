// api/af-stream.js
// Proxy mínimo — só adiciona Referer: https://animefire.io/ e streama
// Resolve o CORS: browser chama /api/af-stream?url=... (mesma origem Vercel)
// Vercel chama lightspeedst.net com o Referer correto

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS')
  if (req.method === 'OPTIONS') return res.status(200).end()

  const { url } = req.query
  if (!url) return res.status(400).json({ error: 'url obrigatorio' })

  // Valida domínio
  let host
  try { host = new URL(url).hostname } catch {
    return res.status(400).json({ error: 'url invalida' })
  }
  if (!host.endsWith('lightspeedst.net') && !host.endsWith('animefire.io')) {
    return res.status(403).json({ error: 'dominio nao permitido' })
  }

  const headers = {
    'Referer':    'https://animefire.io/',
    'Origin':     'https://animefire.io',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  }
  if (req.headers.range) headers['Range'] = req.headers.range

  try {
    const upstream = await fetch(url, { headers, signal: AbortSignal.timeout(30000) })

    res.setHeader('Content-Type', upstream.headers.get('Content-Type') || 'video/mp4')
    res.setHeader('Accept-Ranges', 'bytes')
    res.setHeader('Cache-Control', 'public, max-age=3600')
    if (upstream.headers.get('Content-Range'))
      res.setHeader('Content-Range', upstream.headers.get('Content-Range'))
    if (upstream.headers.get('Content-Length'))
      res.setHeader('Content-Length', upstream.headers.get('Content-Length'))

    res.status(upstream.status)
    const reader = upstream.body.getReader()
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      res.write(Buffer.from(value))
    }
    res.end()
  } catch (e) {
    if (!res.headersSent) res.status(502).json({ error: e.message })
    else res.end()
  }
}
