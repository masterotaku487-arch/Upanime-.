// Vercel Serverless — Proxy de vídeo com Referer correto
// Arquivo: /api/proxy.js
//
// Uso: /api/proxy?url=https://lightspeedst.net/...

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  if (req.method === 'OPTIONS') return res.status(200).end()

  const { url } = req.query
  if (!url) return res.status(400).json({ error: 'url obrigatório' })

  // Só permite domínios conhecidos do AnimeFire
  const allowed = ['lightspeedst.net', 'animefire.io', 'animefire.plus', 'animefire.net']
  let videoHost
  try {
    videoHost = new URL(url).hostname
  } catch {
    return res.status(400).json({ error: 'url inválida' })
  }

  if (!allowed.some(d => videoHost.endsWith(d))) {
    return res.status(403).json({ error: 'Domínio não permitido' })
  }

  try {
    const headers = {
      'Referer': 'https://animefire.io/',
      'Origin': 'https://animefire.io',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    }

    // Repassa Range para suporte a seek no player
    if (req.headers.range) headers['Range'] = req.headers.range

    const videoRes = await fetch(url, { headers })

    res.setHeader('Content-Type', videoRes.headers.get('Content-Type') || 'video/mp4')
    res.setHeader('Accept-Ranges', 'bytes')
    res.setHeader('Cache-Control', 'public, max-age=3600')

    if (videoRes.headers.get('Content-Length'))
      res.setHeader('Content-Length', videoRes.headers.get('Content-Length'))
    if (videoRes.headers.get('Content-Range'))
      res.setHeader('Content-Range', videoRes.headers.get('Content-Range'))

    res.status(videoRes.status)

    const reader = videoRes.body.getReader()
    const stream = new ReadableStream({
      async start(controller) {
        while (true) {
          const { done, value } = await reader.read()
          if (done) { controller.close(); break }
          controller.enqueue(value)
        }
      }
    })

    // Pipe do stream para o response
    const buffer = await new Response(stream).arrayBuffer()
    res.end(Buffer.from(buffer))

  } catch (e) {
    res.status(502).json({ error: e.message })
  }
}
