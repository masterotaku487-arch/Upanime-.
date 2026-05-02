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

    // Força Range → CDN devolve 206, browser faz seek correctamente
    // Sem isso o CDN envia 200 + Content-Length do ficheiro inteiro (200MB)
    // e o Vercel faz timeout antes de enviar tudo → 502
    if (!headers['Range']) headers['Range'] = 'bytes=0-'

    const videoRes = await fetch(url, { headers, redirect: 'follow' })

    res.setHeader('Content-Type', videoRes.headers.get('Content-Type') || 'video/mp4')
    res.setHeader('Accept-Ranges', 'bytes')
    res.setHeader('Cache-Control', 'public, max-age=3600')

    if (videoRes.headers.get('Content-Range'))
      res.setHeader('Content-Range', videoRes.headers.get('Content-Range'))

    // Só envia Content-Length se o chunk for pequeno o suficiente
    // Evita o browser ficar à espera de 200MB que nunca chegam
    const MAX = 10 * 1024 * 1024 // 10MB por invocação Vercel
    const cl = Number(videoRes.headers.get('Content-Length') || 0)
    if (cl && cl <= MAX) res.setHeader('Content-Length', String(cl))

    res.status(videoRes.status === 206 ? 206 : 200)

    // Stream chunk a chunk — NUNCA carrega o vídeo inteiro na memória
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
    res.status(502).json({ error: e.message })
  }
}
