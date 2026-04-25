// Vercel Serverless — Proxy de video com Referer correto
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

  const reqHeaders = {
    'Referer':    'https://animefire.plus/',
    'Origin':     'https://animefire.plus',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  }

  // Repassa o Range do browser — essencial para seek e para manter requests pequenos
  // Browsers de video sempre enviam ranges especificos (ex: bytes=0-65535)
  // Se nao vier Range, limita a 2MB para evitar timeout do Vercel
  if (req.headers.range) {
    reqHeaders['Range'] = req.headers.range
  } else {
    reqHeaders['Range'] = 'bytes=0-2097151'  // 2MB max no primeiro request
  }

  try {
    // HEAD para resolver redirects e checar se URL muda de host
    const head = await fetch(url, { method: 'HEAD', headers: reqHeaders, redirect: 'follow' })
    const finalUrl = head.url

    // CDN publico (diferente host) — redireciona direto, sem precisar de Referer
    if (finalUrl !== url && !finalUrl.includes(videoHost)) {
      res.setHeader('Cache-Control', 'public, max-age=300')
      return res.redirect(302, finalUrl)
    }

    // Mesmo host — precisa do proxy com Referer
    // Sem MAX cap: cada range request do browser e pequeno (~64KB-2MB), nao da timeout
    const videoRes = await fetch(url, { headers: reqHeaders })
    const contentLength = videoRes.headers.get('Content-Length')
    const contentRange  = videoRes.headers.get('Content-Range')
    const contentType   = videoRes.headers.get('Content-Type')

    res.setHeader('Content-Type', contentType || 'video/mp4')
    res.setHeader('Accept-Ranges', 'bytes')
    res.setHeader('Cache-Control', 'public, max-age=3600')
    if (contentRange)  res.setHeader('Content-Range',  contentRange)
    if (contentLength) res.setHeader('Content-Length', contentLength)

    res.status(videoRes.status === 206 ? 206 : 200)

    const reader = videoRes.body.getReader()
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      res.write(Buffer.from(value))
      // SEM limite de tamanho — o range request ja e pequeno por natureza
    }
    res.end()

  } catch (e) {
    if (!res.headersSent) res.status(502).json({ error: e.message })
    else res.end()
  }
}
