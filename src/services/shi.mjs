// services/shi.mjs

/**
 * Faz requisições à API Shinokai usando o proxy serverless interno (/api/shinokai).
 */
export async function api(endpoint) {
  const cleanPath = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint
  const res = await fetch(`/api/shinokai?path=${encodeURIComponent(cleanPath)}`)

  if (!res.ok) {
    let errorMsg = `Erro HTTP ${res.status}`
    try {
      const errData = await res.json()
      if (errData.msg || errData.error) {
        errorMsg = errData.msg || errData.error
      }
    } catch (_) {}
    throw new Error(errorMsg)
  }

  return await res.json()
}

/**
 * Normaliza o retorno em um Array para prevenir falhas de iteradores no React.
 */
export function arrayOf(data) {
  if (!data) return []
  if (Array.isArray(data)) return data
  if (Array.isArray(data.data)) return data.data
  if (Array.isArray(data.items)) return data.items
  if (typeof data === 'object') return Object.values(data)
  return []
}

/**
 * Normaliza os dados da mídia/anime retornados da API.
 */
export function mediaInfo(media) {
  if (!media) return {}
  return {
    id: media.id || media._id || media.mal_id || '',
    mal_id: media.mal_id || media.malId || null,
    title: media.title || media.name || 'Título Desconhecido',
    title_english: media.title_english || media.english_title || media.title || '',
    image: media.image || media.cover || media.poster || '',
  }
}

/**
 * Normaliza a estrutura de episódios e suas variantes.
 */
export function episodeInfo(ep) {
  if (!ep) return {}
  return {
    id: ep.id || ep._id || String(ep.number || ep.episode || '1'),
    number: Number(ep.number || ep.episode || 1),
    title: ep.title || `Episódio ${ep.number || ep.episode || 1}`,
    variants: arrayOf(ep.variants || ep.players || ep.sources || []),
  }
}

/**
 * Extrai a URL final de reprodução obtida do endpoint /play.
 */
export function videoUrl(playData) {
  if (!playData) return ''
  if (typeof playData === 'string') return playData
  return playData.url || playData.streamUrl || playData.file || playData.data?.url || ''
}

/**
 * Verifica se a opção/variante de vídeo é dublada em Português.
 */
export function isDub(variant) {
  if (!variant) return false
  const label = String(variant.label || variant.name || variant.lang || '').toLowerCase()
  const audio = String(variant.audio || '').toLowerCase()
  return (
    label.includes('dub') ||
    label.includes('pt-br') ||
    label.includes('português') ||
    label.includes('portugues') ||
    audio.includes('dub') ||
    variant.isDub === true
  )
}

/**
 * Converte o rótulo de resolução/qualidade em número para permitir ordenação (ex: "1080p" -> 1080).
 */
export function qualityNumber(variant) {
  if (!variant) return 0
  const label = String(variant.label || variant.quality || '')
  const match = label.match(/(\d+)/)
  return match ? parseInt(match[1], 10) : 0
                      }
