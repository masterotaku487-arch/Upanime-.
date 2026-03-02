// Vercel Serverless Function — Proxy AnimeFire
// Arquivo: /api/animefire.js  (raiz do projeto, NÃO dentro de src/)
//
// Documentação AnimeFire:
//   Busca:           /pesquisar/<query>          (sem /1)
//   Página anime:    /animes/<slug>
//   JSON vídeo:      /video/<slug>/<ep>          (tenta primeiro)
//   Fallback vídeo:  /animes/<slug>/<ep>         (se /video retornar HTML)

const AF_DOMAINS = [
  'https://animefire.plus',
  'https://animefire.io',
  'https://animefire.net',
]

const BASE_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
  'Accept-Encoding': 'gzip, deflate, br',
  'Cache-Control': 'no-cache',
  'Sec-Fetch-Site': 'same-origin',
  'Sec-Fetch-Mode': 'navigate',
}

// Fetch com fallback de domínio + detecção de bloqueio Cloudflare
async function afFetch(path, extraHeaders = {}, expectJson = false) {
  const headers = { ...BASE_HEADERS, ...extraHeaders }
  let lastError = null

  for (const domain of AF_DOMAINS) {
    const url = domain + path
    try {
      const r = await fetch(url, {
        headers: { ...headers, Referer: domain + '/', Origin: domain },
        signal: AbortSignal.timeout(12000),
        redirect: 'follow',
      })

      // Detectar bloqueio Cloudflare (retorna 403 ou HTML de challenge)
      if (r.status === 403 || r.status === 503) {
        lastError = { domain, status: r.status, reason: 'Cloudflare block' }
        continue
      }

      if (!r.ok) {
        lastError = { domain, status: r.status }
        continue
      }

      if (expectJson) {
        const text = await r.text()
        // Verificar se é HTML de bloqueio disfarçado
        if (text.trim().startsWith('<')) {
          lastError = { domain, reason: 'returned HTML instead of JSON (Cloudflare?)' }
          continue
        }
        try {
          return { body: JSON.parse(text), domain, status: r.status }
        } catch {
          lastError = { domain, reason: 'invalid JSON', preview: text.slice(0, 100) }
          continue
        }
      }

      return { body: await r.text(), domain, status: r.status }
    } catch (e) {
      lastError = { domain, error: e.message }
    }
  }

  throw new Error(`AnimeFire inacessível. Último: ${JSON.stringify(lastError)}`)
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()

  const { action, q, slug, ep } = req.query

  try {
    // ── SEARCH ───────────────────────────────────────────────
    // URL: /pesquisar/<query>   (sem /1 no final)
    if (action === 'search') {
      if (!q) return res.status(400).json({ error: 'q obrigatório' })

      const query = q.toLowerCase().trim().replace(/['"]/g, '')
      // FIX: sem /1 no final
      const path = `/pesquisar/${encodeURIComponent(query)}`
      const { body: html, domain } = await afFetch(path)

      const slugs = [...html.matchAll(/href="\/animes\/([a-z0-9\-]+)\/?(?:\d+)?"/g)]
        .map(m => m[1])
        .filter((v, i, a) => a.indexOf(v) === i)
        .filter(s => s.length > 2)

      const titles = [...html.matchAll(/class="[^"]*card-title[^"]*"[^>]*>([^<]+)</g)]
        .map(m => m[1].trim())

      const results = slugs.map((s, i) => ({
        slug: s,
        title: titles[i] || s.replace(/-/g, ' '),
        url: `${domain}/animes/${s}`,
      }))

      return res.json({ results, domain, total: results.length })
    }

    // ── VIDEO ────────────────────────────────────────────────
    // Tenta /video/<slug>/<ep> primeiro (JSON direto)
    // Fallback: /animes/<slug>/<ep> (página HTML com sources)
    if (action === 'video') {
      if (!slug) return res.status(400).json({ error: 'slug obrigatório' })
      if (!ep)   return res.status(400).json({ error: 'ep obrigatório' })

      const epNum = parseInt(ep, 10)
      if (isNaN(epNum) || epNum < 1)
        return res.status(400).json({ error: 'ep deve ser número >= 1' })

      let data = null
      let domain = null

      // Tentativa 1: /video/<slug>/<ep> → espera JSON
      try {
        const result = await afFetch(`/video/${slug}/${epNum}`, { Accept: 'application/json' }, true)
        data = result.body
        domain = result.domain
      } catch (e1) {
        // Tentativa 2: /animes/<slug>/<ep> → página HTML, extrai sources do JS
        try {
          const result = await afFetch(`/animes/${slug}/${epNum}`)
          domain = result.domain
          const html = result.body

          // Extrair sources do HTML da página do episódio
          const videoDataMatch = html.match(/var\s+(?:videoData|sources)\s*=\s*(\[[\s\S]+?\]);/)
            || html.match(/sources:\s*(\[[\s\S]+?\])/)
          if (videoDataMatch) {
            data = { data: JSON.parse(videoDataMatch[1]) }
          } else {
            // Fallback: extrair mp4 direto
            const mp4s = [...html.matchAll(/["'](https?:\/\/[^"']+\.mp4[^"']*)['"]/g)]
              .map(m => ({ label: 'Auto', src: m[1] }))
            data = { data: mp4s }
          }
        } catch (e2) {
          throw new Error(`Ambas as rotas falharam:\n  /video: ${e1.message}\n  /animes: ${e2.message}`)
        }
      }

      const raw = data?.data || data?.sources || data?.links || []
      const sources = raw
        .map(s => ({
          label: s.label || s.resolution || s.quality || 'Auto',
          url:   s.src   || s.url       || s.file    || s.link || '',
        }))
        .filter(s => s.url)

      const order = ['fullhd', 'full hd', 'fhd', '1080', 'hd', '720', 'sd', '480', '360']
      sources.sort((a, b) => {
        const ai = order.findIndex(o => a.label.toLowerCase().includes(o))
        const bi = order.findIndex(o => b.label.toLowerCase().includes(o))
        return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
      })

      if (!sources.length)
        return res.status(404).json({ error: 'Nenhuma source encontrada', raw: data })

      return res.json({ sources, provider: '🇧🇷 AnimeFire', domain, episode: epNum })
    }

    // ── INFO ─────────────────────────────────────────────────
    // URL: /animes/<slug>
    if (action === 'info') {
      if (!slug) return res.status(400).json({ error: 'slug obrigatório' })

      const { body: html, domain } = await afFetch(`/animes/${slug}`)

      const epNums = [
        ...html.matchAll(new RegExp(`/animes/${slug}/(\\d+)`, 'g')),
        ...html.matchAll(/data-video-epnum="(\d+)"/g),
        ...html.matchAll(/data-ep(?:num|isode)?="(\d+)"/g),
      ].map(m => parseInt(m[1])).filter(n => !isNaN(n) && n > 0)

      const episodes = [...new Set(epNums)].sort((a, b) => a - b)

      const titleMatch = html.match(/<h1[^>]*>([^<]+)<\/h1>/) || html.match(/<title>([^<|–-]+)/)
      const title = titleMatch?.[1]?.trim().replace(/\s*[–-]\s*AnimeFire.*/i, '') || slug

      const imgMatch = html.match(/og:image[^>]+content="([^"]+)"/)
        || html.match(/class="[^"]*poster[^"]*"[\s\S]{0,300}src="([^"]+)"/)

      return res.json({
        slug, title, episodes,
        image: imgMatch?.[1] || '',
        domain, source: 'animefire', total: episodes.length,
      })
    }

    return res.status(400).json({
      error: 'action inválida',
      actions: {
        search: '/api/animefire?action=search&q=naruto',
        video:  '/api/animefire?action=video&slug=naruto&ep=1',
        info:   '/api/animefire?action=info&slug=naruto',
      },
    })

  } catch (e) {
    console.error('[animefire proxy]', e)
    return res.status(502).json({
      error: e.message,
      hint: 'Cloudflare pode estar bloqueando. Tente outro domínio em AF_DOMAINS.',
      domains_tried: AF_DOMAINS,
    })
  }
                   }
      
