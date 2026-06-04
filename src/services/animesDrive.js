/**
 * AnimesDrive DooPlay API Service
 * 
 * Fluxo:
 * 1. Busca nonce em animesdrive.online (necessário para API)
 * 2. Busca anime por título via wp-json/dooplay/search
 * 3. Extrai URL do anime
 * 4. Busca episódios via scraping ou API
 * 5. Envia URL do episódio para o Worker extrair vídeos
 */

const ANIMES_DRIVE_BASE = 'https://animesdrive.online'
const WORKER_URL = 'https://drivea.masterotaku487.workers.dev'

// Cache do nonce (válido por sessão)
let nonceCache = null
let nonceFetchTime = 0
const NONCE_CACHE_TTL = 3600000 // 1 hora

/**
 * Busca o nonce do AnimesDrive necessário para fazer requisições à API
 * @returns {Promise<string>} Nonce válido
 */
export const fetchNonce = async () => {
  const now = Date.now()
  
  // Retorna cache se ainda válido
  if (nonceCache && (now - nonceFetchTime) < NONCE_CACHE_TTL) {
    return nonceCache
  }

  try {
    const response = await fetch(ANIMES_DRIVE_BASE, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    })
    const html = await response.text()

    // Busca: var dtGonza = {..., "nonce":"abc123", ...}
    const nonceMatch = html.match(/"nonce"\s*:\s*"([^"]+)"/)
    if (!nonceMatch) throw new Error('Nonce não encontrado no HTML')

    nonceCache = nonceMatch[1]
    nonceFetchTime = now
    console.log('[AnimesDrive] Nonce obtido:', nonceCache)
    return nonceCache
  } catch (err) {
    console.error('[AnimesDrive] Erro ao buscar nonce:', err.message)
    throw err
  }
}

/**
 * Busca animes por título na API DooPlay
 * @param {string} keyword - Título do anime
 * @returns {Promise<Array>} Lista de animes encontrados
 */
export const searchAnimes = async (keyword) => {
  try {
    const nonce = await fetchNonce()
    const url = new URL(`${ANIMES_DRIVE_BASE}/wp-json/dooplay/search/`)
    url.searchParams.set('keyword', keyword)
    url.searchParams.set('nonce', nonce)

    const response = await fetch(url.toString(), {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': ANIMES_DRIVE_BASE
      }
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    const data = await response.json()

    // Converte resposta em array
    const results = Object.entries(data).map(([id, item]) => ({
      id,
      title: item.title,
      url: item.url,
      img: item.img,
      date: item.extra?.date,
      imdb: item.extra?.imdb,
      isDub: item.title.toLowerCase().includes('dublado'),
      isMovie: item.url.includes('/filme/')
    }))

    console.log(`[AnimesDrive] ${results.length} resultados para "${keyword}"`)
    return results
  } catch (err) {
    console.error('[AnimesDrive] Erro na busca:', err.message)
    throw err
  }
}

/**
 * Extrai slug do URL do AnimesDrive
 * Ex: https://animesdrive.online/anime/solo-leveling-dublado → solo-leveling-dublado
 * @param {string} url - URL do anime
 * @returns {string} Slug
 */
export const extractSlug = (url) => {
  const match = url.match(/\/(?:anime|filme)\/([^/]+)/)
  return match ? match[1] : null
}

/**
 * Busca episódios de um anime no AnimesDrive
 * Faz scraping da página do anime para extrair lista de episódios
 * @param {string} animeUrl - URL do anime no AnimesDrive
 * @returns {Promise<Array>} Lista de episódios com URLs
 */
export const fetchEpisodes = async (animeUrl) => {
  try {
    const response = await fetch(animeUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': ANIMES_DRIVE_BASE
      }
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    const html = await response.text()

    // Busca links de episódios: /episodios/slug-1x1/, /episodios/slug-1x2/, etc.
    const episodeRegex = /href="(\/episodios\/[^"]+)"/g
    const episodes = []
    let match

    while ((match = episodeRegex.exec(html)) !== null) {
      const episodePath = match[1]
      const episodeUrl = ANIMES_DRIVE_BASE + episodePath
      
      // Extrai número do episódio (ex: slug-1x5 → ep 5)
      const epNumMatch = episodePath.match(/(\d+)x(\d+)/)
      if (epNumMatch) {
        const season = parseInt(epNumMatch[1])
        const episode = parseInt(epNumMatch[2])
        
        episodes.push({
          season,
          episode,
          number: episode, // Número global
          url: episodeUrl,
          title: `Episódio ${episode}`
        })
      }
    }

    // Remove duplicatas e ordena por episódio
    const unique = Array.from(new Map(episodes.map(e => [e.url, e])).values())
    unique.sort((a, b) => a.episode - b.episode)

    console.log(`[AnimesDrive] ${unique.length} episódios encontrados`)
    return unique
  } catch (err) {
    console.error('[AnimesDrive] Erro ao buscar episódios:', err.message)
    throw err
  }
}

/**
 * Busca vídeos de um episódio usando o Worker do usuário
 * @param {string} episodeUrl - URL do episódio no AnimesDrive
 * @returns {Promise<Object>} { success, sources, title, error }
 */
export const fetchVideoSources = async (episodeUrl) => {
  try {
    const workerUrl = new URL(WORKER_URL)
    workerUrl.searchParams.set('url', episodeUrl)

    const response = await fetch(workerUrl.toString(), {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': ANIMES_DRIVE_BASE
      }
    })

    if (!response.ok) {
      throw new Error(`Worker HTTP ${response.status}`)
    }

    const data = await response.json()

    if (!data.success) {
      throw new Error(data.error || 'Erro desconhecido')
    }

    console.log(`[Worker] ${data.results?.length || 0} fontes encontradas`)
    return data
  } catch (err) {
    console.error('[Worker] Erro ao buscar vídeos:', err.message)
    throw err
  }
}

/**
 * Resolve um link de vídeo Blogger Player
 * @param {string} bloggerUrl - URL do embed Blogger
 * @returns {Promise<Object>} { success, sources }
 */
export const resolveBloggerPlayer = async (bloggerUrl) => {
  try {
    const workerUrl = new URL(WORKER_URL)
    workerUrl.searchParams.set('blogger', bloggerUrl)

    const response = await fetch(workerUrl.toString())
    const data = await response.json()

    if (!data.success) {
      throw new Error(data.error || 'Erro ao resolver Blogger')
    }

    return data
  } catch (err) {
    console.error('[Worker] Erro ao resolver Blogger:', err.message)
    throw err
  }
}

/**
 * Cria URL de proxy para um vídeo MP4
 * Permite streaming com suporte a Range requests
 * @param {string} mp4Url - URL do vídeo MP4
 * @returns {string} URL do proxy
 */
export const createProxyUrl = (mp4Url) => {
  const url = new URL(WORKER_URL)
  url.searchParams.set('proxy', mp4Url)
  return url.toString()
}

/**
 * Fluxo completo: Busca anime → episódios → vídeos
 * @param {string} title - Título do anime (do Jikan)
 * @param {number} episodeNumber - Número do episódio (1-based)
 * @param {boolean} preferDub - Preferir dublado?
 * @returns {Promise<Object>} { anime, episodes, sources, error }
 */
export const getAnimeWithSources = async (title, episodeNumber = 1, preferDub = false) => {
  try {
    // 1. Busca anime no AnimesDrive
    console.log(`[AnimesDrive] Buscando "${title}"...`)
    const searchResults = await searchAnimes(title)

    if (!searchResults.length) {
      throw new Error(`Anime "${title}" não encontrado no AnimesDrive`)
    }

    // 2. Seleciona melhor resultado (preferindo dublado se solicitado)
    let selected = searchResults[0]
    if (preferDub) {
      const dubbed = searchResults.find(r => r.isDub)
      if (dubbed) selected = dubbed
    }

    console.log(`[AnimesDrive] Selecionado: ${selected.title}`)

    // 3. Busca episódios
    const episodes = await fetchEpisodes(selected.url)
    if (!episodes.length) {
      throw new Error('Nenhum episódio encontrado')
    }

    // 4. Busca vídeos do episódio desejado
    const targetEp = episodes.find(e => e.number === episodeNumber) || episodes[0]
    const videoData = await fetchVideoSources(targetEp.url)

    return {
      anime: selected,
      episodes,
      currentEpisode: targetEp,
      sources: videoData.results || [],
      title: videoData.title,
      success: true
    }
  } catch (err) {
    console.error('[AnimesDrive] Erro no fluxo completo:', err.message)
    return {
      error: err.message,
      success: false
    }
  }
}

export default {
  fetchNonce,
  searchAnimes,
  extractSlug,
  fetchEpisodes,
  fetchVideoSources,
  resolveBloggerPlayer,
  createProxyUrl,
  getAnimeWithSources
}
