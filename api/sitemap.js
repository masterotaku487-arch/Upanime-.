// api/sitemap.js — Sitemap otimizado para não dar timeout no Vercel
export default async function handler(req, res) {
  try {
    const base  = 'https://upanime-nine.vercel.app'
    const today = new Date().toISOString().split('T')[0]
    const PROXY = 'https://img-proxy.masterotaku487.workers.dev'
    const proxyImg = (url) => url ? `${PROXY}/?url=${encodeURIComponent(url)}` : ''
    const esc   = (s) => (s||'').replace(/[<>&"']/g, c =>
      ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&apos;'}[c]))

    // Busca 3 páginas em paralelo
    const [r1, r2, r3] = await Promise.allSettled([
      fetch('https://api.jikan.moe/v4/top/anime?limit=25&page=1&filter=bypopularity').then(r=>r.json()),
      fetch('https://api.jikan.moe/v4/top/anime?limit=25&page=2&filter=bypopularity').then(r=>r.json()),
      fetch('https://api.jikan.moe/v4/seasons/now?limit=25').then(r=>r.json()),
    ])

    // Deduplica
    const seen = new Set()
    const animes = []
    for (const r of [r1, r2, r3]) {
      if (r.status !== 'fulfilled') continue
      for (const a of r.value?.data || []) {
        if (!seen.has(a.mal_id)) { seen.add(a.mal_id); animes.push(a) }
      }
    }

    // Páginas estáticas
    const staticPages = [
      { loc: `${base}/`,                      priority: '1.0', freq: 'daily'   },
      { loc: `${base}/search`,                priority: '0.9', freq: 'weekly'  },
      { loc: `${base}/explorar`,              priority: '0.8', freq: 'daily'   },
      { loc: `${base}/genres`,                priority: '0.8', freq: 'monthly' },
      { loc: `${base}/category/airing`,       priority: '0.8', freq: 'daily'   },
      { loc: `${base}/category/bypopularity`, priority: '0.7', freq: 'weekly'  },
      { loc: `${base}/category/movie`,        priority: '0.7', freq: 'weekly'  },
      { loc: `${base}/novidades`,             priority: '0.7', freq: 'daily'   },
      { loc: `${base}/sobre`,                 priority: '0.4', freq: 'monthly' },
    ]

    const staticXml = staticPages.map(p => `
  <url>
    <loc>${p.loc}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${p.freq}</changefreq>
    <priority>${p.priority}</priority>
  </url>`).join('')

    // Animes + episódios
    const animeXml = animes.map(a => {
      const img    = a.images?.jpg?.large_image_url || a.images?.jpg?.image_url || ''
      const title  = esc(a.title_english || a.title)
      const maxEps = Math.min(a.episodes || 13, 24)

      const imgTag = img ? `
    <image:image>
      <image:loc>${esc(proxyImg(img))}</image:loc>
      <image:title>${title}</image:title>
      <image:caption>Assista ${title} online grátis no Up Anime+</image:caption>
    </image:image>` : ''

      const animePage = `
  <url>
    <loc>${base}/anime/${a.mal_id}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>${imgTag}
  </url>`

      const epPages = Array.from({length: maxEps}, (_,i) => i+1).map(ep => `
  <url>
    <loc>${base}/watch/${a.mal_id}?ep=${ep}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>${img ? `
    <image:image>
      <image:loc>${esc(proxyImg(img))}</image:loc>
      <image:title>${title} Episódio ${ep}</image:title>
    </image:image>` : ''}
  </url>`).join('')

      return animePage + epPages
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
    res.status(500).send(`<?xml version="1.0"?><e>${err.message}</e>`)
  }
}
