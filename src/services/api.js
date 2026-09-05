import axios from 'axios'

// ══════════════════════════════════════════════════════════════
// CATÁLOGO — AniList GraphQL direto (https://graphql.anilist.co)
// Sem worker no meio: o front chama a AniList direto (ela aceita
// CORS de qualquer origem). Shape de retorno continua igual ao
// da Jikan (mal_id, images.jpg.image_url, genres, etc.) pra não
// precisar mexer em mais nada no resto do app.
// ══════════════════════════════════════════════════════════════

const ANILIST_URL = 'https://graphql.anilist.co'

async function anilistQuery(query, variables) {
  const { data } = await axios.post(ANILIST_URL, { query, variables }, {
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    timeout: 12000,
  })
  if (data.errors?.length) throw new Error(data.errors.map(e => e.message).join('; '))
  return data.data
}

const MEDIA_FIELDS = `
  id idMal
  title { romaji english native }
  description(asHtml: false)
  format status season seasonYear episodes duration
  averageScore popularity favourites genres
  tags { name }
  studios(isMain: true) { nodes { name } }
  startDate { year month day }
  endDate { year month day }
  coverImage { extraLarge large medium }
  trailer { id site }
  relations {
    edges {
      relationType(version: 2)
      node {
        id idMal type format status episodes
        title { romaji english native }
        coverImage { large medium }
      }
    }
  }
`

const FORMAT_MAP = { TV: 'TV', TV_SHORT: 'TV', MOVIE: 'Movie', OVA: 'OVA', ONA: 'ONA', SPECIAL: 'Special', MUSIC: 'Music' }
const STATUS_MAP = {
  RELEASING: 'Currently Airing', FINISHED: 'Finished Airing', NOT_YET_RELEASED: 'Not yet aired',
  CANCELLED: 'Cancelled', HIATUS: 'On Hiatus',
}
// Pra ordenar e nomear os itens do botão "Coleção" na página do anime
const RELATION_LABELS = {
  PREQUEL: 'Temporada Anterior', SEQUEL: 'Próxima Temporada', PARENT: 'História Principal',
  SIDE_STORY: 'História Paralela', SUMMARY: 'Recapitulação', ALTERNATIVE: 'Versão Alternativa',
  SPIN_OFF: 'Spin-off', ADAPTATION: 'Adaptação', OTHER: 'Relacionado',
  COMPILATION: 'Compilação', CONTAINS: 'Contém', CHARACTER: 'Mesmo Universo', SOURCE: 'Original',
}
const RELATION_ORDER = {
  PREQUEL: 0, PARENT: 1, SEQUEL: 2, SIDE_STORY: 3, SPIN_OFF: 4,
  ALTERNATIVE: 5, SUMMARY: 6, ADAPTATION: 7, COMPILATION: 8, CONTAINS: 9, CHARACTER: 10, SOURCE: 11, OTHER: 12,
}
const pad = (n) => String(n).padStart(2, '0')
const fuzzyToIso = (d) => (d?.year ? `${d.year}-${pad(d.month || 1)}-${pad(d.day || 1)}` : null)
const stripHtml = (s) => (s ? s.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').trim() : '')

function mapMedia(m) {
  if (!m) return null
  return {
    mal_id: m.idMal || m.id,
    url: `https://myanimelist.net/anime/${m.idMal || m.id}`,
    images: {
      jpg: {
        image_url: m.coverImage?.medium || m.coverImage?.large,
        large_image_url: m.coverImage?.extraLarge || m.coverImage?.large,
      },
    },
    title: m.title?.romaji || m.title?.english || m.title?.native,
    title_english: m.title?.english || null,
    title_japanese: m.title?.native || null,
    type: FORMAT_MAP[m.format] || m.format || null,
    episodes: m.episodes || null,
    status: STATUS_MAP[m.status] || m.status || null,
    aired: { from: fuzzyToIso(m.startDate), to: fuzzyToIso(m.endDate) },
    duration: m.duration ? `${m.duration} min per ep` : null,
    score: m.averageScore != null ? Math.round(m.averageScore) / 10 : null,
    scored_by: null,
    popularity: m.popularity || null,
    synopsis: stripHtml(m.description),
    season: m.season ? m.season.toLowerCase() : null,
    year: m.seasonYear || null,
    genres: (m.genres || []).map((g, i) => ({ mal_id: 1000 + i, name: g })),
    explicit_genres: [],
    themes: (m.tags || []).slice(0, 6).map((t, i) => ({ mal_id: 2000 + i, name: t.name })),
    studios: (m.studios?.nodes || []).map(s => ({ name: s.name })),
    trailer: m.trailer
      ? {
          youtube_id: m.trailer.site === 'youtube' ? m.trailer.id : null,
          embed_url: m.trailer.site === 'youtube' ? `https://www.youtube.com/embed/${m.trailer.id}?rel=0` : null,
        }
      : {},
    collection: (m.relations?.edges || [])
      .filter(e => e.node?.type === 'ANIME' && e.node?.idMal)
      .map(e => ({
        mal_id: e.node.idMal,
        title: e.node.title?.romaji || e.node.title?.english || e.node.title?.native,
        image: e.node.coverImage?.large || e.node.coverImage?.medium,
        type: FORMAT_MAP[e.node.format] || e.node.format || null,
        status: STATUS_MAP[e.node.status] || e.node.status || null,
        episodes: e.node.episodes || null,
        relation: RELATION_LABELS[e.relationType] || e.relationType,
        relationOrder: RELATION_ORDER[e.relationType] ?? 99,
      }))
      .sort((a, b) => a.relationOrder - b.relationOrder),
  }
}

function mapPagination(pageInfo, perPage) {
  return {
    last_visible_page: pageInfo.lastPage,
    has_next_page: pageInfo.hasNextPage,
    current_page: pageInfo.currentPage,
    items: { count: pageInfo.total ? Math.min(perPage, pageInfo.total) : 0, total: pageInfo.total, per_page: perPage },
  }
}

// Tabela própria de gêneros/tags (ids sintéticos, uso interno do app)
const GENRE_TABLE = [
  ['Action', 'genre'], ['Adventure', 'genre'], ['Comedy', 'genre'], ['Drama', 'genre'],
  ['Fantasy', 'genre'], ['Horror', 'genre'], ['Mystery', 'genre'], ['Romance', 'genre'],
  ['Sci-Fi', 'genre'], ['Slice of Life', 'genre'], ['Sports', 'genre'], ['Supernatural', 'genre'],
  ['Thriller', 'genre'], ['Mecha', 'genre'], ['Music', 'genre'], ['Psychological', 'genre'],
  ['Ecchi', 'genre'],
  ['Isekai', 'tag'], ['Shounen', 'tag'], ['Shoujo', 'tag'], ['Seinen', 'tag'], ['Josei', 'tag'],
  ['Historical', 'tag'], ['Military', 'tag'], ['Harem', 'tag'], ['School', 'tag'], ['Magic', 'tag'],
  ['Demons', 'tag'], ['Vampire', 'tag'], ['Samurai', 'tag'], ['Space', 'tag'], ['Video Game', 'tag'],
  ['Cars', 'tag'], ['Parody', 'tag'], ['Martial Arts', 'tag'], ['Super Power', 'tag'], ['Kids', 'tag'],
  ['Girls Love', 'genre'], ['Boys Love', 'genre'], ['Avant Garde', 'genre'], ['Award Winning', 'genre'],
  ['Gourmet', 'genre'], ['Gore', 'tag'], ['Erotica', 'tag'],
].map(([name, kind], i) => ({ mal_id: i + 1, name, kind }))
const genreById = (id) => GENRE_TABLE.find(g => g.mal_id === Number(id))

function currentSeason(date = new Date()) {
  const m = date.getUTCMonth() + 1, year = date.getUTCFullYear()
  if (m <= 3) return { season: 'WINTER', year }
  if (m <= 6) return { season: 'SPRING', year }
  if (m <= 9) return { season: 'SUMMER', year }
  return { season: 'FALL', year }
}

const LIST_QUERY = `
query ($page: Int, $perPage: Int, $search: String, $sort: [MediaSort], $genre_in: [String], $tag_in: [String], $format: MediaFormat, $status: MediaStatus, $season: MediaSeason, $seasonYear: Int, $startDate_greater: FuzzyDateInt, $startDate_lesser: FuzzyDateInt) {
  Page(page: $page, perPage: $perPage) {
    pageInfo { total currentPage lastPage hasNextPage }
    media(
      type: ANIME, isAdult: false,
      search: $search, sort: $sort,
      genre_in: $genre_in, tag_in: $tag_in,
      format: $format, status: $status,
      season: $season, seasonYear: $seasonYear,
      startDate_greater: $startDate_greater, startDate_lesser: $startDate_lesser
    ) { ${MEDIA_FIELDS} }
  }
}`

async function listAnime(vars, perPage) {
  const data = await anilistQuery(LIST_QUERY, vars)
  return { pagination: mapPagination(data.Page.pageInfo, perPage), data: data.Page.media.map(mapMedia) }
}

// Mantido só por compatibilidade — filtro de adulto já é feito na query (isAdult:false)
export const isBlocked = () => false

export const getSeasonNow = (page = 1) => {
  const { season, year } = currentSeason()
  return listAnime({ page, perPage: 24, season, seasonYear: year, sort: ['POPULARITY_DESC'] }, 24)
}

export const getTopAnime = (filter = 'airing', page = 1) => {
  const vars = { page, perPage: 24, sort: ['POPULARITY_DESC'] }
  if (filter === 'airing') vars.status = 'RELEASING'
  else if (filter === 'upcoming') vars.status = 'NOT_YET_RELEASED'
  else if (filter === 'favorite') vars.sort = ['FAVOURITES_DESC']
  else if (['movie', 'tv', 'ova', 'special'].includes(filter)) vars.format = filter.toUpperCase()
  return listAnime(vars, 24)
}

export const searchAnime = (q, page = 1) =>
  listAnime({ page, perPage: 20, search: q, sort: ['SEARCH_MATCH'] }, 20)

export const getAnimeById = async (id) => {
  const data = await anilistQuery(`query ($idMal: Int) { Media(idMal: $idMal, type: ANIME) { ${MEDIA_FIELDS} } }`, { idMal: parseInt(id) })
  return { data: mapMedia(data.Media) }
}

export const getAnimeEpisodes = async (id, page = 1) => {
  const data = await anilistQuery(`query ($idMal: Int) { Media(idMal: $idMal, type: ANIME) { episodes } }`, { idMal: parseInt(id) })
  const total = data.Media?.episodes || 0
  const perPage = 100
  const start = (page - 1) * perPage + 1
  const end = Math.min(start + perPage - 1, total)
  const list = []
  for (let n = start; n <= end; n++) list.push({ mal_id: n, title: null, aired: null, filler: false, recap: false })
  return {
    pagination: { has_next_page: end < total, last_visible_page: Math.max(1, Math.ceil(total / perPage)), current_page: page },
    data: list,
  }
}

export const getGenres = async () => ({ data: GENRE_TABLE.map(g => ({ mal_id: g.mal_id, name: g.name, count: null })) })

export const getAnimeByGenre = (genreId, page = 1) => {
  const g = genreById(genreId)
  const vars = { page, perPage: 20, sort: ['SCORE_DESC'] }
  if (g?.kind === 'genre') vars.genre_in = [g.name]
  else if (g?.kind === 'tag') vars.tag_in = [g.name]
  return listAnime(vars, 20)
}

export const getSeasonUpcoming = () => {
  let { season, year } = currentSeason()
  const order = ['WINTER', 'SPRING', 'SUMMER', 'FALL']
  let idx = order.indexOf(season) + 1
  if (idx > 3) { idx = 0; year += 1 }
  return listAnime({ page: 1, perPage: 16, season: order[idx], seasonYear: year, sort: ['POPULARITY_DESC'] }, 16)
}

export const searchAnimeFilter = ({ genres = [], type, year, sort, page = 1 }) => {
  const ids = genres.map(id => genreById(id)).filter(Boolean)
  const genre_in = ids.filter(g => g.kind === 'genre').map(g => g.name)
  const tag_in = ids.filter(g => g.kind === 'tag').map(g => g.name)

  const format = type ? FORMAT_MAP[type.toUpperCase()] && type.toUpperCase() : undefined

  const sortMap = {
    bypopularity: ['POPULARITY_DESC'],
    favorite: ['SCORE_DESC'],
    airing: ['START_DATE_DESC'],
    upcoming: ['START_DATE_DESC'],
  }

  const vars = {
    page, perPage: 24,
    sort: sortMap[sort] || sortMap.bypopularity,
    genre_in: genre_in.length ? genre_in : undefined,
    tag_in: tag_in.length ? tag_in : undefined,
    format,
  }
  if (year) {
    vars.startDate_greater = parseInt(`${year}0101`)
    vars.startDate_lesser = parseInt(`${year}1231`)
  }
  return listAnime(vars, 24)
}

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
