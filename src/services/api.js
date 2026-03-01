import axios from 'axios'

// ── Clientes HTTP ─────────────────────────────────────────
const jikan = axios.create({ baseURL: 'https://api.jikan.moe/v4', timeout: 12000 })

const CONSUMET_URL = import.meta.env.VITE_CONSUMET_URL || 'https://api.consumet.org'
const api = axios.create({ baseURL: CONSUMET_URL, timeout: 25000 })

// Gêneros bloqueados (hentai/erotica)
const BLOCKED = [12, 49]
export const isBlocked = (a) =>
  [...(a.genres || []), ...(a.explicit_genres || [])].some(g => BLOCKED.includes(g.mal_id))

// ── Jikan (dados) ─────────────────────────────────────────
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
// STREAMING — NOTA IMPORTANTE SOBRE PROVEDORES
//
// ❌ Gogoanime: QUEBRADO (mudou para anitaku.io em 2024)
// ✅ Zoro/Aniwatch: FUNCIONANDO (provedor principal)
// ✅ AnimePahe: FUNCIONANDO (fallback)
// ✅ meta/anilist: FUNCIONANDO (usa Zoro internamente)
//
// FLUXO:
//   anime (Jikan) → busca títulos no Zoro → ID do Zoro
//   → episódios do Zoro → fontes de vídeo ✅
// ══════════════════════════════════════════════════════════

const getTitles = (anime) =>
  [
    anime.title_english,
    anime.title,
    ...(anime.titles || []).map(t => t.title),
    anime.title_japanese,
  ].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i)

// ── PROVEDOR 1: Zoro / Aniwatch (Principal) ───────────────
const zoroSearch = async (anime) => {
  const titles = getTitles(anime)
  for (const title of titles) {
    try {
      const res = await api.get(`/anime/zoro/${encodeURIComponent(title)}`)
      const results = res.data?.results || []
      if (!results.length) continue
      const match = results[0]
      console.log(`[Zoro] encontrado: "${match.id}" via "${title}"`)
      return match.id
    } catch (e) {
      console.warn(`[Zoro] falhou "${title}":`, e.message)
    }
  }
  return null
}

const zoroEpisodes = async (zoroId) => {
  const res = await api.get(`/anime/zoro/info?id=${encodeURIComponent(zoroId)}`)
  return res.data?.episodes || []
}

const zoroWatch = async (zoroId, epNum) => {
  const eps = await zoroEpisodes(zoroId)
  const ep = eps.find(e => e.number === epNum) || eps[epNum - 1]
  if (!ep) throw new Error(`Ep ${epNum} não encontrado no Zoro`)
  console.log(`[Zoro] watch episodeId: ${ep.id}`)
  const res = await api.get(`/anime/zoro/watch?episodeId=${encodeURIComponent(ep.id)}`)
  if (!res.data?.sources?.length) throw new Error('Sem fontes no Zoro')
  return { ...res.data, provider: 'Zoro' }
}

// ── PROVEDOR 2: meta/anilist (Fallback via AniList ID) ────
const anilistSearch = async (anime) => {
  const titles = getTitles(anime)
  for (const title of titles) {
    try {
      const res = await api.get(`/meta/anilist/${encodeURIComponent(title)}`)
      const results = res.data?.results || []
      if (!results.length) continue
      const match = results[0]
      console.log(`[AniList] encontrado: "${match.id}" via "${title}"`)
      return match.id
    } catch (e) {
      console.warn(`[AniList] falhou "${title}":`, e.message)
    }
  }
  return null
}

const anilistWatch = async (anilistId, epNum) => {
  const res = await api.get(`/meta/anilist/info/${anilistId}?provider=zoro`)
  const eps = res.data?.episodes || []
  const ep = eps.find(e => e.number === epNum) || eps[epNum - 1]
  if (!ep) throw new Error(`Ep ${epNum} não encontrado no AniList/Zoro`)
  console.log(`[AniList] watch episodeId: ${ep.id}`)
  const src = await api.get(`/meta/anilist/watch/${encodeURIComponent(ep.id)}?provider=zoro`)
  if (!src.data?.sources?.length) throw new Error('Sem fontes no AniList/Zoro')
  return { ...src.data, provider: 'AniList+Zoro' }
}

// ── PROVEDOR 3: AnimePahe (Último recurso) ────────────────
const paheSearch = async (anime) => {
  const titles = getTitles(anime)
  for (const title of titles) {
    try {
      const res = await api.get(`/anime/animepahe/${encodeURIComponent(title)}`)
      const results = res.data?.results || []
      if (!results.length) continue
      const match = results[0]
      console.log(`[AnimePahe] encontrado: "${match.id}" via "${title}"`)
      return match.id
    } catch (e) {
      console.warn(`[AnimePahe] falhou "${title}":`, e.message)
    }
  }
  return null
}

const paheWatch = async (paheId, epNum) => {
  const info = await api.get(`/anime/animepahe/info/${encodeURIComponent(paheId)}`)
  const eps = info.data?.episodes || []
  const ep = eps.find(e => e.number === epNum) || eps[epNum - 1]
  if (!ep) throw new Error(`Ep ${epNum} não encontrado no AnimePahe`)
  const res = await api.get(`/anime/animepahe/watch?episodeId=${encodeURIComponent(ep.id)}`)
  if (!res.data?.sources?.length) throw new Error('Sem fontes no AnimePahe')
  return { ...res.data, provider: 'AnimePahe' }
}

// ── ORQUESTRADOR PRINCIPAL ────────────────────────────────
/**
 * Tenta buscar vídeo em cascata:
 *   1. Zoro  →  2. AniList+Zoro  →  3. AnimePahe  →  erro
 *
 * @param {object} anime   - Objeto completo do Jikan (com títulos)
 * @param {number} epNum   - Número do episódio
 * @param {object} cache   - IDs já resolvidos { zoroId, anilistId, paheId }
 * @returns {{ sources, headers, provider, cache }}
 */
export const fetchSourcesWithFallback = async (anime, epNum, cache = {}) => {
  const ids = { ...cache }

  // 1️⃣ Zoro
  try {
    if (!ids.zoroId) ids.zoroId = await zoroSearch(anime)
    if (ids.zoroId) {
      const data = await zoroWatch(ids.zoroId, epNum)
      return { ...data, cache: ids }
    }
  } catch (e) { console.warn('[Fallback] Zoro:', e.message) }

  // 2️⃣ AniList + Zoro
  try {
    if (!ids.anilistId) ids.anilistId = await anilistSearch(anime)
    if (ids.anilistId) {
      const data = await anilistWatch(ids.anilistId, epNum)
      return { ...data, cache: ids }
    }
  } catch (e) { console.warn('[Fallback] AniList:', e.message) }

  // 3️⃣ AnimePahe
  try {
    if (!ids.paheId) ids.paheId = await paheSearch(anime)
    if (ids.paheId) {
      const data = await paheWatch(ids.paheId, epNum)
      return { ...data, cache: ids }
    }
  } catch (e) { console.warn('[Fallback] AnimePahe:', e.message) }

  throw new Error('Todos os provedores falharam. Verifique se o Consumet API está online.')
}

// Escolhe melhor qualidade disponível
export const pickBestSource = (sources = []) => {
  for (const q of ['1080p', '720p', '480p', '360p', 'default']) {
    const found = sources.find(s => s.quality === q)
    if (found) return found
  }
  return sources[0] || null
    }
  
