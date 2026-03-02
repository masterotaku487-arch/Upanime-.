// Vercel Serverless Function — repassa para o Cloudflare Worker
// Arquivo: /api/animefire.js
//
// Requer variável no Vercel: ANIMEFIRE_PROXY_URL=https://SEU-WORKER.workers.dev

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()

  const PROXY = process.env.ANIMEFIRE_PROXY_URL

  if (!PROXY) {
    return res.status(503).json({
      error: 'ANIMEFIRE_PROXY_URL não configurado',
      hint: 'Vercel → Settings → Environment Variables → adicione ANIMEFIRE_PROXY_URL'
    })
  }

  try {
    const qs = new URLSearchParams(req.query).toString()
    const r = await fetch(`${PROXY}?${qs}`, { signal: AbortSignal.timeout(70000) })
    const data = await r.json()
    return res.status(r.status).json(data)
  } catch (e) {
    return res.status(502).json({ error: e.message })
  }
}
