// Vercel Serverless Function — proxy para o AnimeFire
// Salve em: /api/animefire.js (pasta raiz do projeto)

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()

  const { action, q, slug, ep } = req.query

  const headers = {
    'User-Agent': 'Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 Chrome/120 Safari/537.36',
    'Referer': 'https://animefire.plus/',
    'Accept': 'text/html,application/json,*/*',
  }

  try {
    // ── BUSCA: retorna lista de slugs encontrados ──────────
    if (action === 'search') {
      if (!q) return res.status(400).json({ error: 'q obrigatório' })

      const url = `https://animefire.plus/pesquisar/${encodeURIComponent(q)}/1`
      const r = await fetch(url, { headers })
      const html = await r.text()

      // Extrai href="/animes/slug-do-anime"
      const matches = [...html.matchAll(/href="\/animes\/([a-z0-9\-]+)"/g)]
      const slugs = [...new Set(matches.map(m => m[1]))]
        .filter(s => s && !s.includes('page'))

      // Extrai títulos
      const titleMatches = [...html.matchAll(/class="card-title"[^>]*>([^<]+)</g)]
      const titles = titleMatches.map(m => m[1].trim())

      const results = slugs.map((slug, i) => ({ slug, title: titles[i] || slug }))
      return res.json({ results })
    }

    // ── VÍDEO: retorna URLs do episódio ───────────────────
    if (action === 'video') {
      if (!slug || !ep) return res.status(400).json({ error: 'slug e ep obrigatórios' })

      const url = `https://animefire.plus/video/${slug}/${ep}`
      const r = await fetch(url, { headers: { ...headers, 'Accept': 'application/json' } })

      if (!r.ok) return res.status(r.status).json({ error: `AnimeFire retornou ${r.status}` })

      const data = await r.json()
      return res.json(data)
    }

    // ── INFO ANIME: episódios disponíveis ─────────────────
    if (action === 'info') {
      if (!slug) return res.status(400).json({ error: 'slug obrigatório' })

      const url = `https://animefire.plus/animes/${slug}`
      const r = await fetch(url, { headers })
      const html = await r.text()

      // Extrai episódios: data-video-epnum="1"
      const epMatches = [...html.matchAll(/data-video-epnum="(\d+)"/g)]
      const episodes = [...new Set(epMatches.map(m => parseInt(m[1])))].sort((a, b) => a - b)

      // Extrai título
      const titleMatch = html.match(/<h1[^>]*class="[^"]*anime-title[^"]*"[^>]*>([^<]+)</)
      const title = titleMatch?.[1]?.trim() || slug

      return res.json({ slug, title, episodes })
    }

    return res.status(400).json({ error: 'action inválida. Use: search, video, info' })

  } catch (e) {
    console.error('[animefire proxy]', e)
    return res.status(500).json({ error: e.message })
  }
        }
                                
