const PROXY = '/api/animefire'

async function afFetch(params) {
  const query = new URLSearchParams(params).toString()
  const response = await fetch(`${PROXY}?${query}`)
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.error || `AnimeFire HTTP ${response.status}`)
  return payload
}

function qualityNumber(stream) {
  const values = Array.isArray(stream?.qualities) ? stream.qualities : [stream?.label]
  const numbers = values.map(v => Number(String(v || '').match(/\d{3,4}/)?.[0] || 0))
  return Math.max(...numbers, 0)
}

function audioRank(stream) {
  const audio = String(stream?.audio || '').toLowerCase()
  if (audio.includes('dubl')) return 2
  if (audio.includes('legend')) return 1
  return 0
}

export function escolherMelhorStream(streams = [], preferDub = true) {
  const online = streams.filter(stream => stream?.url && !stream.is_offline)
  if (!online.length) return null
  return [...online].sort((a, b) => {
    const audioDiff = preferDub ? audioRank(b) - audioRank(a) : 0
    return audioDiff || qualityNumber(b) - qualityNumber(a)
  })[0]
}

export async function buscarAnimePorNome(nome) {
  const result = await afFetch({ action: 'search', q: nome })
  const anime = result?.data?.[0]
  if (!anime) throw new Error(`Anime não encontrado: ${nome}`)
  return anime
}

export async function carregarEpisodiosPaginados(animeId, page = 1, limit = 30) {
  const result = await afFetch({ action: 'anime', id: animeId })
  const all = result?.data?.episodes || []
  const start = (page - 1) * limit
  const episodes = all.slice(start, start + limit).map(ep => ({
    ...ep,
    number: ep.number ?? ep.episode,
  }))
  return { episodios: episodes, temMais: start + limit < all.length }
}

export async function obterLinkPlay(_animeId, epId, preferDub = true) {
  const result = await afFetch({ action: 'episode', id: epId })
  const stream = escolherMelhorStream(result?.data?.streams, preferDub)
  if (!stream) throw new Error('Nenhuma fonte online encontrada para este episódio.')
  return stream.url
}

export async function obterStreamPlay(_animeId, epId, preferDub = true) {
  const result = await afFetch({ action: 'episode', id: epId })
  return escolherMelhorStream(result?.data?.streams, preferDub)
}
