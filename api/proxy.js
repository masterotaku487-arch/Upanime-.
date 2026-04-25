// Vercel Serverless — Proxy de video com Referer correto
// ESTRATEGIA: sempre redireciona para a URL final do CDN
// Isso evita o limite de tamanho e timeout de funcoes serverless
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
    'Referer': 'https://animefire.plus/',
    'Origin':  'https://animefire.plus',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  }

  try {
    // Resolve a URL final do CDN seguindo redirects
    const head = await fetch(url, { method: 'HEAD', headers, redirect: 'follow' })
    const finalUrl = head.url

    // Sempre redireciona para a URL final resolvida
    // O browser busca o video direto do CDN sem passar pelo proxy
    // Isso elimina o limite de 10MB que causava o loop de erro
    res.setHeader('Cache-Control', 'public, max-age=300')
    return res.redirect(302, finalUrl)

  } catch (e) {
    if (!res.headersSent)
      res.status(502).json({ error: e.message })
    else
      res.end()
  }
}
