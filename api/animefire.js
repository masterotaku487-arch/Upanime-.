// Vercel Serverless — proxy AnimeFire
// A API pública retorna metadados, episódios e streams MPEG-DASH.

const API = 'https://api.animefire.io'
const LEGACY_SITE = 'https://animefire.io'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Cache-Control': 'no-store',
}

const apiFetch = async (path) => {
  const response = await fetch(`${API}${path}`, {
    headers: { Accept: 'application/json', 'User-Agent': 'UpAnime/1.0' },
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload?.message || `AnimeFire API ${response.status}`)
  return payload
}

const legacyFetch = async (path) => {
  const response = await fetch(`${LEGACY_SITE}${path}`, {
    headers: {
      Accept: 'text/html,application/xhtml+xml,*/*;q=0.9',
      'User-Agent': 'Mozilla/5.0 (compatible; UpAnime/1.0)',
      Referer: `${LEGACY_SITE}/`,
    },
  })
  if (!response.ok) throw new Error(`AnimeFire ${response.status}: ${path}`)
  return response.text()
}

async function handleSearch(q) {
  if (!q?.trim()) throw new Error('q obrigatório')
  return apiFetch(`/animes/pesquisar?q=${encodeURIComponent(q.trim())}`)
}

async function handleAnime(id) {
  if (!id?.trim()) throw new Error('id obrigatório')
  return apiFetch(`/anime/${encodeURIComponent(id.trim())}`)
}

async function handleEpisode(id) {
  if (!id?.trim()) throw new Error('id obrigatório')
  return apiFetch(`/episode/${encodeURIComponent(id.trim())}`)
}

// Compatibilidade com a integração anterior baseada em slug.
async function handleInfo(slug) {
  const html = await legacyFetch(`/animes/${slug}`)
  const episodes = [...html.matchAll(new RegExp(`/animes/${slug}/(\\d+)`, 'g'))]
    .map(match => Number(match[1]))
    .filter((ep, index, all) => all.indexOf(ep) === index)
    .sort((a, b) => a - b)
    .map(ep => ({ ep }))
  const title = html.match(/<h1[^>]*>([^<]+)</)?.[1]?.trim() || slug
  return { slug, title, episodes }
}

async function handleVideo(slug, ep) {
  const html = await legacyFetch(`/animes/${slug}/${ep}`)
  const urls = [...html.matchAll(/https?:\/\/[^\s"'<>]+\.mp4[^\s"'<>]*/g)]
    .map(match => match[0])
  return { sources: [...new Set(urls)].map((url, index) => ({ url, label: index ? 'SD' : 'HD' })) }
}

export default async function handler(req, res) {
  Object.entries(CORS).forEach(([key, value]) => res.setHeader(key, value))
  if (req.method === 'OPTIONS') return res.status(200).end()

  const { action, q, id, slug, ep } = req.query || {}
  try {
    if (!action) return res.status(200).json({ ok: true, api: API })
    if (action === 'search') return res.status(200).json(await handleSearch(q))
    if (action === 'anime') return res.status(200).json(await handleAnime(id))
    if (action === 'episode') return res.status(200).json(await handleEpisode(id))
    if (action === 'info') return res.status(200).json(await handleInfo(slug))
    if (action === 'video') return res.status(200).json(await handleVideo(slug, Number(ep || 1)))
    return res.status(400).json({ error: `Ação inválida: ${action}` })
  } catch (error) {
    console.error('[animefire]', action, error.message)
    return res.status(502).json({ error: error.message })
  }
}
