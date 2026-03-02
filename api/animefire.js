// /api/animefire.js
// Vercel Serverless Function — Proxy AnimeFire (multi-domínio com fallback)

const AF_DOMAINS = [
  'https://animefire.plus',
  'https://animesfire.online',
  'https://animefire.net',
]

const BASE_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Mobile Safari/537.36',
  'Accept-Language': 'pt-BR,pt;q=0.9',
  'Accept': 'text/html,application/xhtml+xml,application/json,*/*;q=0.8',
}

async function afFetch(path, extraHeaders = {}, expectJson = false) {
  const headers = { ...BASE_HEADERS, ...extraHeaders }
  let lastError = null

  for (const domain of AF_DOMAINS) {
    const url = domain + path
    try {
      const r = await fetch(url, {
        headers: { ...headers, Referer: domain + '/' },
        signal: AbortSignal.timeout(12000),
        redirect: 'follow',
      })

      if (!r.ok) {
        lastError = { domain, status: r.status }
        continue
      }

      const body = expectJson ? await r.json() : await r.text()
      return { body, domain, status: r.status }

    } catch (e) {
      lastError = { domain, error: e.message }
    }
  }

  throw new Error(
    `AnimeFire inacessível em todos os domínios. Último erro: ${JSON.stringify(lastError)}`
  )
}

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()

  const { action, q, slug, ep } = req.query

  try {
    // ── SEARCH ──────────────────────────────────────────────────────────────
    if (action === 'search') {
      if (!q) return res.status(400).json({ error: 'Parâmetro q obrigatório' })

      // <-- sem /1 no final (ajuste importante)
      const path = `/pesquisar/${encodeURIComponent(q.toLowerCase().trim())}`
      const { body: html, domain } = await afFetch(path)

      const slugs = [...html.matchAll(/href="\/animes\/([a-z0-9\-]+)"/g)]
        .map((m) => m[1])
        .filter((v, i, a) => a.indexOf(v) === i)
        .filter((s) => !s.includes('page') && s.length > 3)

      const titles = [...html.matchAll(/class="[^"]*card-title[^"]*"[^>]*>([^<]+)</g)]
        .map((m) => m[1].trim())

      const results = slugs.map((s, i) => ({
        slug: s,
        title: titles[i] || s.replace(/-todos-os-episodios/g, '').replace(/-/g, ' '),
        url: `${domain}/animes/${s}`,
        source: 'animefire',
      }))

      return res.json({ results, domain, total: results.length })
    }

    // ── VIDEO ────────────────────────────────────────────────────────────────
    if (action === 'video') {
      if (!slug) return res.status(400).json({ error: 'Parâmetro slug obrigatório' })
      if (!ep)   return res.status(400).json({ error: 'Parâmetro ep obrigatório' })

      const epNum = parseInt(ep, 10)
      if (isNaN(epNum) || epNum < 1) return res.status(400).json({ error: 'ep deve ser número >= 1' })

      // Tenta primeiro endpoint /video (JSON)
      try {
        const path = `/video/${slug}/${epNum}`
        const { body: data, domain } = await afFetch(path, { Accept: 'application/json' }, true)

        const raw = data.data || data.sources || data.links || []
        let sources = raw
          .map((s) => ({
            label: s.label || s.resolution || s.quality || 'Auto',
            url:   s.src   || s.url       || s.file    || s.link || '',
            source: 'animefire',
            domain,
          }))
          .filter((s) => s.url)

        // Ordenar por qualidade (FullHD > HD > SD)
        const order = ['fullhd', 'full hd', 'fhd', '1080', 'hd', '720', 'sd', '480', '360', 'auto']
        sources.sort((a, b) => {
          const ai = order.findIndex((o) => a.label.toLowerCase().includes(o))
          const bi = order.findIndex((o) => b.label.toLowerCase().includes(o))
          return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
        })

        if (!sources.length) {
          // cair pro fallback (vai tentar extrair do HTML abaixo)
          throw new Error('Sem sources no JSON, tentando fallback HTML')
        }

        return res.json({ sources, provider: '🇧🇷 AnimeFire', domain, episode: epNum })
      } catch (e) {
        // fallback: busca a página do anime e tenta extrair referências a /video/ e construir sources simples
        try {
          const path = `/animes/${slug}`
          const { body: html, domain } = await afFetch(path)

          // extrai ocorrências de /video/<slug>/<num> e tenta chamar /video para cada uma
          const matches = [...html.matchAll(/\/video\/([a-z0-9\-]+)\/(\d+)/g)]
            .map(m => ({ s: m[1], n: parseInt(m[2], 10) }))
            .filter(Boolean)

          // se não achar, responde 404
          if (!matches.length) {
            return res.status(404).json({ error: 'Nenhuma referência de video encontrada na página HTML', hint: e.message })
          }

          // entra no primeiro que bater com epNum
          const candidate = matches.find(m => m.n === epNum) || matches[0]
          // tenta buscar JSON desse candidate
          const { body: altData, domain: altDomain } = await afFetch(`/video/${candidate.s}/${candidate.n}`, { Accept: 'application/json' }, true)
          const raw2 = altData.data || altData.sources || altData.links || []
          const sources = raw2
            .map((s) => ({
              label: s.label || s.resolution || s.quality || 'Auto',
              url:   s.src   || s.url       || s.file    || s.link || '',
              source: 'animefire',
              domain: altDomain,
            }))
            .filter((s) => s.url)

          if (!sources.length) return res.status(404).json({ error: 'Fallback sem sources', raw: altData })

          return res.json({ sources, provider: '🇧🇷 AnimeFire (fallback)', domain: altDomain, episode: candidate.n })
        } catch (e2) {
          return res.status(502).json({ error: 'video fallback falhou', cause: e2.message })
        }
      }
    }

    // ── INFO ─────────────────────────────────────────────────────────────────
    if (action === 'info') {
      if (!slug) return res.status(400).json({ error: 'Parâmetro slug obrigatório' })

      const path = `/animes/${slug}`
      const { body: html, domain } = await afFetch(path)

      const epNums = [
        ...html.matchAll(/data-video-epnum="(\d+)"/g),
        ...html.matchAll(/\/video\/[^"]+\/(\d+)/g),
      ].map((m) => parseInt(m[1])).filter(Boolean)

      const episodes = [...new Set(epNums)].sort((a, b) => a - b)

      const titleMatch =
        html.match(/<h1[^>]*>([^<]+)<\/h1>/) ||
        html.match(/<title>([^<|]+)/)
      const title = titleMatch?.[1]?.trim().replace(/ [–-] AnimeFire.*/, '') || slug

      const imgMatch =
        html.match(/class="[^"]*poster[^"]*"[\s\S]{0,200}src="([^"]+)"/) ||
        html.match(/og:image[^>]+content="([^"]+)"/)
      const image = imgMatch?.[1] || ''

      return res.json({ slug, title, episodes, image, domain, source: 'animefire', total: episodes.length })
    }

    // ── Ação inválida ─────────────────────────────────────────────────────────
    return res.status(400).json({
      error: 'action inválida',
      actions: {
        search: '/api/animefire?action=search&q=naruto',
        video:  '/api/animefire?action=video&slug=naruto-todos-os-episodios&ep=1',
        info:   '/api/animefire?action=info&slug=naruto-todos-os-episodios',
      },
      domains: AF_DOMAINS,
    })

  } catch (e) {
    console.error('[animefire proxy]', e)
    return res.status(502).json({
      error: e.message,
      hint: 'O AnimeFire pode ter mudado de domínio. Atualize AF_DOMAINS em api/animefire.js',
      domains_tried: AF_DOMAINS,
    })
  }
          }
