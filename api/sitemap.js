// api/sitemap.js — Sitemap enxuto para não afundar no Google
export default async function handler(req, res) {
  try {
    const base  = 'https://upanime-nine.vercel.app'
    const today = new Date().toISOString().split('T')[0]
    const esc   = (s) => (s||'').replace(/[<>&"']/g, c =>
      ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&apos;'}[c]))

    // SO animes da temporada atual + top 25 — pages reais que o Google consegue ler
    const [r1, r2] = await Promise.allSettled([
      fetch('https://api.jikan.moe/v4/seasons/now?limit=25').then(r=>r.json()),
      fetch('https://api.jikan.moe/v4/top/anime?limit=25&filter=bypopularity').then(r=>r.json()),
    ])

    const seen = new Set()
    const animes = []
    for (const r of [r1, r2]) {
      if (r.status !== 'fulfilled') continue
      for (const a of r.value?.data || []) {
        if (!seen.has(a.mal_id)) { seen.add(a.mal_id); animes.push(a) }
      }
    }

    // Páginas estáticas
    const staticPages = [
      { loc: `${base}/`,         priority: '1.0', freq: 'daily'   },
      { loc: `${base}/search`,   priority: '0.8', freq: 'weekly'  },
      { loc: `${base}/explorar`, priority: '0.7', freq: 'daily'   },
      { loc: `${base}/novidades`,priority: '0.7', freq: 'daily'   },
    ]

    const staticXml = staticPages.map(p => `
  <url>
    <loc>${p.loc}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${p.freq}</changefreq>
    <priority>${p.priority}</priority>
  </url>`).join('')

    // SO páginas /anime/ID — NÃO inclui episódios (/watch/)
    const animeXml = animes.map(a => {
      const title = esc(a.title_english || a.title)
      return `
  <url>
    <loc>${base}/anime/${a.mal_id}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`
    }).join('')

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${staticXml}
${animeXml}
</urlset>`

    res.setHeader('Content-Type', 'application/xml')
    res.setHeader('Cache-Control', 'public, s-maxage=43200, stale-while-revalidate=86400')
    res.status(200).send(xml)
  } catch(e) {
    res.status(500).json({ error: e.message })
  }
}
  
