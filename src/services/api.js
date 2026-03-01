import axios from 'axios'

// ── Jikan (MyAnimeList) ───────────────────────────────────
const jikan = axios.create({
  baseURL: 'https://api.jikan.moe/v4',
  timeout: 12000,
})

// ── Consumet (Streaming via Gogoanime) ────────────────────
const CONSUMET_URL = import.meta.env.VITE_CONSUMET_URL || 'https://api.consumet.org'
const consumet = axios.create({
  baseURL: CONSUMET_URL,
  timeout: 20000,
})

// Gêneros bloqueados (hentai/erotica)
const BLOCKED_GENRE_IDS = [12, 49]
export const isBlocked = (anime) => {
  const genres = [...(anime.genres || []), ...(anime.explicit_genres || [])]
  return genres.some(g => BLOCKED_GENRE_IDS.includes(g.mal_id))
}

// ── Jikan endpoints ───────────────────────────────────────
export const getSeasonNow = (page = 1) =>
  jikan.get(`/seasons/now?page=${page}`).then(r => ({
    ...r.data,
    data: (r.data.data || []).filter(a => !isBlocked(a)),
  }))

export const getTopAnime = (filter = 'airing', page = 1) =>
  jikan.get(`/top/anime?filter=${filter}&page=${page}&limit=24&sfw=true`).then(r => ({
    ...r.data,
    data: (r.data.data || []).filter(a => !isBlocked(a)),
  }))

export const searchAnime = (q, page = 1) =>
  jikan.get(`/anime?q=${encodeURIComponent(q)}&page=${page}&limit=20&sfw=true`).then(r => ({
    ...r.data,
    data: (r.data.data || []).filter(a => !isBlocked(a)),
  }))

export const getAnimeById = (id) =>
  jikan.get(`/anime/${id}/full`).then(r => r.data)

export const getAnimeEpisodes = (id, page = 1) =>
  jikan.get(`/anime/${id}/episodes?page=${page}`).then(r => r.data)

export const getGenres = () =>
  jikan.get('/genres/anime?filter=genres').then(r => ({
    ...r.data,
    data: (r.data.data || []).filter(g => !BLOCKED_GENRE_IDS.includes(g.mal_id)),
  }))

export const getAnimeByGenre = (genreId, page = 1) =>
  jikan.get(`/anime?genres=${genreId}&page=${page}&limit=20&order_by=score&sort=desc&sfw=true`).then(r => ({
    ...r.data,
    data: (r.data.data || []).filter(a => !isBlocked(a)),
  }))

export const getSeasonUpcoming = () =>
  jikan.get('/seasons/upcoming?limit=16').then(r => ({
    ...r.data,
    data: (r.data.data || []).filter(a => !isBlocked(a)),
  }))

// ── Consumet endpoints ────────────────────────────────────

/**
 * PASSO 1 — Traduz o MAL ID para um ID do Gogoanime.
 *
 * O Jikan retorna IDs como 58788 (MAL ID).
 * O Gogoanime usa slugs como "frieren-beyond-journeys-end".
 * Esta função faz a ponte entre os dois: pega os títulos do anime
 * (inglês → japonês → alternativo) e busca no Gogoanime até achar.
 *
 * @param {object} anime - Objeto completo do anime vindo do Jikan
 * @param {boolean} dub  - Se true, busca versão dublada
 * @returns {string|null} - ID do Gogoanime (ex: "frieren-beyond-journeys-end") ou null
 */
export const resolveGogoanimeId = async (anime, dub = false) => {
  // Monta lista de títulos para tentar, do mais específico ao menos
  const titles = [
    anime.title_english,
    anime.title,
    anime.title_japanese,
    ...(anime.titles || []).map(t => t.title),
  ]
    .filter(Boolean)
    .filter((v, i, a) => a.indexOf(v) === i) // remove duplicatas

  for (let title of titles) {
    const searchTitle = dub ? `${title} (Dub)` : title
    try {
      const res = await consumet.get(`/anime/gogoanime/${encodeURIComponent(searchTitle)}`)
      const results = res.data?.results || []

      if (results.length === 0) continue

      // Se buscando dub, filtra por resultados que contêm "(Dub)" no ID
      if (dub) {
        const dubMatch = results.find(r => r.id?.toLowerCase().includes('dub'))
        if (dubMatch) {
          console.log(`[Consumet] Dub encontrado: "${dubMatch.id}" via título "${searchTitle}"`)
          return dubMatch.id
        }
        continue // nenhum dub neste título, tenta o próximo
      }

      // Para leg/sub, pega o primeiro resultado que NÃO seja dub
      const subMatch = results.find(r => !r.id?.toLowerCase().includes('dub')) || results[0]
      console.log(`[Consumet] Encontrado: "${subMatch.id}" via título "${searchTitle}"`)
      return subMatch.id

    } catch (err) {
      console.warn(`[Consumet] Falhou para "${searchTitle}":`, err.message)
      // continua para o próximo título
    }
  }

  console.error('[Consumet] Não foi possível encontrar o anime em nenhum título:', titles)
  return null
}

/**
 * PASSO 2 — Busca as fontes de vídeo de um episódio específico.
 *
 * @param {string} gogoanimeId - ID do Gogoanime (ex: "frieren-beyond-journeys-end")
 * @param {number} epNum       - Número do episódio
 * @returns {object}           - { sources: [{url, quality}], headers: {...} }
 */
export const fetchEpisodeSources = async (gogoanimeId, epNum) => {
  const episodeId = `${gogoanimeId}-episode-${epNum}`
  console.log(`[Consumet] Buscando fontes para: ${episodeId}`)
  const res = await consumet.get(`/anime/gogoanime/watch/${encodeURIComponent(episodeId)}`)
  return res.data
}

// Mantidos para compatibilidade
export const searchConsumet = (title) =>
  consumet.get(`/anime/gogoanime/${encodeURIComponent(title)}`).then(r => r.data)

export const getEpisodeSources = (episodeId) =>
  consumet.get(`/anime/gogoanime/watch/${encodeURIComponent(episodeId)}`).then(r => r.data)
                                                       
