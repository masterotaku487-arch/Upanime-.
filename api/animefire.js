// Vercel Serverless — AnimeFire Proxy (animefire.io)
// Arquivo: /api/animefire.js
//
// ?action=info&slug={slug}         → { slug, episodes: [{ep}] }
// ?action=video&slug={slug}&ep={n} → { sources: [{url, label}] }

const AF = 'https://animefire.io'

const HEADERS = {
  'User-Agent':      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Referer':         `${AF}/`,
  'Origin':          AF,
  'Accept':          'text/html,application/xhtml+xml,*/*;q=0.9',
  'Accept-Language': 'pt-BR,pt;q=0.9',
}

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Cache-Control':                'no-store',
}

async function fetchPage(path) {
  const res = await fetch(`${AF}${path}`, { headers: HEADERS, redirect: 'follow' })
  if (!res.ok) throw new Error(`AnimeFire ${res.status}: ${path}`)
  return res.text()
}

async function handleInfo(slug) {
  const html = await fetchPage(`/animes/${slug}`)
  const epSet = new Set()
  const re = new RegExp(`/animes/${slug}/(\\d+)`, 'g')
  let m
  while ((m = re.exec(html)) !== null) epSet.add(parseInt(m[1]))
  const titleMatch = html.match(/<h1[^>]*>([^<]+)</) || html.match(/<title>([^<|]+)/)
  const title = titleMatch ? titleMatch[1].trim() : slug
  const episodes = [...epSet].sort((a, b) => a - b).map(ep => ({ ep }))
  return { slug, title, episodes, domain: AF }
}

async function handleVideo(slug, ep) {
  const html = await fetchPage(`/animes/${slug}/${ep}`)

  // Padrão 1: endpoint /video/{id} com JSON de sources
  const vidMatch = html.match(/data-video-src="\/video\/([^"]+)"/)
    || html.match(/["']\/video\/([a-zA-Z0-9_-]{6,})["']/)
  if (vidMatch) {
    const apiRes = await fetch(`${AF}/video/${vidMatch[1]}`, {
      headers: { ...HEADERS, Accept: 'application/json, */*' },
    })
    if (apiRes.ok) {
      const d = await apiRes.json()
      const raw = d.data || d.sources || []
      if (raw.length) return { sources: raw.map(s => ({ url: s.src || s.file || s.url, label: s.label || 'HD' })).filter(s => s.url), domain: AF }
    }
  }

  // Padrão 2: URLs .mp4 diretas no HTML
  const mp4s = [...html.matchAll(/https?:\/\/[^\s"'<>]+\.mp4[^\s"'<>]*/g)]
  if (mp4s.length) {
    const unique = [...new Set(mp4s.map(m => m[0]))]
    return { sources: unique.map((url, i) => ({ url, label: i === 0 ? 'HD' : 'SD' })), domain: AF }
  }

  // Padrão 3: array sources[] no script (jwplayer/videojs)
  const srcArr = html.match(/sources\s*:\s*\[([^\]]+)\]/s)
  if (srcArr) {
    const files  = [...srcArr[1].matchAll(/file\s*:\s*["']([^"']+)["']/g)]
    const labels = [...srcArr[1].matchAll(/label\s*:\s*["']([^"']+)["']/g)]
    if (files.length) return { sources: files.map((f, i) => ({ url: f[1], label: labels[i]?.[1] || 'HD' })), domain: AF }
  }

  throw new Error(`Sem fontes: ${slug} EP${ep}`)
}

export default async function handler(req, res) {
  Object.entries(CORS).forEach(([k, v]) => res.setHeader(k, v))
  if (req.method === 'OPTIONS') return res.status(200).end()
  const { action, slug, ep } = req.query
  if (!action) return res.status(200).json({ ok: true, domain: AF })
  if (!slug)   return res.status(400).json({ error: 'slug obrigatório' })
  try {
    if (action === 'info')  return res.json(await handleInfo(slug.trim()))
    if (action === 'video') return res.json(await handleVideo(slug.trim(), parseInt(ep || '1')))
    return res.status(400).json({ error: `Action inválida: ${action}` })
  } catch (e) {
    console.error(`[animefire.io] ${action} ${slug} EP${ep}:`, e.message)
    return res.status(500).json({ error: e.message })
  }
}
