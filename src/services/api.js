import axios from 'axios'

// Jikan API - MyAnimeList data (free, no key needed)
const jikan = axios.create({
  baseURL: 'https://api.jikan.moe/v4',
  timeout: 10000,
})

// Consumet API - for streaming sources
// Deploy your own at: https://github.com/consumet/api.consumet.org
// And add to .env: VITE_CONSUMET_URL=https://your-consumet.onrender.com
const CONSUMET_URL = import.meta.env.VITE_CONSUMET_URL || 'https://api.consumet.org'

const consumet = axios.create({
  baseURL: CONSUMET_URL,
  timeout: 15000,
})

// ─── Jikan ───────────────────────────────────────────────
export const getSeasonNow = (page = 1) =>
  jikan.get(`/seasons/now?page=${page}`).then(r => r.data)

export const getTopAnime = (filter = 'airing', page = 1) =>
  jikan.get(`/top/anime?filter=${filter}&page=${page}&limit=20`).then(r => r.data)

export const searchAnime = (q, page = 1) =>
  jikan.get(`/anime?q=${encodeURIComponent(q)}&page=${page}&limit=20&sfw=true`).then(r => r.data)

export const getAnimeById = (id) =>
  jikan.get(`/anime/${id}/full`).then(r => r.data)

export const getAnimeEpisodes = (id, page = 1) =>
  jikan.get(`/anime/${id}/episodes?page=${page}`).then(r => r.data)

export const getAnimeCharacters = (id) =>
  jikan.get(`/anime/${id}/characters`).then(r => r.data)

export const getGenres = () =>
  jikan.get('/genres/anime').then(r => r.data)

export const getAnimeByGenre = (genreId, page = 1) =>
  jikan.get(`/anime?genres=${genreId}&page=${page}&limit=20&order_by=score&sort=desc`).then(r => r.data)

export const getRandomAnime = () =>
  jikan.get('/random/anime').then(r => r.data)

export const getSchedule = (day = 'monday') =>
  jikan.get(`/schedules?filter=${day}`).then(r => r.data)

export const getSeasonUpcoming = () =>
  jikan.get('/seasons/upcoming?limit=12').then(r => r.data)

// ─── Consumet (Streaming) ─────────────────────────────────
export const searchConsumet = (title) =>
  consumet.get(`/anime/gogoanime/${encodeURIComponent(title)}`).then(r => r.data)

export const getEpisodeSources = (episodeId) =>
  consumet.get(`/anime/gogoanime/watch/${encodeURIComponent(episodeId)}`).then(r => r.data)

export const getConsumetInfo = (id) =>
  consumet.get(`/anime/gogoanime/info/${id}`).then(r => r.data)
