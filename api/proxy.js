// Vercel Serverless — Proxy de video com Referer correto
// ESTRATEGIA: redirect direto com headers quando possivel
// Arquivo: /api/proxy.js

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS, HEAD')
  if (req.method === 'OPTIONS') return res.status(200).end()

  const { url } = req.query
  if (!url) return res.status(400).json({ error: 'url obrigatorio' })

  const allowed = ['lightspeedst.net','animefire.io','animefire.plus','animefire.net','animeonlinecc.net','animesonlinecloud.com']
  let videoHost
  try { videoHost = new URL(url).hostname } catch {
    return res.status(400).json({ error: 'url invalida' })
  }
  if (!allowed.some(d => videoHost.endsWith(d))) {
    return res.status(403).json({ error: 'Dominio nao permitido' })
  }

  const headers = {
    'Referer': 'https://animefire.io/',
    'Origin':  'https://animefire.io',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  }
  if (req.headers.range) headers['Range'] = req.headers.range

  try {
    // Faz HEAD primeiro para pegar o redirect final
    const head = await fetch(url, { method: 'HEAD', headers, redirect: 'follow' })
    const finalUrl = head.url  // URL final apos redirects

    // Nunca redireciona o browser para o CDN directamente.
    // O token tem ip=IP_Cloudflare — se o browser for directo, o seu IP
    // não bate com o token e o CDN rejeita (403).
    // Sempre fazemos stream aqui pelo proxy (Vercel fica invisível ao CDN
    // porque o token já foi gerado com o IP do Worker Cloudflare).
    const fetchUrl = finalUrl || url

    const MAX = 10 * 1024 * 1024  // 10MB
    const range = req.headers.range || 'bytes=0-'
    const rangeHeaders = { ...headers, Range: range }

    const videoRes = await fetch(fetchUrl, { headers: rangeHeaders })
    const contentLength = Number(videoRes.headers.get('Content-Length') || 0)

    res.setHeader('Content-Type', videoRes.headers.get('Content-Type') || 'video/mp4')
    res.setHeader('Accept-Ranges', 'bytes')
    res.setHeader('Cache-Control', 'public, max-age=3600')

    if (videoRes.headers.get('Content-Range'))
      res.setHeader('Content-Range', videoRes.headers.get('Content-Range'))
    if (contentLength && contentLength < MAX)
      res.setHeader('Content-Length', String(contentLength))

    res.status(videoRes.status || 206)

    // Pipe chunk a chunk sem guardar tudo na memoria
    const reader = videoRes.body.getReader()
    let total = 0
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      total += value.length
      res.write(Buffer.from(value))
      if (total >= MAX) break  // Limita tamanho para nao crashar
    }
    res.end()

  } catch (e) {
    if (!res.headersSent)
      res.status(502).json({ error: e.message })
    else
      res.end()
  }
}
