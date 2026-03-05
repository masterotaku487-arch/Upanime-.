import axios from 'axios'

// ── Jikan ─────────────────────────────────────────────────────
const jikan = axios.create({ baseURL: 'https://api.jikan.moe/v4', timeout: 12000 })

const BLOCKED = [12, 49]
export const isBlocked = (a) =>
  [...(a.genres || []), ...(a.explicit_genres || [])].some(g => BLOCKED.includes(g.mal_id))

export const getSeasonNow      = (page = 1) =>
  jikan.get(`/seasons/now?page=${page}`).then(r => ({ ...r.data, data: (r.data.data||[]).filter(a=>!isBlocked(a)) }))
export const getTopAnime       = (filter = 'airing', page = 1) =>
  jikan.get(`/top/anime?filter=${filter}&page=${page}&limit=24`).then(r => ({ ...r.data, data: (r.data.data||[]).filter(a=>!isBlocked(a)) }))
export const searchAnime       = (q, page = 1) =>
  jikan.get(`/anime?q=${encodeURIComponent(q)}&page=${page}&limit=20`).then(r => ({ ...r.data, data: (r.data.data||[]).filter(a=>!isBlocked(a)) }))
export const getAnimeById      = (id) => jikan.get(`/anime/${id}/full`).then(r => r.data)
export const getAnimeEpisodes  = (id, page = 1) => jikan.get(`/anime/${id}/episodes?page=${page}`).then(r => r.data)
export const getGenres         = () => jikan.get('/genres/anime?filter=genres').then(r => ({ ...r.data, data: (r.data.data||[]).filter(g=>!BLOCKED.includes(g.mal_id)) }))
export const getAnimeByGenre   = (genreId, page = 1) => jikan.get(`/anime?genres=${genreId}&page=${page}&limit=20&order_by=score&sort=desc`).then(r => ({ ...r.data, data: (r.data.data||[]).filter(a=>!isBlocked(a)) }))
export const getSeasonUpcoming = () => jikan.get('/seasons/upcoming?limit=16').then(r => ({ ...r.data, data: (r.data.data||[]).filter(a=>!isBlocked(a)) }))

// ══════════════════════════════════════════════════════════════
// STREAMING — AnimeFire via Vercel proxy (/api/animefire)
//
// Documentação AnimeFire:
//   Página anime:    /animes/<slug>
//   Página ep:       /animes/<slug>/<numero-ep>
//   JSON vídeo:      /video/<slug>/<numero-ep>
//
// Slug = slugify(anime.title romaji), sem sufixo de temporada
//   "Sousou no Frieren 2nd Season" → "sousou-no-frieren"
// ══════════════════════════════════════════════════════════════

const AF_PROXY = '/api/animefire'

const afFetch = async (params) => {
  const qs = new URLSearchParams(params).toString()
  const res = await fetch(`${AF_PROXY}?${qs}`)
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `Proxy ${res.status}`)
  }
  return res.json()
}

// Converte string em slug
const slugify = (s) =>
  s.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/['"`]/g, '').replace(/:/g, '')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .trim().replace(/\s+/g, '-').replace(/-+/g, '-')

// Remove sufixos de temporada ("2nd Season", "Season 7", "The Final Season", etc.)
const stripSeason = (s) =>
  s.replace(/\s*[-–:]\s*(season|parte?|part|cour)\s*\d*/gi, '')
   .replace(/\s+\d+(st|nd|rd|th)\s*(season|cour)/gi, '')
   .replace(/\s+(the\s+)?(final|last|new)\s+season/gi, '')
   .replace(/\s+(season|parte?|part)\s*\d*/gi, '')
   .replace(/\s+\d+$/g, '')
   .trim()

// Remove subtítulo após ':' ou '–' (ex: ": The Final Season" → "")
const stripSubtitle = (s) => s.replace(/\s*[:–]\s*.+$/, '').trim()

// Gera candidatos de slug em ordem de probabilidade
// AnimeFire usa slug curto sem temporada: "sousou-no-frieren"
const buildSlugCandidates = (anime, dub = false) => {
  const titles = [
    anime.title,              // Romaji — é o que AnimeFire usa nos slugs
    anime.title_english,
    anime.title_portuguese,
    ...(anime.titles || []).map(t => t.title),
  ].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i)

  const variants = new Set()
  for (const t of titles) {
    const noSeason   = stripSeason(t)
    const noSubtitle = stripSubtitle(noSeason)
    for (const v of [noSeason, noSubtitle, t]) {
      const s = slugify(v)
      if (s && s.length > 1) variants.add(s)
    }
  }

  const list = [...variants]
  if (!dub) return list
  return [...list.map(s => s + '-dublado'), ...list]
}

// Testa se um slug existe no AnimeFire
const probeSlug = async (slug) => {
  try {
    const data = await afFetch({ action: 'info', slug })
    // Considera válido se retornou episódios OU se o título veio (page existe)
    if (data.episodes?.length > 0 || data.title) {
      console.log(`[AnimeFire] ✅ ${slug}`)
      return slug
    }
  } catch { /* slug inválido, tenta próximo */ }
  return null
}

// Resolve slug testando candidatos em sequência
const resolveSlug = async (anime, dub = false) => {
  const candidates = buildSlugCandidates(anime, dub)
  console.log(`[AnimeFire] testando slugs:`, candidates.join(', '))

  for (const slug of candidates) {
    const found = await probeSlug(slug)
    if (found) return found
  }

  throw new Error(
    `"${anime.title}" não encontrado no AnimeFire. Slugs tentados: ${candidates.slice(0,3).join(', ')}`
  )
}

// ── API pública ──────────────────────────────────────────────

/**
 * Busca sources de vídeo no AnimeFire.
 * @param {object} anime  - Objeto Jikan completo
 * @param {number} epNum  - Número do episódio (1-based)
 * @param {boolean} dub   - true = dublado PT-BR
 * @param {object} cache  - { afSlug? } para evitar re-resolução
 */
export const fetchSourcesWithFallback = async (anime, epNum, dub = false, cache = {}) => {
  const ids = { ...cache }

  if (!ids.afSlug) {
    ids.afSlug = await resolveSlug(anime, dub)
  }

  const data = await afFetch({ action: 'video', slug: ids.afSlug, ep: epNum })

  if (!data.sources?.length)
    throw new Error(`Ep ${epNum} sem sources (slug: ${ids.afSlug})`)

  return {
    sources: data.sources,
    headers: { Referer: data.domain + '/' },
    provider: data.provider || '🇧🇷 AnimeFire',
    cache: ids,
  }
}

// Escolhe a melhor qualidade disponível
export const pickBestSource = (sources = []) => {
  const order = ['fullhd', 'full hd', 'fhd', '1080', 'hd', '720', 'sd', '480', '360']
  return [...sources].sort((a, b) => {
    const ai = order.findIndex(o => (a.label || '').toLowerCase().includes(o))
    const bi = order.findIndex(o => (b.label || '').toLowerCase().includes(o))
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
  })[0] || sources[0] || null
}

// Retorna episódios + slug resolvido (para cache no componente)
export const getAnimeFireEpisodes = async (anime, dub = false, cachedSlug = null) => {
  const slug = cachedSlug || await resolveSlug(anime, dub)
  const data = await afFetch({ action: 'info', slug })
  return { slug, episodes: data.episodes || [], title: data.title, domain: data.domain }
}

