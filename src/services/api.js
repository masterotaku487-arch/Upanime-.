import axios from 'axios'

// ── Clientes HTTP ─────────────────────────────────────────
const jikan = axios.create({ baseURL: 'https://api.jikan.moe/v4', timeout: 12000 })

const CONSUMET_URL = import.meta.env.VITE_CONSUMET_URL || 'https://api.consumet.org'
const consumet = axios.create({ baseURL: CONSUMET_URL, timeout: 20000 })

// Gêneros bloqueados
const BLOCKED = [12, 49]
export const isBlocked = (a) =>
  [...(a.genres || []), ...(a.explicit_genres || [])].some(g => BLOCKED.includes(g.mal_id))

// ── Jikan ─────────────────────────────────────────────────
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
// STREAMING — SISTEMA DE FALLBACK EM CASCATA
//
// FLUXO:
//   MAL ID (ex: 58505) — vem do Jikan
//       ↓
//   resolveGogoanimeId(anime) — busca slug no Gogoanime
//       ↓ ex: "sousou-no-frieren"
//   fetchEpisodeSources(slug, epNum)
//       ↓ se falhar…
//   tryZoro(anime, epNum) — Zoro/Aniwatch como fallback
//       ↓ se falhar…
//   tryAnimePahe(anime, epNum) — AnimePahe como fallback
//       ↓ se falhar…
//   null → UI mostra botão externo
// ══════════════════════════════════════════════════════════

// Gera lista de títulos para tentar (do mais específico ao menos)
const getTitles = (anime) =>
  [
    anime.title_english,
    anime.title,
    anime.title_japanese,
    ...(anime.titles || []).map(t => t.title),
  ]
  .filter(Boolean)
  .filter((v, i, a) => a.indexOf(v) === i)

// ── PROVEDOR 1: Gogoanime ─────────────────────────────────
/**
 * Traduz títulos do Jikan para o slug do Gogoanime.
 * Testa inglês → japonês → alternativo até achar.
 * @returns {string|null} ex: "sousou-no-frieren"
 */
export const resolveGogoanimeId = async (anime, dub = false) => {
  const titles = getTitles(anime)

  for (const title of titles) {
    const query = dub ? `${title} (Dub)` : title
    try {
      const res = await consumet.get(`/anime/gogoanime/${encodeURIComponent(query)}`)
      const results = res.data?.results || []
      if (!results.length) continue

      if (dub) {
        const found = results.find(r => r.id?.toLowerCase().includes('dub'))
        if (found) { console.log(`[Gogoanime] Dub: ${found.id}`); return found.id }
        continue
      }

      const found = results.find(r => !r.id?.toLowerCase().includes('dub')) || results[0]
      console.log(`[Gogoanime] Sub: ${found.id} via "${query}"`)
      return found.id
    } catch (e) {
      console.warn(`[Gogoanime] Falhou "${query}":`, e.message)
    }
  }
  return null
}

/**
 * Busca fontes de vídeo no Gogoanime.
 * @param {string} gogoanimeId ex: "sousou-no-frieren"
 * @param {number} epNum
 */
export const fetchEpisodeSources = async (gogoanimeId, epNum) => {
  const epId = `${gogoanimeId}-episode-${epNum}`
  console.log(`[Gogoanime] watch/${epId}`)
  const res = await consumet.get(`/anime/gogoanime/watch/${encodeURIComponent(epId)}`)
  if (!res.data?.sources?.length) throw new Error('Sem fontes')
  return res.data
}

// ── PROVEDOR 2: Zoro / Aniwatch ───────────────────────────
const resolveZoroId = async (anime) => {
  const titles = getTitles(anime)
  for (const title of titles) {
    try {
      const res = await consumet.get(`/anime/zoro/${encodeURIComponent(title)}`)
      const match = res.data?.results?.[0]
      if (match) { console.log(`[Zoro] ${match.id} via "${title}"`); return match.id }
    } catch (e) {
      console.warn(`[Zoro] Falhou "${title}":`, e.message)
    }
  }
  return null
}

const fetchZoroSources = async (zoroId, epNum) => {
  // Primeiro pega lista de episódios do Zoro para achar o ID do ep
  const info = await consumet.get(`/anime/zoro/info?id=${encodeURIComponent(zoroId)}`)
  const epList = info.data?.episodes || []
  const ep = epList.find(e => e.number === epNum) || epList[epNum - 1]
  if (!ep) throw new Error(`Ep ${epNum} não encontrado no Zoro`)

  console.log(`[Zoro] watch/${ep.id}`)
  const res = await consumet.get(`/anime/zoro/watch?episodeId=${encodeURIComponent(ep.id)}`)
  if (!res.data?.sources?.length) throw new Error('Sem fontes Zoro')
  return res.data
}

// ── PROVEDOR 3: AnimePahe ─────────────────────────────────
const resolveAnimePaheId = async (anime) => {
  const titles = getTitles(anime)
  for (const title of titles) {
    try {
      const res = await consumet.get(`/anime/animepahe/${encodeURIComponent(title)}`)
      const match = res.data?.results?.[0]
      if (match) { console.log(`[AnimePahe] ${match.id} via "${title}"`); return match.id }
    } catch (e) {
      console.warn(`[AnimePahe] Falhou "${title}":`, e.message)
    }
  }
  return null
}

const fetchAnimePaheSources = async (paheId, epNum) => {
  const info = await consumet.get(`/anime/animepahe/info/${encodeURIComponent(paheId)}`)
  const epList = info.data?.episodes || []
  const ep = epList.find(e => e.number === epNum) || epList[epNum - 1]
  if (!ep) throw new Error(`Ep ${epNum} não encontrado no AnimePahe`)

  console.log(`[AnimePahe] watch/${ep.id}`)
  const res = await consumet.get(`/anime/animepahe/watch?episodeId=${encodeURIComponent(ep.id)}`)
  if (!res.data?.sources?.length) throw new Error('Sem fontes AnimePahe')
  return res.data
}

// ── ORQUESTRADOR PRINCIPAL ────────────────────────────────
/**
 * Tenta buscar fontes de vídeo em cascata:
 *   1. Gogoanime → 2. Zoro → 3. AnimePahe → null
 *
 * @param {object} anime - Objeto completo do Jikan
 * @param {number} epNum - Número do episódio
 * @param {boolean} dub  - Se true, busca dublado
 * @param {object} cache - { gogoanimeId, zoroId, paheId } para evitar re-busca
 * @returns {{ sources, headers, provider, ids }}
 */
export const fetchSourcesWithFallback = async (anime, epNum, dub = false, cache = {}) => {
  const ids = { ...cache }

  // ── Tentativa 1: Gogoanime ──
  try {
    if (!ids.gogoanimeId) ids.gogoanimeId = await resolveGogoanimeId(anime, dub)
    if (ids.gogoanimeId) {
      const data = await fetchEpisodeSources(ids.gogoanimeId, epNum)
      return { ...data, provider: 'Gogoanime', ids }
    }
  } catch (e) {
    console.warn('[Fallback] Gogoanime falhou:', e.message)
  }

  // ── Tentativa 2: Zoro ──
  try {
    if (!ids.zoroId) ids.zoroId = await resolveZoroId(anime)
    if (ids.zoroId) {
      const data = await fetchZoroSources(ids.zoroId, epNum)
      return { ...data, provider: 'Zoro', ids }
    }
  } catch (e) {
    console.warn('[Fallback] Zoro falhou:', e.message)
  }

  // ── Tentativa 3: AnimePahe ──
  try {
    if (!ids.paheId) ids.paheId = await resolveAnimePaheId(anime)
    if (ids.paheId) {
      const data = await fetchAnimePaheSources(ids.paheId, epNum)
      return { ...data, provider: 'AnimePahe', ids }
    }
  } catch (e) {
    console.warn('[Fallback] AnimePahe falhou:', e.message)
  }

  throw new Error('Nenhum provedor encontrou fontes para este episódio.')
}

// Escolhe melhor qualidade disponível
export const pickBestSource = (sources = []) => {
  const priority = ['1080p', '720p', '480p', '360p', 'default']
  for (const q of priority) {
    const found = sources.find(s => s.quality === q)
    if (found) return found
  }
  return sources[0] || null
  }
        
