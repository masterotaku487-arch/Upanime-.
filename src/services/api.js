import axios from 'axios'

// Integração direta Shinokai para o APK Capacitor.
// O restante do frontend continua consumindo as mesmas exportações e formatos.
// Fan-Dubs próprios permanecem nos módulos studio-proxy/FanDubs.
const SHINOKAI_BASE = 'https://api-prod.shinokai.online'
const AES_KEY_B64 = 'LClZ5k9139ypHE4c863iIrMALnupsPH+4TUF6zhA6nk='
const CLIENT_UA = 'Shinokai/1.0.19 (Android)'

let accessToken = null
let loginPromise = null
const responseCache = new Map()
const pendingRequests = new Map()

const decodeB64 = (value) => {
  const normalized = String(value).replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(normalized + '='.repeat((4 - normalized.length % 4) % 4))
  return Uint8Array.from(binary, char => char.charCodeAt(0))
}

const decryptEnvelope = async (envelope) => {
  if (!envelope?.iv || !envelope?.tag || !envelope?.payload) return envelope
  const key = await crypto.subtle.importKey('raw', decodeB64(AES_KEY_B64), 'AES-GCM', false, ['decrypt'])
  const payload = decodeB64(envelope.payload)
  const tag = decodeB64(envelope.tag)
  const ciphertext = new Uint8Array(payload.length + tag.length)
  ciphertext.set(payload)
  ciphertext.set(tag, payload.length)
  const clear = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: decodeB64(envelope.iv), tagLength: 128 }, key, ciphertext)
  return JSON.parse(new TextDecoder().decode(clear))
}

const readBody = async (response) => {
  const text = await response.text()
  let parsed
  try { parsed = JSON.parse(text) } catch { throw new Error(`Shinokai HTTP ${response.status}`) }
  if (!response.ok) {
    const message = parsed?.message || parsed?.error || `Shinokai HTTP ${response.status}`
    throw new Error(message)
  }
  return parsed?.iv && parsed?.tag && parsed?.payload ? decryptEnvelope(parsed) : parsed
}

const login = async () => {
  if (accessToken) return accessToken
  if (!loginPromise) {
    loginPromise = axios.post(`${SHINOKAI_BASE}/auth/anonymous`, {}, {
      timeout: 15000,
      headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'User-Agent': CLIENT_UA },
      transformResponse: [(text) => text],
    }).then(async response => {
      const raw = typeof response.data === 'string' ? JSON.parse(response.data) : response.data
      const data = await decryptEnvelope(raw)
      const token = data?.accessToken || data?.access_token || data?.token
      if (!token) throw new Error('Token anônimo ausente na resposta Shinokai')
      accessToken = token
      return token
    }).finally(() => { loginPromise = null })
  }
  return loginPromise
}

const directGet = async (path, { ttl = 0, retryAuth = true } = {}) => {
  const cacheKey = path
  const now = Date.now()
  const cached = responseCache.get(cacheKey)
  if (cached && cached.expiresAt > now) return cached.value
  if (pendingRequests.has(cacheKey)) return pendingRequests.get(cacheKey)

  const request = (async () => {
    const token = await login()
    const response = await axios.get(`${SHINOKAI_BASE}${path}`, {
      timeout: 20000,
      responseType: 'text',
      transformResponse: [(text) => text],
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
        'User-Agent': CLIENT_UA,
      },
      validateStatus: () => true,
    })
    if (response.status === 401 && retryAuth) {
      accessToken = null
      return directGet(path, { ttl, retryAuth: false })
    }
    const value = await readBody(new Response(response.data, { status: response.status, headers: response.headers }))
    if (ttl > 0) responseCache.set(cacheKey, { value, expiresAt: Date.now() + ttl })
    return value
  })().finally(() => pendingRequests.delete(cacheKey))

  pendingRequests.set(cacheKey, request)
  return request
}

const listOf = (value) => {
  if (Array.isArray(value)) return value
  if (Array.isArray(value?.data)) return value.data
  if (Array.isArray(value?.results)) return value.results
  if (Array.isArray(value?.items)) return value.items
  if (Array.isArray(value?.episodes)) return value.episodes
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
    type: m.type || m.format || null,
    episodes: m.episodes || m.episodeCount || null,
    status: m.status || null,
    aired: { from: m.startDate || null, to: m.endDate || null },
    duration: m.duration ? (typeof m.duration === 'number' ? `${m.duration} min per ep` : m.duration) : null,
    score: m.score ?? null,
    scored_by: null,
    popularity: m.popularity || null,
    synopsis: m.synopsis || m.description || '',
    season: m.season || null,
    year: m.year || m.releaseYear || m.seasonYear || null,
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
  const body = await directGet('/home', { ttl: 120000 })
  return body?.data && !Array.isArray(body.data) ? body.data : body?.results && !Array.isArray(body.results) ? body.results : body
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
  const body = await directGet(`/medias?q=${encodeURIComponent(q)}`, { ttl: 120000 })
  return mapPage(listOf(body), page, 20)
}

export const getAnimeById = async (id) => {
  const body = await directGet(`/medias/${encodeURIComponent(id)}`, { ttl: 120000 })
  const item = body?.data && !Array.isArray(body.data) ? body.data : body?.results && !Array.isArray(body.results) ? body.results : body
  return { data: mapMedia(item) }
}

export const getAnimeEpisodes = async (id, page = 1) => {
  const body = await directGet(`/medias/${encodeURIComponent(id)}/episodes`, { ttl: 300000 })
  const raw = listOf(body)
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
  const body = await directGet('/genres', { ttl: 300000 })
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

// STREAMING NORMAL — API Shinokai direta. Fan-Dubs próprios permanecem separados.
export const getShinokaiPlayUrl = async (mediaId, episodeId, variantId) => {
  const suffix = variantId ? `?variantId=${encodeURIComponent(variantId)}` : ''
  const body = await directGet(`/medias/${encodeURIComponent(mediaId)}/episodes/${encodeURIComponent(episodeId)}/play${suffix}`)
  const videoUrl = typeof body === 'string' ? body : body?.url || body?.videoUrl || body?.playUrl || body?.sources?.find(s => s.url)?.url
  if (!videoUrl) throw new Error('A Shinokai não retornou uma URL de vídeo')
  return videoUrl
}

export const fetchSourcesWithFallback = async (anime, epNum, dub = false, cache = {}) => {
  const mediaId = anime.shinokai_id || anime.mal_id
  const episodes = listOf(await directGet(`/medias/${encodeURIComponent(mediaId)}/episodes`, { ttl: 300000 }))
  const episode = episodes.find(e => Number(e.number || e.episode || e.ep) === Number(epNum)) || episodes[Number(epNum) - 1]
  if (!episode) throw new Error(`Episódio ${epNum} não encontrado na Shinokai`)
  const variants = episode.variants || episode.sources || []
  const variant = variants.find(v => String(v.type || v.audio || v.lang || v.label || v.audioType || '').toLowerCase().includes(dub ? 'dub' : 'sub')) || variants[0]
  const episodeId = episode.id || episode.episodeId || episode._id
  const variantId = variant?.id || variant?.variantId || episodeId
  const videoUrl = await getShinokaiPlayUrl(mediaId, episodeId, variantId)
  return { sources: [{ url: videoUrl, label: variant?.label || (dub ? 'Dublado' : 'Legendado'), isM3U8: videoUrl.includes('.m3u8') }], provider: 'Shinokai', cache: { ...cache, mediaId, episodeId, variantId } }
}

export const pickBestSource = (sources = []) => sources[0] || null
export const getAnimeFireEpisodes = async () => ({ slug: null, episodes: [], title: null, domain: null })
