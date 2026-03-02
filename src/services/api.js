import axios from 'axios'

// ── Jikan ────────────────────────────────────────────────────
const jikan = axios.create({ baseURL: 'https://api.jikan.moe/v4', timeout: 12000 })

const BLOCKED = [12, 49]
export const isBlocked = (a) =>
  [...(a.genres || []), ...(a.explicit_genres || [])].some(g => BLOCKED.includes(g.mal_id))

export const getSeasonNow      = (page = 1) =>
  jikan.get(`/seasons/now?page=${page}`).then(r => ({ ...r.data, data: (r.data.data||[]).filter(a=>!isBlocked(a)) }))

export const getTopAnime       = (filter = 'airing', page = 1) =>
  jikan.get(`/top/anime?filter=${filter}&page=${page}&limit=24&sfw=true`).then(r => ({ ...r.data, data: (r.data.data||[]).filter(a=>!isBlocked(a)) }))

export const searchAnime       = (q, page = 1) =>
  jikan.get(`/anime?q=${encodeURIComponent(q)}&page=${page}&limit=20&sfw=true`).then(r => ({ ...r.data, data: (r.data.data||[]).filter(a=>!isBlocked(a)) }))

export const getAnimeById      = (id) => jikan.get(`/anime/${id}/full`).then(r => r.data)
export const getAnimeEpisodes  = (id, page = 1) => jikan.get(`/anime/${id}/episodes?page=${page}`).then(r => r.data)
export const getGenres         = () => jikan.get('/genres/anime?filter=genres').then(r => ({ ...r.data, data: (r.data.data||[]).filter(g=>!BLOCKED.includes(g.mal_id)) }))
export const getAnimeByGenre   = (genreId, page = 1) => jikan.get(`/anime?genres=${genreId}&page=${page}&limit=20&order_by=score&sort=desc&sfw=true`).then(r => ({ ...r.data, data: (r.data.data||[]).filter(a=>!isBlocked(a)) }))
export const getSeasonUpcoming = () => jikan.get('/seasons/upcoming?limit=16').then(r => ({ ...r.data, data: (r.data.data||[]).filter(a=>!isBlocked(a)) }))

// ══════════════════════════════════════════════════════════════
// STREAMING — AnimeFire via Vercel proxy (/api/animefire)
// Domínio atual: animefire.io (confirmado 2026)
// ══════════════════════════════════════════════════════════════

const AF_PROXY = '/api/animefire'

// Chama o proxy Vercel
const afFetch = async (params) => {
  const qs = new URLSearchParams(params).toString()
  const res = await fetch(`${AF_PROXY}?${qs}`)
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `Proxy ${res.status}`)
  }
  return res.json()
}

// Converte título em slug no padrão AnimeFire
const slugify = (s) =>
  s.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')   // remove acentos
    .replace(/['":`]/g, '')                               // remove aspas, dois pontos
    .replace(/[^a-z0-9\s-]/g, ' ')                       // caracteres especiais → espaço
    .trim()
    .replace(/\s+/g, '-')                                 // espaços → hífens
    .replace(/-+/g, '-')                                  // hífens duplos → um

// Gera todas as variações de slug possíveis para um anime
// Usa título romaji (title) como prioridade — é o que AnimeFire usa nos slugs
const buildSlugs = (anime, dub = false) => {
  const titles = [
    anime.title,                    // Romaji — maior prioridade
    anime.title_english,
    anime.title_portuguese,
    ...(anime.titles || []).map(t => t.title),
  ].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i)

  const slugs = []
  for (const t of titles) {
    const base = slugify(t)
    if (!base || base.length < 2) continue
    // AnimeFire NÃO usa sufixo "-todos-os-episodios" nos slugs — só o nome
    slugs.push(base)
    if (dub) slugs.push(base + '-dublado')
  }

  return [...new Set(slugs)]
}

// Extrai termos de busca curtos (AnimeFire funciona melhor com queries simples)
const buildSearchQueries = (anime, dub = false) => {
  const queries = []

  // Romaji simples (ex: "sousou no frieren" — sem "2nd season")
  const romaji = (anime.title || '').toLowerCase()
  if (romaji) {
    // Remove sufixos de temporada da busca para achar mais resultados
    const simplified = romaji
      .replace(/\d+(st|nd|rd|th)\s*season/gi, '')
      .replace(/season\s*\d+/gi, '')
      .replace(/part\s*\d+/gi, '')
      .trim()
    queries.push(simplified || romaji)
    queries.push(romaji)
  }

  // Inglês simplificado
  if (anime.title_english) {
    const eng = anime.title_english.toLowerCase()
      .replace(/season\s*\d+/gi, '').replace(/:\s*.+$/, '').trim()
    if (eng) queries.push(eng)
  }

  const q = queries.map(q => dub ? q + ' dublado' : q)
  return [...new Set(q)].filter(Boolean)
}

// Tenta slug direto via action=info
const trySlugDirect = async (slug) => {
  try {
    const data = await afFetch({ action: 'info', slug })
    if (data.episodes?.length > 0) {
      console.log(`[AnimeFire] slug direto ✅ ${slug}`)
      return slug
    }
  } catch (e) { /* sem resultado */ }
  return null
}

// Busca slug via pesquisa
const trySearch = async (query, dub = false) => {
  try {
    const data = await afFetch({ action: 'search', q: query })
    const results = data.results || []
    if (!results.length) return null

    const match = dub
      ? results.find(r => r.slug.includes('dublado')) || (results[0]?.slug.includes('legendado') ? null : results[0])
      : results.find(r => !r.slug.includes('dublado')) || results[0]

    if (match) {
      console.log(`[AnimeFire] encontrado via busca "${query}" → ${match.slug}`)
      return match.slug
    }
  } catch (e) {
    console.warn(`[AnimeFire] busca "${query}" falhou:`, e.message)
  }
  return null
}

// Resolve o slug correto do AnimeFire para um anime do Jikan
const resolveSlug = async (anime, dub = false) => {
  // 1. Slugs diretos (mais rápido)
  const candidates = buildSlugs(anime, dub)
  for (const slug of candidates) {
    const found = await trySlugDirect(slug)
    if (found) return found
  }

  // 2. Busca por texto
  const queries = buildSearchQueries(anime, dub)
  for (const q of queries) {
    const found = await trySearch(q, dub)
    if (found) return found
  }

  throw new Error(`"${anime.title}" não encontrado no AnimeFire`)
}

// ── API pública ──────────────────────────────────────────────

/**
 * Busca sources de vídeo no AnimeFire.
 * @param {object} anime  - Objeto Jikan completo
 * @param {number} epNum  - Número do episódio (1-based)
 * @param {boolean} dub   - true para dublado, false para legendado
 * @param {object} cache  - { afSlug? } para evitar rebusca
 */
export const fetchSourcesWithFallback = async (anime, epNum, dub = false, cache = {}) => {
  const ids = { ...cache }

  if (!ids.afSlug) {
    ids.afSlug = await resolveSlug(anime, dub)
  }

  const data = await afFetch({ action: 'video', slug: ids.afSlug, ep: epNum })

  if (!data.sources?.length)
    throw new Error(`Ep ${epNum} sem sources no AnimeFire (slug: ${ids.afSlug})`)

  return {
    sources: data.sources,
    headers: { Referer: data.domain + '/' },
    provider: data.provider || '🇧🇷 AnimeFire',
    cache: ids,
  }
}

// Escolhe a melhor qualidade
export const pickBestSource = (sources = []) => {
  const order = ['fullhd', 'full hd', 'fhd', '1080', 'hd', '720', 'sd', '480', '360']
  return [...sources].sort((a, b) => {
    const ai = order.findIndex(o => (a.label || '').toLowerCase().includes(o))
    const bi = order.findIndex(o => (b.label || '').toLowerCase().includes(o))
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
  })[0] || sources[0] || null
}

// Retorna episódios disponíveis no AnimeFire
export const getAnimeFireEpisodes = async (anime, dub = false, cachedSlug = null) => {
  const slug = cachedSlug || await resolveSlug(anime, dub)
  const data = await afFetch({ action: 'info', slug })
  return { slug, episodes: data.episodes || [], title: data.title, domain: data.domain }
  }
  
