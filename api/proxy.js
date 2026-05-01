// Vercel Serverless — Proxy de video
// SEM HEAD, SEM REDIRECT — stream direto com Referer correto
// O browser nunca toca no CDN diretamente → IP do token não importa
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

  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Referer':    'https://animefire.io/',
    'Origin':     'https://animefire.io',
    'Accept':     '*/*',
  }
  if (req.headers.range) headers['Range'] = req.headers.range

  try {
    // Stream direto — SEM HEAD, SEM 302
    // Não seguimos redirects para CDN externo porque o browser
    // usaria o seu próprio IP e o token (IP-locked ao Worker) seria rejeitado.
    const videoRes = await fetch(url, {
      headers,
      redirect: 'manual',   // captura redirect sem seguir
      signal: AbortSignal.timeout(30000),
    })

    // Se for redirect (301/302/307), fazemos fetch do destino NÓS MESMOS
    // em vez de deixar o browser ir direto
    let finalRes = videoRes
    if (videoRes.status >= 300 && videoRes.status < 400) {
      const location = videoRes.headers.get('location')
      if (location) {
        finalRes = await fetch(location, {
          headers,
          redirect: 'follow',
          signal: AbortSignal.timeout(30000),
        })
      }
    }

    if (!finalRes.ok && finalRes.status !== 206) {
      return res.status(finalRes.status).json({ error: `CDN retornou ${finalRes.status}` })
    }

    // Repassa headers de resposta
    res.setHeader('Content-Type',  finalRes.headers.get('Content-Type')  || 'video/mp4')
    res.setHeader('Accept-Ranges', 'bytes')
    res.setHeader('Cache-Control', 'public, max-age=3600')

    const cr = finalRes.headers.get('Content-Range')
    if (cr) res.setHeader('Content-Range', cr)

    const cl = finalRes.headers.get('Content-Length')
    if (cl) res.setHeader('Content-Length', cl)

    res.status(finalRes.status === 206 ? 206 : 200)

    // Pipe chunk a chunk — 10MB max por request (limite Vercel)
    const MAX    = 10 * 1024 * 1024
    const reader = finalRes.body.getReader()
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
