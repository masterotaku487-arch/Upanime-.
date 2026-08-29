// shinokaiService.js - Adaptado para o WatchPage.jsx

const BASE_URL = 'https://api-prod.shinokai.online'
const AES_KEY_B64 = 'LClZ5k9139ypHE4c863iIrMALnupsPH+4TUF6zhA6nk='

const HEADERS = {
  'Accept': 'application/json',
  'Content-Type': 'application/json',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Referer': 'https://shinokai.online/',
  'Origin': 'https://shinokai.online'
}

const TOKEN_KEY = 'shinokai_access_token'

// Guarda em memória + sessionStorage: sobrevive a um F5 (recarregar a
// página), mas some se a aba/navegador for fechado — só aí gera um
// token novo, economizando chamadas desnecessárias.
let accessToken = (() => {
  try { return sessionStorage.getItem(TOKEN_KEY) || null } catch { return null }
})()

// Converte Base64 para Uint8Array sem bibliotecas externas
function b64ToUint8(b64) {
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes
}

// Obtém a API de Criptografia
function getSubtleCrypto() {
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.subtle) {
    return globalThis.crypto.subtle
  }
  try {
    const nodeCrypto = require('node:crypto')
    return nodeCrypto.webcrypto.subtle
  } catch (_) {
    throw new Error('Ambiente sem suporte a SubtleCrypto')
  }
}

// Descriptografia AES-256-GCM Universal
async function decryptEnvelope(envelope) {
  if (!envelope?.iv || !envelope?.tag || !envelope?.payload) return envelope

  const subtle = getSubtleCrypto()
  const keyBytes = b64ToUint8(AES_KEY_B64)
  const ivBytes = b64ToUint8(envelope.iv)
  const tagBytes = b64ToUint8(envelope.tag)
  const payloadBytes = b64ToUint8(envelope.payload)

  const combined = new Uint8Array(payloadBytes.length + tagBytes.length)
  combined.set(payloadBytes, 0)
  combined.set(tagBytes, payloadBytes.length)

  const key = await subtle.importKey(
    'raw', keyBytes, { name: 'AES-GCM' }, false, ['decrypt']
  )

  const decryptedBuffer = await subtle.decrypt(
    { name: 'AES-GCM', iv: ivBytes }, key, combined
  )

  const text = new TextDecoder().decode(decryptedBuffer)
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

// Extrai arrays independente de onde venham na resposta
function extrairLista(dados) {
  if (Array.isArray(dados)) return dados
  if (dados && typeof dados === 'object') {
    for (const chave of ['data', 'episodes', 'items', 'results', 'list']) {
      if (Array.isArray(dados[chave])) return dados[chave]
    }
  }
  return []
}

async function login() {
  const res = await fetch(`${BASE_URL}/auth/anonymous`, {
    method: 'POST',
    headers: HEADERS
  })
  const text = await res.text()
  const data = await unwrapJson(JSON.parse(text))

  accessToken = data?.accessToken || data?.access_token || data?.token
  if (!accessToken) throw new Error('Falha ao obter token de acesso')
  try { sessionStorage.setItem(TOKEN_KEY, accessToken) } catch {}
  return accessToken
}

async function apiShinokai(endpoint) {
  if (!accessToken) await login()

  const res = await fetch(`${BASE_URL}${endpoint}`, {
    headers: {
      ...HEADERS,
      'Authorization': `Bearer ${accessToken}`
    }
  })

  if (res.status === 401) {
    accessToken = null
    try { sessionStorage.removeItem(TOKEN_KEY) } catch {}
    await login()
    return apiShinokai(endpoint)
  }

  const text = await res.text()
  const parsed = JSON.parse(text)
  return await unwrapJson(parsed)
}

// ─────────────────────────────────────────────────────────────────────────────
// MÉTODOS EXPORTADOS EXIGIDOS PELO WATCHPAGE.JSX
// ─────────────────────────────────────────────────────────────────────────────

export async function buscarAnimePorNome(nome) {
  const busca = await apiShinokai(`/medias?q=${encodeURIComponent(nome)}`)
  const listaAnimes = extrairLista(busca)
  if (!listaAnimes.length) throw new Error('Anime não encontrado na busca.')
  return listaAnimes[0]
}

export async function carregarEpisodiosPaginados(animeId, page = 1, limit = 30) {
  const epData = await apiShinokai(`/medias/${encodeURIComponent(animeId)}/episodes`)
  const epis = extrairLista(epData)
  
  // Realiza o corte de paginação caso a API traga todos os episódios de uma vez
  const inicio = (page - 1) * limit
  const fim = inicio + limit
  const episodiosPagina = epis.slice(inicio, fim)
  const temMais = fim < epis.length

  return {
    episodios: episodiosPagina,
    temMais: temMais
  }
}

export async function obterLinkPlay(animeId, epId) {
  const playData = await apiShinokai(`/medias/${encodeURIComponent(animeId)}/episodes/${encodeURIComponent(epId)}/play`)
  const streamUrl = playData?.url || playData?.videoUrl || playData?.playUrl || (typeof playData === 'string' ? playData : null)
  
  if (!streamUrl) {
    throw new Error('Link do vídeo não encontrado.')
  }
  return streamUrl
}
