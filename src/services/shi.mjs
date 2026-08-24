// src/services/shi.mjs

const BASE_URL = 'https://api-prod.shinokai.online'
const AES_KEY_B64 = 'LClZ5k9139ypHE4c863iIrMALnupsPH+4TUF6zhA6nk='
const CORS_PROXY = 'https://corsproxy.io/?'

let accessToken = null

function bytesFromBase64(value) {
  if (typeof value !== 'string' || !value) return new Uint8Array(0)
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/')
  const padded = normalized + '='.repeat((4 - normalized.length % 4) % 4)
  const binary = atob(padded)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

async function decryptEnvelope(envelope) {
  if (!envelope?.iv || !envelope?.tag || !envelope?.payload) return envelope

  const keyBytes = bytesFromBase64(AES_KEY_B64)
  const iv = bytesFromBase64(envelope.iv)
  const tag = bytesFromBase64(envelope.tag)
  const payload = bytesFromBase64(envelope.payload)

  const ciphertext = new Uint8Array(payload.length + tag.length)
  ciphertext.set(payload, 0)
  ciphertext.set(tag, payload.length)

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'AES-GCM' },
    false,
    ['decrypt']
  )

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv, tagLength: tag.length * 8 },
    cryptoKey,
    ciphertext
  )

  const text = new TextDecoder().decode(decrypted)
  return JSON.parse(text)
}

async function unwrapJson(parsed) {
  if (parsed?.iv && parsed?.tag && parsed?.payload) {
    return await decryptEnvelope(parsed)
  }
  if (parsed && typeof parsed.data === 'object' && !Array.isArray(parsed.data)) {
    return parsed.data
  }
  return parsed
}

async function readResponse(response) {
  const text = await response.text()
  let parsed
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error(`Shinokai HTTP ${response.status}: resposta não é JSON`)
  }
  if (!response.ok) {
    const detail = parsed?.message || parsed?.error || `HTTP ${response.status}`
    throw new Error(detail)
  }
  return await unwrapJson(parsed)
}

async function login() {
  const targetUrl = `${BASE_URL}/auth/anonymous`
  const response = await fetch(`${CORS_PROXY}${encodeURIComponent(targetUrl)}`, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
  })
  const data = await readResponse(response)
  const token = data?.accessToken || data?.access_token || data?.token
  if (!token) throw new Error('Token anônimo ausente')
  accessToken = token
}

export async function api(path, allowRelogin = true) {
  if (!accessToken) await login()
  const targetUrl = `${BASE_URL}${path}`
  const response = await fetch(`${CORS_PROXY}${encodeURIComponent(targetUrl)}`, {
    headers: {
      'Accept': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
  })
  if (response.status === 401 && allowRelogin) {
    accessToken = null
    return api(path, false)
  }
  return readResponse(response)
}

export function arrayOf(value) {
  if (Array.isArray(value)) return value
  if (Array.isArray(value?.results)) return value.results
  if (Array.isArray(value?.episodes)) return value.episodes
  if (Array.isArray(value?.data)) return value.data
  return []
}

export function titleOf(media) {
  if (typeof media?.title === 'string') return media.title
  if (media?.title && typeof media.title === 'object') {
    return media.title.romaji || media.title.english || media.title.native || ''
  }
  return media?.name || media?.originalTitle || ''
}

export function mediaInfo(media) {
  return {
    id: media?.id || media?.shinokai_id || null,
    mal_id: media?.malId || media?.mal_id || null,
    title: titleOf(media),
    english: media?.title?.english || null,
    type: media?.type || media?.format || null,
    year: media?.releaseYear || media?.seasonYear || null,
    episodes: media?.episodes || media?.episodeCount || null,
    cover: media?.posterUrl || media?.coverImage?.large || media?.thumbnail || null,
  }
}

export function episodeInfo(episode) {
  const variants = Array.isArray(episode?.variants)
    ? episode.variants
    : (Array.isArray(episode?.sources) ? episode.sources : [])
  return {
    id: episode?.id || null,
    number: episode?.number ?? episode?.episodeNumber ?? null,
    title: episode?.title || episode?.name || null,
    variants: variants.map((variant) => ({
      id: variant?.id || variant?.variantId || null,
      label: variant?.label || variant?.quality || variant?.audioType || 'Auto',
      lang: variant?.lang || variant?.language || variant?.audioType || '',
      audioType: variant?.audioType || null,
    })),
  }
}

export function videoUrl(data) {
  if (typeof data === 'string') return data
  if (data?.url || data?.videoUrl || data?.playUrl) return data.url || data.videoUrl || data.playUrl
  const source = Array.isArray(data?.sources) ? data.sources.find((item) => item?.url) : null
  return source?.url || null
}

export function qualityNumber(variant) {
  const text = `${variant?.label || ''} ${variant?.quality || ''}`.toLowerCase()
  if (/2160|4k/.test(text)) return 2160
  if (/1440/.test(text)) return 1440
  if (/1080|full\s*hd/.test(text)) return 1080
  if (/720|hd/.test(text)) return 720
  if (/480/.test(text)) return 480
  if (/360/.test(text)) return 360
  return 0
}

export function isDub(variant) {
  const text = `${variant?.label || ''} ${variant?.lang || ''} ${variant?.audioType || ''}`.toLowerCase()
  return /dub|dubl|pt[- ]?br|portugu/.test(text)
}
