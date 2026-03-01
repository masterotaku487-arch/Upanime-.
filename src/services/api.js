import axios from 'axios'

// Jikan API - dados do MyAnimeList (gratuita, sem chave)
const jikan = axios.create({
  baseURL: 'https://api.jikan.moe/v4',
  timeout: 12000,
})

const CONSUMET_URL = import.meta.env.VITE_CONSUMET_URL || 'https://api.consumet.org'
const consumet = axios.create({
  baseURL: CONSUMET_URL,
  timeout: 20000,
})

// IDs de gêneros hentai/ecchi a filtrar
const BLOCKED_GENRE_IDS = [12, 49] // 12=Hentai, 49=Erotica

export const isBlocked = (anime) => {
  const genres = [...(anime.genres || []), ...(anime.explicit_genres || [])]
  return genres.some(g => BLOCKED_GENRE_IDS.includes(g.mal_id))
}

// ─── Jikan ────────────────────────────────────────────────
export const getSeasonNow = (page = 1) =>
  jikan.get(`/seasons/now?page=${page}`).then(r => ({
    ...r.data,
    data: (r.data.data || []).filter(a => !isBlocked(a))
  }))

export const getTopAnime = (filter = 'airing', page = 1) =>
  jikan.get(`/top/anime?filter=${filter}&page=${page}&limit=24&sfw=true`).then(r => ({
    ...r.data,
    data: (r.data.data || []).filter(a => !isBlocked(a))
  }))

export const searchAnime = (q, page = 1) =>
  jikan.get(`/anime?q=${encodeURIComponent(q)}&page=${page}&limit=20&sfw=true`).then(r => ({
    ...r.data,
    data: (r.data.data || []).filter(a => !isBlocked(a))
  }))

export const getAnimeById = (id) =>
  jikan.get(`/anime/${id}/full`).then(r => r.data)

export const getAnimeEpisodes = (id, page = 1) =>
  jikan.get(`/anime/${id}/episodes?page=${page}`).then(r => r.data)

export const getAnimeCharacters = (id) =>
  jikan.get(`/anime/${id}/characters`).then(r => r.data)

export const getGenres = () =>
  jikan.get('/genres/anime?filter=genres').then(r => ({
    ...r.data,
    data: (r.data.data || []).filter(g => !BLOCKED_GENRE_IDS.includes(g.mal_id))
  }))

export const getAnimeByGenre = (genreId, page = 1) =>
  jikan.get(`/anime?genres=${genreId}&page=${page}&limit=20&order_by=score&sort=desc&sfw=true`).then(r => ({
    ...r.data,
    data: (r.data.data || []).filter(a => !isBlocked(a))
  }))

export const getSeasonUpcoming = () =>
  jikan.get('/seasons/upcoming?limit=16').then(r => ({
    ...r.data,
    data: (r.data.data || []).filter(a => !isBlocked(a))
  }))

// ─── Consumet (Streaming) ─────────────────────────────────
// Busca inteligente: tenta inglês → japonês → título alternativo
export const smartSearchConsumet = async (anime) => {
  const titles = [
    anime.title_english,
    anime.title,
    anime.title_japanese,
    ...(anime.titles || []).map(t => t.title),
  ].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i)

  for (const title of titles) {
    try {
      const res = await consumet.get(`/anime/gogoanime/${encodeURIComponent(title)}`)
      const results = res.data?.results || []
      if (results.length > 0) return { results, matchedTitle: title }
    } catch { /* tenta o próximo */ }
  }
  return { results: [], matchedTitle: null }
}

// Busca com suporte a dublado
export const searchConsumetDub = async (anime) => {
  const titles = [
    anime.title_english ? anime.title_english + ' (Dub)' : null,
    anime.title ? anime.title + ' (Dub)' : null,
    anime.title_english,
    anime.title,
  ].filter(Boolean)

  for (const title of titles) {
    try {
      const res = await consumet.get(`/anime/gogoanime/${encodeURIComponent(title)}`)
      const results = (res.data?.results || []).filter(r =>
        r.id?.toLowerCase().includes('dub') || title.includes('(Dub)')
      )
      if (results.length > 0) return { results, matchedTitle: title }
    } catch { /* tenta o próximo */ }
  }
  return { results: [], matchedTitle: null }
}

export const searchConsumet = (title) =>
  consumet.get(`/anime/gogoanime/${encodeURIComponent(title)}`).then(r => r.data)

export const getEpisodeSources = (episodeId) =>
  consumet.get(`/anime/gogoanime/watch/${encodeURIComponent(episodeId)}`).then(r => r.data)

export const getConsumetInfo = (id) =>
  consumet.get(`/anime/gogoanime/info/${id}`).then(r => r.data)
