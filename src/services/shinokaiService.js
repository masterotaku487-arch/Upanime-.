// shinokaiService.js
// Cliente da fonte própria (seu backend). Troque BASE_URL pelo seu domínio real.

const BASE_URL = 'https://api-prod.shinokai.online'

// ============================================================
// CONFIGURAÇÃO
// ============================================================

const HEADERS = {
  'Accept': 'application/json',
  'Content-Type': 'application/json'
}

// ============================================================
// FUNÇÃO AUXILIAR
// ============================================================

function extrairLista(dados) {
  if (Array.isArray(dados)) return dados

  if (dados && typeof dados === 'object') {
    for (const chave of ['data', 'episodes', 'items', 'results', 'list']) {
      if (Array.isArray(dados[chave])) {
        return dados[chave]
      }
    }
  }

  return []
}

// ============================================================
// REQUISIÇÃO À SUA API
// ============================================================

async function apiPropria(endpoint) {
  const res = await fetch(`${BASE_URL}${endpoint}`, {
    method: 'GET',
    headers: HEADERS
  })

  if (!res.ok) {
    throw new Error(`Erro da API: HTTP ${res.status}`)
  }

  const text = await res.text()
  if (!text) return null

  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

// ============================================================
// 1. BUSCAR ANIME
// ============================================================

export async function buscarAnimePorNome(nomeAnime) {
  const busca = await apiPropria(`/medias?q=${encodeURIComponent(nomeAnime)}`)
  const listaAnimes = extrairLista(busca)

  if (!listaAnimes.length) {
    throw new Error('Anime não encontrado.')
  }

  return listaAnimes[0]
}

// ============================================================
// 1b. BUSCAR ANIME POR ID (usado pelo WatchPage, que já sabe o id)
// ============================================================

export async function buscarAnimePorId(animeId) {
  const dados = await apiPropria(`/medias/${encodeURIComponent(animeId)}`)
  if (!dados) throw new Error('Anime não encontrado.')
  return dados?.data || dados
}

// ============================================================
// 2. CARREGAR EPISÓDIOS PAGINADOS
// ============================================================

export async function carregarEpisodiosPaginados(animeId, pagina = 1, limite = 30) {
  const epData = await apiPropria(`/medias/${encodeURIComponent(animeId)}/episodes`)
  const todosEpis = extrairLista(epData)

  const inicio = (pagina - 1) * limite
  const fim = inicio + limite
  const episodiosBloco = todosEpis.slice(inicio, fim)

  return {
    episodios: episodiosBloco,
    totalGeral: todosEpis.length,
    paginaAtual: pagina,
    temMais: fim < todosEpis.length
  }
}

// ============================================================
// 3. OBTER LINK DE PLAY
// ============================================================

export async function obterLinkPlay(animeId, episodioId) {
  const playData = await apiPropria(
    `/medias/${encodeURIComponent(animeId)}/episodes/${encodeURIComponent(episodioId)}/play`
  )

  const streamUrl =
    playData?.url ||
    playData?.videoUrl ||
    playData?.playUrl ||
    (typeof playData === 'string' ? playData : null)

  if (!streamUrl) {
    throw new Error('Link do vídeo não encontrado.')
  }

  return streamUrl
    }
