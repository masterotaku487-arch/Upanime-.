// Vercel Serverless — Super Proxy de Video
// Objetivo: Burlar o erro 403 do AnimeFire/Lightspeedst

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS, HEAD')
  if (req.method === 'OPTIONS') return res.status(200).end()

  const { url } = req.query
  if (!url) return res.status(400).json({ error: 'URL do vídeo é obrigatória' })

  // Filtro de segurança para domínios permitidos
  const allowedDomains = [
    'lightspeedst.net',
    'animefire.io',
    'animefire.plus',
    'animefire.net',
    'animeonlinecc.net',
    'animesonlinecloud.com'
  ]

  try {
    const targetUrl = new URL(url)
    if (!allowedDomains.some(d => targetUrl.hostname.endsWith(d))) {
      return res.status(403).json({ error: 'Domínio não permitido' })
    }

    // HEADERS AVANÇADOS: Simula um navegador real para evitar o 403
    const headers = {
      'Referer': 'https://animefire.io/',
      'Origin': 'https://animefire.io',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept': '*/*',
      'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
      'Connection': 'keep-alive',
      'Sec-Fetch-Dest': 'video',
      'Sec-Fetch-Mode': 'cors',
      'Sec-Fetch-Site': 'cross-site',
    }

    // Repassa o Range do player (essencial para vídeos)
    if (req.headers.range) {
      headers['Range'] = req.headers.range
    }

    const videoRes = await fetch(url, {
      headers,
      method: 'GET',
      redirect: 'follow',
    })

    if (!videoRes.ok && videoRes.status !== 206) {
      console.error(`[Proxy Error] Status: ${videoRes.status}`)
      return res.status(videoRes.status).json({ error: `Erro na origem: ${videoRes.status}` })
    }

    // Repassa os headers de conteúdo
    res.setHeader('Content-Type', videoRes.headers.get('Content-Type') || 'video/mp4')
    res.setHeader('Accept-Ranges', 'bytes')
    
    const contentRange = videoRes.headers.get('Content-Range')
    if (contentRange) res.setHeader('Content-Range', contentRange)
    
    const contentLength = videoRes.headers.get('Content-Length')
    if (contentLength) res.setHeader('Content-Length', contentLength)

    res.status(videoRes.status)

    // Streaming do corpo da resposta
    if (videoRes.body) {
      const reader = videoRes.body.getReader()
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        res.write(Buffer.from(value))
      }
    }
    
    res.end()

  } catch (err) {
    console.error('[Fatal Proxy Error]', err.message)
    if (!res.headersSent) {
      res.status(502).json({ error: 'Erro ao processar o streaming do vídeo' })
    } else {
      res.end()
    }
  }
}
