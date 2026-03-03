export default async function handler(req, res) {
  try {
    const baseUrl = "https://upanime-nine.vercel.app"

    // Pega lista de animes (pode ajustar limite)
    const response = await fetch("https://api.jikan.moe/v4/top/anime?limit=50")
    const data = await response.json()

    const animes = data.data || []

    const urls = animes.map(anime => {
      return `
        <url>
          <loc>${baseUrl}/anime/${anime.mal_id}</loc>
          <lastmod>${new Date().toISOString()}</lastmod>
          <priority>0.7</priority>
        </url>
      `
    }).join("")

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
      <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">

        <url>
          <loc>${baseUrl}/</loc>
          <priority>1.0</priority>
        </url>

        <url>
          <loc>${baseUrl}/search</loc>
          <priority>0.8</priority>
        </url>

        ${urls}

      </urlset>
    `

    res.setHeader("Content-Type", "application/xml")
    res.status(200).send(xml)

  } catch (error) {
    res.status(500).send("Erro ao gerar sitemap")
  }
}
