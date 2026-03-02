import axios from 'axios'

// ── Clientes HTTP ─────────────────────────────────────────
const jikan = axios.create({ baseURL: 'https://api.jikan.moe/v4', timeout: 12000 })

// Gêneros bloqueados (hentai/erotica)
const BLOCKED = [12, 49]
export const isBlocked = (a) =>
  [...(a.genres || []), ...(a.explicit_genres || [])].some(g => BLOCKED.includes(g.mal_id))

// ── Jikan (dados do anime) ────────────────────────────────
export const getSeasonNow = (page = 1) =>
  jikan.get(`/seasons/now?page=${page}`).then(r => ({ ...r.data, data: (r.data.data||[]).filter(a=>!isBlocked(a)) }))

export const getTopAnime = (filter = 'airing', page = 1) =>
  jikan.get(`/top/anime?filter=${filter}&page=${page}&limit=24&sfw=true`).then(r => ({ ...r.data, data: (r.data.data||[]).filter(a=>!isBlocked(a)) }))

export const searchAnime = (q, page = 1) =>
  jikan.get(`/anime?q=${encodeURIComponent(q)}&page=${page}&limit=20&sfw=true`).then(r => ({ ...r.data, data: (r.data.data||[]).filter(a=>!isBlocked(a)) }))

export const getAnimeById = (id) =>
  jikan.get(`/anime/${id}/full`).then(r => r.data)

export const getAnimeEpisodes = (id, page = 1) =>
  jikan.get(`/anime/${id}/episodes?page=${page}`).then(r => r.data)

export const getGenres = () =>
  jikan.get('/genres/anime?filter=genres').then(r => ({ ...r.data, data: (r.data.data||[]).filter(g=>!BLOCKED.includes(g.mal_id)) }))

export const getAnimeByGenre = (genreId, page = 1) =>
  jikan.get(`/anime?genres=${genreId}&page=${page}&limit=20&order_by=score&sort=desc&sfw=true`).then(r => ({ ...r.data, data: (r.data.data||[]).filter(a=>!isBlocked(a)) }))

export const getSeasonUpcoming = () =>
  jikan.get('/seasons/upcoming?limit=16').then(r => ({ ...r.data, data: (r.data.data||[]).filter(a=>!isBlocked(a)) }))

// ══════════════════════════════════════════════════════════
// STREAMING — AnimeFire via Vercel Proxy
//
// Fluxo:
//   anime (Jikan) → buildSlugs() → busca no AnimeFire
//   → slug correto → MP4 direto ✅
//
// Proxy: /api/animefire (sem Render, sem Consumet)
// ══════════════════════════════════════════════════════════

const AF_PROXY = '/api/animefire'

// Busca no proxy local (Vercel function)
const afFetch = async (params) => {
  const qs = new URLSearchParams(params).toString()
  const res = await fetch(`${AF_PROXY}?${qs}`)
  if (!res.ok) throw new Error(`AnimeFire proxy ${res.status}: ${res.statusText}`)
  return res.json()
}

// Gera variações de slug a partir do título do anime (Jikan)
const buildSlugs = (anime, dub = false) => {
  const base = (anime.title_portuguese || anime.title_english || anime.title || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')  // remove acentos
    .replace(/[^a-z0-9\s-]/g, '')                       // só letras, números, espaços, hífens
    .trim()
    .replace(/\s+/g, '-')

  const suffix = dub ? 'dublado-todos-os-episodios' : 'todos-os-episodios'

  return [
    `${base}-${suffix}`,
    `${base}-${dub ? 'dublado' : 'legendado'}-todos-os-episodios`,
    `${base}`,
    // Título japonês romanizado como fallback
    ...(anime.title ? [
      anime.title.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim().replace(/\s+/g, '-') + `-${suffix}`
    ] : []),
  ].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i)
}

// Encontra o slug correto no AnimeFire (busca + match)
const findSlug = async (anime, dub = false) => {
  const titles = [
    anime.title_portuguese,
    anime.title_english,
    anime.title,
    ...(anime.titles || []).map(t => t.title),
  ].filter(Boolean)

  // 1. Tentar slugs diretos (info)
  const candidates = buildSlugs(anime, dub)
  for (const slug of candidates) {
    try {
      const data = await afFetch({ action: 'info', slug })
      if (data.episodes?.length > 0) {
        console.log(`[AnimeFire] slug direto: ${slug}`)
        return slug
      }
    } catch (e) { /* continua */ }
  }

  // 2. Buscar por título
  for (const title of titles.slice(0, 3)) {
    try {
      const searchQ = dub ? `${title} dublado` : title
      const data = await afFetch({ action: 'search', q: searchQ })
      const results = data.results || []
      if (results.length > 0) {
        // Pegar o primeiro resultado que contém "dublado" se dub=true
        const match = dub
          ? results.find(r => r.slug.includes('dublado')) || results[0]
          : results.find(r => !r.slug.includes('dublado')) || results[0]
        console.log(`[AnimeFire] encontrado via busca: ${match.slug}`)
        return match.slug
      }
    } catch (e) {
      console.warn(`[AnimeFire] busca falhou para "${title}":`, e.message)
    }
  }

  throw new Error(`Anime não encontrado no AnimeFire: ${anime.title}`)
}

// ── Funções públicas de streaming ─────────────────────────

/**
 * Busca episódio no AnimeFire.
 * @param {object} anime  - Objeto Jikan com title, title_english, etc.
 * @param {number} epNum  - Número do episódio (1-based)
 * @param {boolean} dub   - true para dublado PT-BR, false para legendado
 * @param {object} cache  - { afSlug? } para evitar rebusca
 * @returns {{ sources, provider, cache }}
 */
export const fetchSourcesWithFallback = async (anime, epNum, dub = false, cache = {}) => {
  const ids = { ...cache }

  try {
    // Resolver slug se não temos cache
    if (!ids.afSlug) {
      ids.afSlug = await findSlug(anime, dub)
    }

    const data = await afFetch({ action: 'video', slug: ids.afSlug, ep: epNum })

    if (!data.sources?.length) throw new Error('Nenhuma source retornada')

    return {
      sources: data.sources,
      headers: { Referer: data.domain || 'https://animefire.plus/' },
      provider: data.provider || '🇧🇷 AnimeFire',
      cache: ids,
    }
  } catch (e) {
    console.error('[fetchSources]', e.message)
    throw new Error(`AnimeFire: ${e.message}`)
  }
}

// Escolhe a melhor qualidade disponível
export const pickBestSource = (sources = []) => {
  const order = ['fullhd', 'full hd', 'fhd', '1080', 'hd', '720', 'sd', '480', '360', 'auto']
  const sorted = [...sources].sort((a, b) => {
    const ai = order.findIndex(o => (a.label || a.quality || '').toLowerCase().includes(o))
    const bi = order.findIndex(o => (b.label || b.quality || '').toLowerCase().includes(o))
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
  })
  return sorted[0] || sources[0] || null
}

// Retorna lista de episódios disponíveis para um anime
export const getAnimeFireEpisodes = async (anime, dub = false) => {
  const slug = await findSlug(anime, dub)
  const data = await afFetch({ action: 'info', slug })
  return { slug, episodes: data.episodes || [], title: data.title }
}
