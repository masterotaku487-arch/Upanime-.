// api/sitemap.js — Sitemap dinâmico com 100+ páginas + imagens
export default async function handler(req, res) {
  try {
    const base = 'https://upanime-nine.vercel.app'
    const today = new Date().toISOString().split('T')[0]

    // Busca 4 listas em paralelo para ter 100+ animes únicos
    const results = await Promise.allSettled([
      fetch('https://api.jikan.moe/v4/top/anime?limit=25&page=1').then(r => r.json()),
      fetch('https://api.jikan.moe/v4/top/anime?limit=25&page=2').then(r => r.json()),
      fetch('https://api.jikan.moe/v4/top/anime?filter=airing&limit=25').then(r => r.json()),
      fetch('https://api.jikan.moe/v4/top/anime?type=movie&limit=25').then(r => r.json()),
      fetch('https://api.jikan.moe/v4/top/anime?filter=bypopularity&limit=25').then(r => r.json()),
    ])

    // Deduplica por mal_id
    const seen = new Set()
    const animes = []
    for (const r of results) {
      if (r.status !== 'fulfilled') continue
      for (const a of r.value?.data || []) {
        if (!seen.has(a.mal_id)) { seen.add(a.mal_id); animes.push(a) }
      }
    }

    // URLs estáticas
    const staticPages = [
      { loc: `${base}/`,                       priority: '1.0', freq: 'daily'   },
      { loc: `${base}/search`,                 priority: '0.9', freq: 'weekly'  },
      { loc: `${base}/genres`,                 priority: '0.8', freq: 'monthly' },
      { loc: `${base}/explorar`,               priority: '0.8', freq: 'monthly' },
      { loc: `${base}/category/airing`,        priority: '0.8', freq: 'daily'   },
      { loc: `${base}/category/bypopularity`,  priority: '0.7', freq: 'weekly'  },
      { loc: `${base}/category/movie`,         priority: '0.7', freq: 'weekly'  },
      { loc: `${base}/novidades`,              priority: '0.7', freq: 'daily'   },
      { loc: `${base}/termos`,                 priority: '0.3', freq: 'yearly'  },
      { loc: `${base}/privacidade`,            priority: '0.3', freq: 'yearly'  },
    ]

    const esc = (s) => (s || '').replace(/[<>&"']/g, ' ')

    const staticXml = staticPages.map(p => `
  <url>
    <loc>${p.loc}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${p.freq}</changefreq>
    <priority>${p.priority}</priority>
  </url>`).join('')

    const animeXml = animes.map(a => {
      const img = a.images?.jpg?.large_image_url || a.images?.jpg?.image_url || ''
      const imgTag = img ? `
    <image:image>
      <image:loc>${esc(img)}</image:loc>
      <image:title>${esc(a.title_english || a.title)}</image:title>
    </image:image>` : ''
      return `
  <url>
    <loc>${base}/anime/${a.mal_id}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>${imgTag}
  </url>`
    }).join('')

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset
  xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
  xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${staticXml}
${animeXml}
</urlset>`

    res.setHeader('Content-Type', 'application/xml; charset=utf-8')
    res.setHeader('Cache-Control', 's-maxage=43200, stale-while-revalidate')
    res.status(200).send(xml)

  } catch (err) {
    res.status(500).send(`<?xml version="1.0"?><error>${err.message}</error>`)
  }
}
