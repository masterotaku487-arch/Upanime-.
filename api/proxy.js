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

  const headers = {
    'Referer': 'https://animefire.io/',
    'Origin':  'https://animefire.io',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  }
  
  if (req.headers.range) {
    headers['Range'] = req.headers.range
  }

  try {
    const videoRes = await fetch(url, { 
      headers, 
      redirect: 'follow', 
      signal: AbortSignal.timeout(60000) 
    })

    // Repassa os headers importantes do vídeo original
    res.setHeader('Content-Type', videoRes.headers.get('Content-Type') || 'video/mp4')
    res.setHeader('Accept-Ranges', 'bytes')
    
    if (videoRes.headers.get('Content-Range')) {
      res.setHeader('Content-Range', videoRes.headers.get('Content-Range'))
    }
    if (videoRes.headers.get('Content-Length')) {
      res.setHeader('Content-Length', videoRes.headers.get('Content-Length'))
    }

    res.status(videoRes.status || 200)

    // Streaming direto sem limite de tamanho (corrigindo o erro de 10MB)
    const reader = videoRes.body.getReader()
    
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      res.write(Buffer.from(value))
    }
    
    res.end()

  } catch (e) {
    console.error('[Proxy Error]', e.message)
    if (!res.headersSent) {
      res.status(502).json({ error: e.message })
    } else {
      res.end()
    }
  }
}
