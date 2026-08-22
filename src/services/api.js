import axios from 'axios'

// CATÁLOGO NORMAL — Shinokai via Worker separado.
// Fan-Dubs próprios continuam nos módulos studio-proxy/FanDubs.
const CATALOG_API = 'https://shinokai-catalog.masterotaku487.workers.dev'
const VIDEO_API = 'https://shinokai-proxy.masterotaku487.workers.dev'

const catalogGet = async (path) => {
  const res = await axios.get(`${CATALOG_API}${path}`, { timeout: 15000 })
  if (res.data?.error) throw new Error(res.data.error)
  return res.data
}

const listOf = (value) => {
  if (Array.isArray(value)) return value
  if (Array.isArray(value?.data)) return value.data
  if (Array.isArray(value?.results)) return value.results
  if (Array.isArray(value?.items)) return value.items
  return []
}

const titleOf = (m) => typeof m?.title === 'object'
  ? (m.title.romaji || m.title.english || m.title.native || '')
  : (m?.title || m?.name || '')

const mapMedia = (m) => {
  if (!m) return null
  const id = m.id || m.shinokai_id
  const poster = m.posterUrl || m.cover || m.coverImage?.large || m.thumbnail || null
  const banner = m.bannerUrl || m.banner || m.backgroundUrl || null
  return {
    mal_id: id,
    shinokai_id: id,
    url: `/anime/${id}`,
    images: { jpg: { image_url: poster, large_image_url: poster } },
    banner_image: banner,
    title: titleOf(m),
    title_english: m.title_english || m.originalTitle || null,
    title_japanese: m.originalTitle || null,
    type: m.type || null,
    episodes: m.episodes || null,
    status: m.status || null,
    aired: { from: m.startDate || null, to: m.endDate || null },
    duration: m.duration ? (typeof m.duration === 'number' ? `${m.duration} min per ep` : m.duration) : null,
    score: m.score ?? null,
    scored_by: null,
    popularity: m.popularity || null,
    synopsis: m.synopsis || m.description || '',
    season: m.season || null,
    year: m.year || m.releaseYear || null,
    genres: (m.genres || []).map((g, i) => typeof g === 'string' ? { mal_id: 1000 + i, name: g } : g),
    explicit_genres: [],
    themes: [],
    studios: m.studios || [],
    trailer: {},
  }
}

const mapPage = (items, page = 1, perPage = 24) => {
  const data = items.slice((page - 1) * perPage, page * perPage).map(mapMedia).filter(Boolean)
  return { data, pagination: { current_page: page, has_next_page: items.length > page * perPage, last_visible_page: Math.max(1, Math.ceil(items.length / perPage)), items: { count: data.length, total: items.length, per_page: perPage } } }
}

const homeLists = async () => {
  const body = await catalogGet('/home')
  return body?.data && !Array.isArray(body.data) ? body.data : body
}

export const isBlocked = () => false

export const getSeasonNow = async (page = 1) => {
  const h = await homeLists()
  return mapPage(listOf(h.trendingAnimes || h.featured || h.recent), page)
}

export const getTopAnime = async (filter = 'airing', page = 1) => {
  const h = await homeLists()
  const source = filter === 'movie' ? h.trendingMovies
    : filter === 'ova' || filter === 'special' ? h.trendingOvas
    : filter === 'upcoming' ? h.recent
    : filter === 'favorite' || filter === 'bypopularity' ? h.top
    : h.trendingAnimes || h.featured
  return mapPage(listOf(source), page)
}

export const searchAnime = async (q, page = 1) => {
  const body = await catalogGet(`/search?q=${encodeURIComponent(q)}`)
  const items = listOf(body)
  return mapPage(items, page, 20)
}

export const getAnimeById = async (id) => {
  const body = await catalogGet(`/media?id=${encodeURIComponent(id)}`)
  const item = body?.data && !Array.isArray(body.data) ? body.data : body
  return { data: mapMedia(item) }
}

export const getAnimeEpisodes = async (id, page = 1) => {
  const body = await axios.get(`${VIDEO_API}/episodes?id=${encodeURIComponent(id)}`, { timeout: 15000 })
  if (body.data?.error) throw new Error(body.data.error)
  const raw = listOf(body.data)
  const data = raw.map((ep, index) => ({
    mal_id: Number(ep.number || ep.episode || ep.ep || index + 1),
    title: ep.title || ep.name || null,
    aired: ep.aired || null,
    filler: false,
    recap: false,
    shinokai_id: ep.id || ep.episodeId || null,
    variants: ep.variants || ep.sources || [],
  }))
  return { pagination: { current_page: page, has_next_page: false, last_visible_page: 1 }, data }
}

export const getGenres = async () => {
  const body = await catalogGet('/genres')
  return { data: listOf(body).map((g, i) => ({ mal_id: g.id || i + 1, name: g.name, count: g.count ?? null })) }
}

export const getAnimeByGenre = async (genreId, page = 1) => {
  const h = await homeLists()
  const wanted = String(genreId)
  const all = Object.values(h?.byGenre || {}).flatMap(listOf)
  const filtered = all.filter(m => (m.genres || []).some(g => String(g.id || g.mal_id || g) === wanted || String(g.name || g).toLowerCase() === wanted.toLowerCase()))
  return mapPage(filtered.length ? filtered : listOf(h.trendingAnimes), page)
}

export const getSeasonUpcoming = async () => getTopAnime('upcoming', 1)

export const searchAnimeFilter = async ({ genres = [], type, year, sort, page = 1 }) => {
  const h = await homeLists()
  let items = Object.values(h || {}).flatMap(listOf).filter(Boolean)
  if (type) items = items.filter(m => String(m.type || '').toLowerCase() === String(type).toLowerCase())
  if (year) items = items.filter(m => String(m.year || m.releaseYear || '') === String(year))
  if (genres.length) items = items.filter(m => (m.genres || []).some(g => genres.includes(g.id) || genres.includes(g.mal_id)))
  return mapPage(items, page)
}

// STREAMING NORMAL — Shinokai via Worker de vídeo. Fan-Dubs próprios permanecem separados.
export const fetchSourcesWithFallback = async (anime, epNum, dub = false, cache = {}) => {
  const mediaId = anime.shinokai_id || anime.mal_id
  const episodesResponse = await axios.get(`${VIDEO_API}/episodes?id=${encodeURIComponent(mediaId)}`, { timeout: 15000 })
  const episodes = listOf(episodesResponse.data)
  const episode = episodes.find(e => Number(e.number || e.episode || e.ep) === Number(epNum)) || episodes[Number(epNum) - 1]
  if (!episode) throw new Error(`Episódio ${epNum} não encontrado na Shinokai`)
  const variants = episode.variants || episode.sources || []
  const variant = variants.find(v => String(v.type || v.audio || v.label || '').toLowerCase().includes(dub ? 'dub' : 'sub')) || variants[0]
  const episodeId = episode.id || episode.episodeId || episode._id
  const variantId = variant?.id || variant?.variantId || episodeId
  const { data } = await axios.get(`${VIDEO_API}/play?id=${encodeURIComponent(mediaId)}&ep=${encodeURIComponent(episodeId)}&var=${encodeURIComponent(variantId)}`, { timeout: 20000 })
  if (!data?.url) throw new Error(data?.error || 'A Shinokai não retornou uma URL de vídeo')
  return { sources: [{ url: data.url, label: variant?.label || (dub ? 'Dublado' : 'Legendado'), isM3U8: data.url.includes('.m3u8') }], provider: 'Shinokai', cache: { ...cache, mediaId, episodeId, variantId } }
}

export const pickBestSource = (sources = []) => sources[0] || null
export const getAnimeFireEpisodes = async () => ({ slug: null, episodes: [], title: null, domain: null })

