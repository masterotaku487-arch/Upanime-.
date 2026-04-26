// Vercel Serverless — AnimeFire Proxy
// Substitui o Cloudflare Worker — roda direto no Vercel
// Arquivo: /api/animefire.js
//
// Rotas:
//   ?action=info&slug={slug}         → { slug, episodes: [{ep, url}] }
//   ?action=video&slug={slug}&ep={n} → { sources: [{url, label}] }

const AF_BASE = 'https://animefire.plus'

const BASE_HEADERS = {
  'User-Agent':      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Referer':         AF_BASE + '/',
  'Origin':          AF_BASE,
  'Accept':          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
}

async function fetchAF(path) {
  const res = await fetch(`${AF_BASE}${path}`, {
    headers: BASE_HEADERS,
    redirect: 'follow',
  })
  if (!res.ok) throw new Error(`AnimeFire retornou ${res.status} em ${path}`)
  return res.text()
}

// ── action=info ──────────────────────────────────────────────────────────────
async function handleInfo(slug) {
  const html = await fetchAF(`/animes/${slug}`)

  // Extrai lista de episódios dos links da página
  const epRegex = /href="\/animes\/[^/]+\/(\d+)"/g
  const eps = new Set()
  let m
  while ((m = epRegex.exec(html)) !== null) {
    eps.add(parseInt(m[1]))
  }

  const titleMatch = html.match(/<h1[^>]*>([^<]+)</) || html.match(/<title>([^<|]+)/)
  const title = titleMatch ? titleMatch[1].trim() : slug

  const episodes = [...eps].sort((a, b) => a - b).map(ep => ({
    ep,
    url: `${AF_BASE}/animes/${slug}/${ep}`,
  }))

  return { slug, title, episodes }
}

// ── action=video ─────────────────────────────────────────────────────────────
async function handleVideo(slug, ep) {
  const html = await fetchAF(`/animes/${slug}/${ep}`)

  // Padrão 1: data-video-src ou MP4 direto
  const dataSrcMatch = html.match(/data-video-src="([^"]+)"/)
    || html.match(/data-src="(https:\/\/[^"]+\.mp4[^"]*)"/)
  if (dataSrcMatch) {
    return { sources: [{ url: dataSrcMatch[1], label: 'HD' }] }
  }

  // Padrão 2: endpoint interno /api/episodio?slug=...
  const apiMatch = html.match(/["'](\/api\/episodio[^"']+)["']/)
  if (apiMatch) {
    const apiUrl = `${AF_BASE}${apiMatch[1]}`
    const apiRes = await fetch(apiUrl, {
      headers: { ...BASE_HEADERS, Accept: 'application/json' },
    })
    if (apiRes.ok) {
      const apiData = await apiRes.json()
      const raw = apiData.data || apiData.sources || apiData.videoSources || []
      if (raw.length) {
        return {
          sources: raw
            .map(s => ({ url: s.src || s.file || s.url, label: s.label || s.quality || 'HD' }))
            .filter(s => s.url)
        }
      }
      if (apiData.src) return { sources: [{ url: apiData.src, label: apiData.label || 'HD' }] }
    }
  }

  // Padrão 3: JS inline com videoUrl = "..."
  const varMatch = html.match(/(?:videoUrl|video_url|src)\s*=\s*["'](https?:\/\/[^"']+)["']/)
  if (varMatch) return { sources: [{ url: varMatch[1], label: 'HD' }] }

  // Padrão 4: qualquer URL .mp4 com token no HTML
  const mp4Matches = [...html.matchAll(/https?:\/\/[^\s"'<>]+\.mp4[^\s"'<>]*/g)]
  if (mp4Matches.length) {
    const unique = [...new Set(mp4Matches.map(m => m[0]))]
    return { sources: unique.map((url, i) => ({ url, label: i === 0 ? 'HD' : 'SD' })) }
  }

  throw new Error(`Nenhuma fonte encontrada para ${slug} EP${ep}`)
}

// ── Handler Vercel ────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Cache-Control', 'no-store') // nunca cachear — token expira rápido

  if (req.method === 'OPTIONS') return res.status(200).end()

  const { action, slug, ep } = req.query

  if (!action) return res.status(200).json({ ok: true, msg: 'AnimeFire proxy ativo' })
  if (!slug)   return res.status(400).json({ error: 'slug obrigatório' })

  try {
    if (action === 'info') {
      const data = await handleInfo(slug.trim())
      return res.status(200).json(data)
    }

    if (action === 'video') {
      const data = await handleVideo(slug.trim(), parseInt(ep || '1'))
      return res.status(200).json(data)
    }

    return res.status(400).json({ error: `Action desconhecida: ${action}` })
  } catch (e) {
    console.error(`[animefire] ${action} ${slug} EP${ep}:`, e.message)
    return res.status(500).json({ error: e.message })
  }
}
