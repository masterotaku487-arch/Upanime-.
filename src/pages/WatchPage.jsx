import { useState, useEffect, useCallback } from 'react'
import { useParams, useSearchParams, Link } from 'react-router-dom'
import { FiChevronLeft, FiChevronRight } from 'react-icons/fi'
import { getAnimeById, getAnimeEpisodes } from '../services/api'
import { useTranslatedSynopsis } from '../services/translate'
import { saveHistory } from '../services/history'
import { recordWatched, ACHIEVEMENTS } from '../services/achievements'
import VideoPlayer from '../components/VideoPlayer'
import Comments from '../components/Comments'
import FeedbackModal from '../components/FeedbackModal'
import './WatchPage.css'

// ─────────────────────────────────────────────────────────────────────────────
// FONTE PRINCIPAL: DriveA Worker → animesdrive.online
//
// Padrão de URL que o worker espera:
//   https://animesdrive.online/episodio/{slug}-episodio-{ep-2digits}
//
// Worker endpoints:
//   ?url=<page>      → extrai player links do episódio
//   ?blogger=<embed> → resolve Blogger Player → MP4 real
//   ?proxy=<mp4>     → proxy chunked com Range support
// ─────────────────────────────────────────────────────────────────────────────

// ── Workers / Servidores ─────────────────────────────────────────────────────
const DA      = 'https://drivea.masterotaku487.workers.dev'  // Srv 1 – AnimesDrive
const AQ      = 'https://aq.masterotaku487.workers.dev'      // Srv 2 – AnimeQ
const AT      = 'https://at.masterotaku487.workers.dev'      // Srv 3 – Anitube

// Sites
const AD_BASE = 'https://animesdrive.online'
const AQ_BASE = 'https://animeq.net'
const AT_BASE = 'https://www.anitube.zip'

// ── Dub URL transform ────────────────────────────────────────────────────────
// Insere /Dub/ antes do último segmento da URL (nome do arquivo)
// LEG: …/Re-Zero-4/09.mp4  →  DUB: …/Re-Zero-4/Dub/09.mp4
const toDubUrl = (url) => {
  if (url.includes('/Dub/')) return url  // já está dublado
  const i = url.lastIndexOf('/')
  return url.slice(0, i) + '/Dub' + url.slice(i)
}

// Fallbacks legados
const AF            = 'https://animefire-proxy.masterotaku487.workers.dev'
const RENDER_PROXY  = 'https://animesfontes-proxy.onrender.com'

// ── Slug helpers ──────────────────────────────────────────────────────────────

/** Converte string em slug no padrão animesdrive.online (romaji com hifens) */
/**
 * Converte string em slug no padrão animesdrive.online.
 *
 * Regras observadas nos exemplos reais do site:
 *   "Re:Zero kara..."   → "rezero-kara-..."    (dois-pontos removido SEM espaço)
 *   "Naruto"            → "naruto"
 *   "Kimetsu no Yaiba"  → "kimetsu-no-yaiba"
 *   "4th Season"        → "4th-season"         (mantém número de season)
 */
const slugifyAD = (s) =>
  s.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')  // remove acentos
    .replace(/[:.!?★☆♪•'"]/g, '')                      // remove pontuação sem espaço
    .replace(/[^a-z0-9\s-]/g, ' ')                     // resto vira espaço
    .trim().replace(/\s+/g, '-').replace(/-+/g, '-')

/**
 * Remove sufixos de season SOMENTE se for string genérica como "Season 2",
 * mas mantém casos como "4th Season" que fazem parte do título oficial.
 * O animesdrive.online mantém "4th-season" no slug.
 */
const stripSeasonAD = (s) =>
  s.replace(/\s+(the\s+)?(final|last|new)\s+season/gi, '')
   .replace(/\s*[-–]\s*(season|parte?|part|cour)\s*\d+/gi, '')
   .trim()

/**
 * Gera candidatos de slug para animesdrive.online.
 *
 * Exemplos reais confirmados:
 *   "naruto"                                           (simples)
 *   "rezero-kara-hajimeru-isekai-seikatsu-4th-season"  (mantém 4th-season)
 *   "kimetsu-no-yaiba-movie-mugen-jou-hen"             (movie sem episodio)
 */
const buildDriveACandidates = (anime, dub = false) => {
  // Romaji (title) é o padrão do site; en como fallback
  const titles = [
    anime.title,           // romaji japonês — prioritário
    anime.title_english,
    anime.title_portuguese,
    ...(anime.titles || []).map(t => t.title),
  ].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i)

  const bases = new Set()
  for (const t of titles) {
    const stripped = stripSeasonAD(t)
    for (const v of [t, stripped]) {
      const s = slugifyAD(v)
      if (s && s.length > 1) bases.add(s)
    }
  }

  // Dublado → tenta slug com -dublado primeiro, depois sem (fallback)
  // LEG: rezero-kara-hajimeru-isekai-seikatsu-4th-season
  // DUB: rezero-kara-hajimeru-isekai-seikatsu-4th-season-dublado
  if (dub) {
    const withDub    = [...bases].map(b => b + '-dublado')
    const withoutDub = [...bases]
    return [...new Set([...withDub, ...withoutDub])]
  }
  return [...new Set([...bases])]
}

/** Número do episódio zero-padded em 2 dígitos (padrão do site) */
const epStr = (ep) => String(ep).padStart(2, '0')

/**
 * Monta a URL de episódio do animesdrive.online.
 * Filmes/OVAs não têm -episodio-NN (ex: kimetsu-no-yaiba-movie-mugen-jou-hen)
 * Séries: {slug}-episodio-{ep2d}
 */
const buildEpisodeUrl = (slug, ep, isMovie = false) =>
  isMovie
    ? `${AD_BASE}/episodio/${slug}`
    : `${AD_BASE}/episodio/${slug}-episodio-${epStr(ep)}`

// ── DriveA fetch ──────────────────────────────────────────────────────────────

/** Testa se um slug+ep existe no animesdrive.online via DriveA worker. */
const probeDriveA = async (slug, ep, isMovie = false) => {
  const epUrl     = buildEpisodeUrl(slug, ep, isMovie)
  const workerUrl = `${DA}/?url=${encodeURIComponent(epUrl)}`
  try {
    const res  = await fetch(workerUrl, { signal: AbortSignal.timeout(20000) })
    if (!res.ok) return null
    const data = await res.json()
    if (data.success && data.results?.length > 0) return { slug, results: data.results }
  } catch { /* slug não existe */ }
  return null
}

/** Resolve slug correto testando candidatos em ordem. */
const resolveDriveA = async (anime, ep, dub = false) => {
  const isMovie = ['Movie', 'OVA', 'Special', 'TV Special', 'Music'].includes(anime.type)

  // 1. Checa slug-overrides.json primeiro (editável no GitHub sem redeploy)
  const overrides = await loadOverrides()
  const ov = overrides[String(anime.mal_id)]
  if (ov?.drivea) {
    const slug = (dub && ov.drivea.dub) ? ov.drivea.dub : ov.drivea.leg
    if (slug) {
      console.log('[DriveA] ✅ (override)', slug)
      const found = await probeDriveA(slug, ep, isMovie)
      if (found) return found
      console.warn('[DriveA] override slug falhou, tentando candidatos...')
    }
  }

  // 2. Testa candidatos gerados automaticamente
  const candidates = buildDriveACandidates(anime, dub)
  console.log('[DriveA] testando slugs:', candidates.join(', '))

  for (const slug of candidates) {
    const found = await probeDriveA(slug, ep, isMovie)
    if (found) {
      console.log('[DriveA] ✅ slug encontrado:', slug)
      return found
    }
  }
  throw new Error(`"${anime.title}" não encontrado no animesdrive.online`)
}

/**
 * Classifica e retorna fontes do DriveA worker.
 *
 * Tipos de result confirmados no response real:
 *   type:"mp4"    isBlogger:false  proxyUrl:✅  → usar proxyUrl direto (MP4 via chunked proxy)
 *   type:"iframe" isBlogger:true   resolveUrl:✅ → resolver via ?blogger= → obter MP4
 *   type:"iframe" isBlogger:false  proxyUrl:✅  → embed JS (animeshd.cloud, strp2p) → iframe
 *
 * Prioridade: MP4 direto > Blogger resolvido > iframe embed
 */
const pickBestDriveASource = async (results) => {
  // ── 1. MP4 direto → proxyUrl já pronto ──────────────────────────────────
  const mp4s = results.filter(r => r.type === 'mp4' && !r.isBlogger && r.proxyUrl)
  if (mp4s.length > 0) {
    return {
      type: 'mp4',
      sources: mp4s.map(r => ({
        label:     r.label,
        url:       r.proxyUrl,    // ?proxy=<mp4> — chunked range support
        directUrl: r.url,
      }))
    }
  }

  // ── 2. Blogger → resolve ?blogger= → extrai MP4 ─────────────────────────
  const bloggers = results.filter(r => r.isBlogger && r.resolveUrl)
  for (const r of bloggers) {
    try {
      const res  = await fetch(r.resolveUrl, { signal: AbortSignal.timeout(15000) })
      const data = await res.json()
      if (data.success && data.sources?.length > 0) {
        return {
          type: 'mp4',
          sources: data.sources.map((s, i) => ({
            label:     `Blogger ${i + 1}`,
            url:       `${DA}/?proxy=${encodeURIComponent(s.url)}`,
            directUrl: s.url,
          }))
        }
      }
    } catch { /* tenta próximo */ }
  }

  // ── 3. iframe embed (animeshd.cloud, strp2p…) → carrega no <iframe> ─────
  const iframes = results.filter(r => r.type === 'iframe' && !r.isBlogger && r.url)
  if (iframes.length > 0) {
    return {
      type:   'iframe',
      embedUrl: iframes[0].url,  // carrega o primeiro como embed
      sources:  iframes.map((r, i) => ({ label: r.label || `Opção ${i + 1}`, url: r.url }))
    }
  }

  throw new Error('Nenhuma fonte de vídeo válida retornada pelo DriveA')
}

// ── AnimeQ (Servidor 2) ───────────────────────────────────────────────────────
// animeq.net é outro site Dooplay — mesmo padrão de slug do animesdrive

const buildAnimeQCandidates = (anime, dub = false) => {
  // AnimeQ usa slugs em português/romanizado — mesmo helper do DriveA
  return buildDriveACandidates(anime, dub).map(s => s)
}

const resolveAnimeQ = async (anime, ep, dub = false) => {
  const isMovie = ['Movie', 'OVA', 'Special', 'TV Special', 'Music'].includes(anime.type)

  // Override dedicado para AnimeQ
  const overrides = await loadOverrides()
  const ov = overrides[String(anime.mal_id)]
  if (ov?.animeq) {
    const slug = (dub && ov.animeq.dub) ? ov.animeq.dub : ov.animeq.leg
    if (slug) {
      const epUrl = isMovie
        ? `${AQ_BASE}/episodio/${slug}`
        : `${AQ_BASE}/episodio/${slug}-episodio-${epStr(ep)}`
      const workerUrl = `${AQ}/?url=${encodeURIComponent(epUrl)}`
      try {
        const res  = await fetch(workerUrl, { signal: AbortSignal.timeout(20000) })
        const data = await res.json()
        if (data.success && data.results?.length) {
          console.log('[AnimeQ] ✅ (override)', slug)
          return { slug, results: data.results, worker: AQ }
        }
      } catch {}
    }
  }

  const candidates = buildAnimeQCandidates(anime, dub)
  console.log('[AnimeQ] testando slugs:', candidates.join(', '))
  for (const slug of candidates) {
    const epUrl = isMovie
      ? `${AQ_BASE}/episodio/${slug}`
      : `${AQ_BASE}/episodio/${slug}-episodio-${epStr(ep)}`
    const workerUrl = `${AQ}/?url=${encodeURIComponent(epUrl)}`
    try {
      const res  = await fetch(workerUrl, { signal: AbortSignal.timeout(20000) })
      if (!res.ok) continue
      const data = await res.json()
      if (data.success && data.results?.length) {
        console.log('[AnimeQ] ✅', slug)
        return { slug, results: data.results, worker: AQ }
      }
    } catch {}
  }
  throw new Error(`"${anime.title}" não encontrado no AnimeQ`)
}

// ── Anitube (Servidor 3) ──────────────────────────────────────────────────────
// anitube.zip usa URLs de página por episódio — resolução via override ou slug
// O worker extrai o vídeo (HLS m3u8 ou MP4) e faz proxy automático



// ── AnimeQ (aq.masterotaku487.workers.dev) ────────────────────────────────────
// Mesmo worker Dooplay do DriveA, mas aponta para animeq.net
// Padrão confirmado: animeq.net/episodio/{slug}-episodio-{ep}/
//   LEG: gachiakuta-episodio-16
//   DUB: jibaku-shounen-hanako-kun-2-part-2-dublado-episodio-01

const buildAnimeQUrl = (slug, ep, dub = false) => {
  const dubPart  = dub ? '-dublado' : ''
  return `${AQ_BASE}/episodio/${slug}${dubPart}-episodio-${ep}/`
}

const probeAnimeQ = async (slug, ep, dub = false) => {
  const epUrl     = buildAnimeQUrl(slug, ep, dub)
  const workerUrl = `${AQ}/?url=${encodeURIComponent(epUrl)}`
  try {
    const res  = await fetch(workerUrl, { signal: AbortSignal.timeout(18000) })
    if (!res.ok) return null
    const data = await res.json()
    if (data.success && data.results?.length > 0) return { slug, results: data.results }
  } catch {}
  return null
}

const resolveAnimeQ = async (anime, ep, dub = false) => {
  // Checa override primeiro
  const overrides = await loadOverrides()
  const ov = overrides[String(anime.mal_id)]
  if (ov?.animeq) {
    const slug = (dub && ov.animeq.dub) ? ov.animeq.dub : ov.animeq.leg
    if (slug) {
      const found = await probeAnimeQ(slug, ep, false) // dub já no slug do override
      if (found) { console.log('[AnimeQ] ✅ (override)', slug); return found }
    }
  }

  // Tenta candidatos automáticos (mesmo slugify do DriveA — padrão romaji)
  const candidates = buildDriveACandidates(anime, false) // sem -dublado: o dub vai no buildAnimeQUrl
  console.log('[AnimeQ] testando slugs:', candidates.join(', '))

  for (const slug of candidates) {
    const found = await probeAnimeQ(slug, ep, dub)
    if (found) { console.log('[AnimeQ] ✅', slug); return found }
  }
  throw new Error(`"${anime.title}" não encontrado no AnimeQ`)
}

// ── AniTube (at.masterotaku487.workers.dev) ───────────────────────────────────
// Worker proxy: extrai HLS/MP4 de qualquer página anitube.zip e proxeia
// URLs do anitube são hash-based (ex: anitube.zip/939915b/) → requer override
// O src retornado é o próprio worker (stream direto, não JSON)

const resolveAniTube = async (anime, ep, dub) => {
  const overrides = await loadOverrides()
  const ov = overrides[String(anime.mal_id)]
  const atOv = ov?.anitube
  if (!atOv) throw new Error('AniTube: sem override para este anime')
  const epUrl = dub
    ? (atOv.dub?.[String(ep)] || atOv.leg?.[String(ep)])
    : (atOv.leg?.[String(ep)] || atOv.dub?.[String(ep)])
  if (!epUrl) throw new Error(`AniTube: sem URL para EP ${ep}`)
  return `${AT}/?url=${encodeURIComponent(epUrl)}`
}


// ── AnimeFire legado ──────────────────────────────────────────────────────────

const proxyUrl = (url) => `https://at.masterotaku487.workers.dev/?url=${encodeURIComponent(url)}`

const afFetch = async (params) => {
  const qs = new URLSearchParams(params).toString()
  const r  = await fetch(`${AF}?${qs}`, { signal: AbortSignal.timeout(30000) })
  if (!r.ok) throw new Error(`AF Proxy ${r.status}`)
  return r.json()
}

const slugify = (s) =>
  s.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/['":`]/g, '')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .trim().replace(/\s+/g, '-').replace(/-+/g, '-')

const stripSeason = (s) =>
  s.replace(/\s*[-–:]\s*(season|parte?|part|cour)\s*\d*/gi, '')
   .replace(/\s+\d+(st|nd|rd|th)\s*(season|cour)/gi, '')
   .replace(/\s+(the\s+)?(final|last|new)\s+season/gi, '')
   .replace(/\s+(season|parte?|part)\s*\d*/gi, '')
   .replace(/\s+\d+$/g, '').trim()

const buildSlugCandidates = (anime, dub = false) => {
  const titles = [
    anime.title, anime.title_english, anime.title_portuguese,
    ...(anime.titles || []).map(t => t.title),
  ].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i)

  const bases = new Set()
  for (const t of titles) {
    const noSeason   = stripSeason(t)
    const noSubtitle = stripSubtitle(noSeason)
    for (const v of [noSeason, noSubtitle, t]) {
      const s = slugify(v)
      if (s && s.length > 1) bases.add(s)
    }
  }
  const withSeason = []; const withoutSeason = []
  for (const base of bases) {
    const isFull = [...bases].some(b => b !== base && base.startsWith(b))
    const target = isFull ? withSeason : withoutSeason
    if (dub) { target.push(base + '-dublado-todos-os-episodios'); target.push(base + '-dublado') }
    else       target.push(base + '-todos-os-episodios')
    target.push(base)
  }
  return [...new Set([...withSeason, ...withoutSeason])]
}

let _overridesCache = null
const loadOverrides = async () => {
  if (_overridesCache) return _overridesCache
  try {
    const SLUG_CID = window.__SLUG_CID__ || localStorage.getItem('slug_cid') || ''
    const SLUG_URL = SLUG_CID
      ? `https://${SLUG_CID}.ipfs.dweb.link/slug-overrides.json`
      : '/slug-overrides.json'
    const res  = await fetch(SLUG_URL + '?_t=' + Date.now())
    const json = await res.json()
    _overridesCache = json.animes || {}
  } catch { _overridesCache = {} }
  return _overridesCache
}

const probeSlug = async (slug, isMovie = false) => {
  try {
    const data = await afFetch({ action: 'info', slug })
    if (data.episodes?.length > 0) return slug
    if (isMovie && data.slug) return slug
  } catch { /* não existe */ }
  return null
}

const resolveSlug = async (anime, dub = false) => {
  const isMovie = ['Movie', 'OVA', 'Special', 'TV Special', 'Music'].includes(anime.type)
  const overrides = await loadOverrides()
  const ov = overrides[String(anime.mal_id)]
  if (ov) {
    const slug = (dub && ov.dub) ? ov.dub : ov.leg
    if (slug) { console.log('[AnimeFire] ✅ (override)', slug); return slug }
  }
  const candidates = buildSlugCandidates(anime, dub)
  if (isMovie) {
    for (const slug of candidates) {
      try {
        const data = await afFetch({ action: 'video', slug, ep: 1 })
        if (data.sources?.length > 0) { console.log('[AnimeFire] ✅ (movie)', slug); return slug }
      } catch { /* tenta próximo */ }
    }
  }
  for (const slug of candidates) {
    const found = await probeSlug(slug, isMovie)
    if (found) { console.log('[AnimeFire] ✅', slug); return found }
  }
  throw new Error(`"${anime.title}" não encontrado no AnimeFire`)
}

const bestQuality = (sources = []) => {
  const order = ['fullhd', 'full hd', 'fhd', '1080', 'hd', '720', 'sd', '480', '360']
  return [...sources].sort((a, b) => {
    const ai = order.findIndex(o => (a.label || '').toLowerCase().includes(o))
    const bi = order.findIndex(o => (b.label || '').toLowerCase().includes(o))
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
  })[0] || sources[0]
}

const getDirectUrl = (url) => {
  try {
    const u = new URL(url, window.location.origin)
    if (u.hostname.includes('at.masterotaku487') || u.pathname.includes('/api/proxy')) {
      const real = u.searchParams.get('url')
      if (real) return decodeURIComponent(real)
    }
    if (url.includes('workers.dev') && u.searchParams.get('url')) {
      return decodeURIComponent(u.searchParams.get('url'))
    }
  } catch {}
  return url
}

const isAndroid = /Android/i.test(navigator.userAgent)
const isIOS     = /iPhone|iPad|iPod/i.test(navigator.userAgent)
const isMobile  = isAndroid || isIOS

const openVLC = (url, title) => {
  const directUrl = getDirectUrl(url)
  window.location.href = `vlc://${directUrl}`
  setTimeout(() => { if (!document.hidden) window.open(directUrl, '_blank') }, 1500)
}

const openMXPlayer = (url, title) => {
  const directUrl = getDirectUrl(url)
  const titleEnc  = encodeURIComponent(title)
  const referer   = encodeURIComponent('https://animesdrive.online/')
  const ua        = encodeURIComponent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36')
  const intentFree = `intent:${directUrl}#Intent;action=android.intent.action.VIEW;type=video/*;package=com.mxtech.videoplayer.ad;S.title=${titleEnc};S.headers_Referer=${referer};S.headers_User-Agent=${ua};end`
  const intentPro  = `intent:${directUrl}#Intent;action=android.intent.action.VIEW;type=video/*;package=com.mxtech.videoplayer.pro;S.title=${titleEnc};S.headers_Referer=${referer};S.headers_User-Agent=${ua};end`
  window.location.href = intentFree
  setTimeout(() => { if (!document.hidden) window.location.href = intentPro }, 1000)
}

const openADM = (url, fn) => {
  window.location.href = `adm://add?url=${encodeURIComponent(url)}&filename=${encodeURIComponent(fn)}`
  setTimeout(() => window.open(url, '_blank'), 900)
}


// ── Server status ping ────────────────────────────────────────────────────────
const checkServers = async () => {
  // Worker online = qualquer resposta HTTP (mesmo 400 = URL inválida = worker rodando)
  const ping = async (url) => {
    try {
      await fetch(url, { signal: AbortSignal.timeout(8000) })
      return true  // respondeu = online
    } catch { return false }
  }
  const [s1, s2, s3] = await Promise.all([
    ping(DA).catch(() => false),
    ping(AQ).catch(() => false),
    ping(AT).catch(() => false),
  ])
  return { driveA: s1, animeQ: s2, aniTube: s3 }
}

// ─────────────────────────────────────────────────────────────────────────────
export default function WatchPage() {
  const { id } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const epNum = parseInt(searchParams.get('ep') || '1')
  const isDub = searchParams.get('dub') === '1'

  const [anime,        setAnime]        = useState(null)
  const [episodes,     setEpisodes]     = useState([])
  const [hasMoreEps,   setHasMoreEps]   = useState(false)
  const [epPage,       setEpPage]       = useState(1)

  const [sources,      setSources]      = useState([])
  const [currentSrc,   setCurrentSrc]   = useState('')
  const [afSlug,       setAfSlug]       = useState(null)
  const [adSlug,       setAdSlug]       = useState(null)   // slug animesdrive cacheado
  const [aqSlug,       setAqSlug]       = useState(null)   // slug animeq cacheado
  const [loading,      setLoading]      = useState(true)
  const [status,       setStatus]       = useState('📡 Conectando ao DriveA...')
  const [error,        setError]        = useState(false)
  const [errorMsg,     setErrorMsg]     = useState('')
  const [showShare,    setShowShare]    = useState(false)
  const [copied,       setCopied]       = useState(false)
  const [newAchievements, setNewAchievements] = useState([])
  const [showBugReport,   setShowBugReport]   = useState(false)
  const [fallbackUrl,     setFallbackUrl]     = useState(null)
  const [provider,        setProvider]        = useState('DriveA')
  const [serverStatus,    setServerStatus]    = useState({ driveA: null, animeQ: null, aniTube: null })

  useEffect(() => {
    checkServers().then(setServerStatus)
  }, [])

  useEffect(() => {
    setAnime(null); setEpisodes([]); setAfSlug(null); setAdSlug(null); setAqSlug(null)
    Promise.allSettled([getAnimeById(id), getAnimeEpisodes(id, 1)]).then(([d, e]) => {
      if (d.status === 'fulfilled') {
        const a = d.value.data
        setAnime(a)
        const t = a.title_english || a.title || 'Anime'
        document.title = `${t} EP ${searchParams.get('ep') || '1'} - Assistir | Up Anime+`
      }
      if (e.status === 'fulfilled') {
        setEpisodes(e.value.data || [])
        setHasMoreEps(e.value.pagination?.has_next_page || false)
      }
    })
    window.scrollTo(0, 0)
    return () => { document.title = 'Up Anime+ | Assistir Animes Online Grátis em HD' }
  }, [id])

  const doLoad = async (animeObj, ep, dub, cachedAdSlug, cachedAqSlug, cachedAfSlug) => {
    setLoading(true); setError(false); setSources([]); setCurrentSrc(''); setFallbackUrl(null)

    // Fallback imediato do slug-overrides
    try {
      const overrides = await loadOverrides()
      const ov = overrides[String(animeObj.mal_id)]
      const fbUrl = ov?.fallback?.[String(ep)]
      if (fbUrl) {
        console.log('[fallback imediato]', fbUrl)
        setFallbackUrl(fbUrl); setError(true); setLoading(false); return
      }
    } catch {}

    // ── FONTE 1: DriveA → animesdrive.online ─────────────────────────────────
    try {
      setStatus('📡 Conectando ao DriveA...')

      const isMovie = ['Movie', 'OVA', 'Special', 'TV Special', 'Music'].includes(animeObj.type)

      let adResult
      if (cachedAdSlug) {
        adResult = await probeDriveA(cachedAdSlug, ep, isMovie)
        if (!adResult) cachedAdSlug = null
      }
      if (!adResult) {
        setStatus('🔍 Localizando no animesdrive.online...')
        adResult = await resolveDriveA(animeObj, ep, dub)
        setAdSlug(adResult.slug)
      }

      setStatus('📡 Carregando vídeo...')
      const picked = await pickBestDriveASource(adResult.results)

      if (picked.type === 'mp4' && picked.sources.length > 0) {
        // MP4 direto via proxy chunked ✅
        // Se dublado: insere /Dub/ antes do nome do arquivo
        const finalSources = dub
          ? picked.sources.map(s => {
              const dubDirect = toDubUrl(s.directUrl)
              return { ...s, directUrl: dubDirect, url: `${DA}/?proxy=${encodeURIComponent(dubDirect)}` }
            })
          : picked.sources
        setSources(finalSources)
        const best = bestQuality(finalSources)
        setCurrentSrc(best?.url || finalSources[0].url)
        setStatus(`✅ animesdrive.online — ${dub ? '🎙️ Dublado' : '🇧🇷 Legendado'} — ${best?.label || 'Auto'}`)
        setProvider('DriveA')
        setLoading(false)
        return
      }

      if (picked.type === 'iframe' && picked.embedUrl) {
        // Embed JS (animeshd.cloud, strp2p…) — carrega em iframe
        setCurrentSrc('__embed__')
        setErrorMsg(picked.embedUrl)
        setStatus('✅ animesdrive.online (embed)')
        setProvider('DriveA')
        setLoading(false)
        return
      }
    } catch (daErr) {
      console.warn('[DriveA] falhou:', daErr.message)
    }

    // ── FONTE 2: AnimeQ (aq.masterotaku487.workers.dev) ─────────────────────────
    try {
      setStatus('📡 Tentando AnimeQ...')

      let aqResult
      if (cachedAqSlug) {
        aqResult = await probeAnimeQ(cachedAqSlug, ep, dub)
        if (!aqResult) cachedAqSlug = null
      }
      if (!aqResult) {
        setStatus('🔍 Localizando no AnimeQ...')
        aqResult = await resolveAnimeQ(animeObj, ep, dub)
        setAqSlug(aqResult.slug)
      }

      setStatus('📡 Carregando AnimeQ...')
      const aqPicked = await pickBestDriveASource(aqResult.results)

      if (aqPicked.type === 'mp4' && aqPicked.sources.length > 0) {
        const finalSrcs = dub
          ? aqPicked.sources.map(s => {
              const dubDirect = toDubUrl(s.directUrl)
              return { ...s, directUrl: dubDirect, url: `${AQ}/?proxy=${encodeURIComponent(dubDirect)}` }
            })
          : aqPicked.sources
        setSources(finalSrcs)
        const best = bestQuality(finalSrcs)
        setCurrentSrc(best?.url || finalSrcs[0].url)
        setStatus(`✅ AnimeQ — ${dub ? '🎙️ Dublado' : '🇧🇷 Legendado'} — ${best?.label || 'Auto'}`)
        setProvider('AnimeQ')
        setLoading(false)
        return
      }

      if (aqPicked.type === 'iframe' && aqPicked.embedUrl) {
        setCurrentSrc('__embed__')
        setErrorMsg(aqPicked.embedUrl)
        setStatus('✅ AnimeQ (embed)')
        setProvider('AnimeQ')
        setLoading(false)
        return
      }
    } catch (aqErr) {
      console.warn('[AnimeQ] falhou:', aqErr.message)
    }

    // ── FONTE 3: AniTube (at.masterotaku487.workers.dev) ─────────────────────
    try {
      setStatus('📡 Tentando AniTube...')
      const atSrc = await resolveAniTube(animeObj, ep, dub)
      setCurrentSrc(atSrc)
      setSources([{ label: 'AniTube', url: atSrc }])
      setStatus(`✅ AniTube — ${dub ? '🎙️ Dublado' : '🇧🇷 Legendado'}`)
      setProvider('AniTube')
      setLoading(false)
      return
    } catch (atErr) {
      console.warn('[AniTube] falhou:', atErr.message)
    }

    // ── FONTE 4: AnimeFire (Render proxy + CF Worker) ─────────────────────────
    try {
      let slug = cachedAfSlug
      if (!slug) {
        setStatus('🔍 Tentando AnimeFire...')
        slug = await resolveSlug(animeObj, dub)
        setAfSlug(slug)
      }
      setStatus('📡 Buscando fontes AnimeFire...')

      let srcs = []
      try {
        const renderRes = await fetch(
          `${RENDER_PROXY}/af-sources?slug=${encodeURIComponent(slug)}&ep=${ep}`,
          { signal: AbortSignal.timeout(35000) }
        )
        const renderData = await renderRes.json()
        srcs = renderData.sources || []
      } catch (renderErr) {
        console.warn('[Render] falhou:', renderErr.message)
      }

      if (!srcs.length) {
        try {
          setStatus('🔄 Tentando CF Worker AnimeFire...')
          const data = await afFetch({ action: 'video', slug, ep })
          srcs = data.sources || []
        } catch (cfErr) {
          console.warn('[CF Worker AF] falhou:', cfErr.message)
        }
      }

      if (srcs.length) {
        const proxied = srcs.map(s => ({ ...s, url: proxyUrl(s.url), directUrl: s.url }))
        setSources(proxied)
        const best = bestQuality(proxied)
        setCurrentSrc(best?.url || '')
        setStatus(`✅ AnimeFire — ${dub ? '🎙️ Dublado' : '🇧🇷 Legendado'} — ${best?.label || 'Auto'}`)
        setProvider('AnimeFire')
        setLoading(false)
        return
      }
    } catch (afErr) {
      console.warn('[AnimeFire] falhou:', afErr.message)
    }

    // ── FONTE 5: meusanimes / goyabu (override) ───────────────────────────────
    try {
      const overrides  = await loadOverrides()
      const ov         = overrides[String(animeObj.mal_id)]

      const maOv = ov?.sources?.meusanimes
      if (maOv) {
        const maBase = (dub ? maOv.dub : maOv.leg) || maOv.any
        if (maBase) {
          const maSlug   = `${maBase}-episodio-${ep}`
          const embedUrl = `${RENDER_PROXY}/ma/${maSlug}`
          setCurrentSrc('__embed__'); setErrorMsg(embedUrl)
          setStatus(`✅ MeusAnimes${dub ? ' 🎙️ Dublado' : ' 📖 Legendado'} — EP${ep}`)
          setProvider('MeusAnimes')
          setLoading(false); return
        }
      }

      const gyOv = ov?.sources?.goyabu
      if (gyOv) {
        const gyId = gyOv.ids
          ? (gyOv.ids[ep - 1] || gyOv.ids[0])
          : (gyOv.id || (dub ? gyOv.dub : gyOv.leg) || gyOv.any)
        if (gyId) {
          const embedUrl = `${RENDER_PROXY}/gy/${gyId}`
          setCurrentSrc('__embed__'); setErrorMsg(embedUrl)
          setStatus(`✅ Goyabu — EP${ep}`)
          setProvider('Goyabu')
          setLoading(false); return
        }
      }
    } catch (ovErr) {
      console.warn('[fallback meusanimes/goyabu]', ovErr.message)
    }

    // ── FONTE 6: animesonlinecc.to ────────────────────────────────────────────
    try {
      const titleQuery = animeObj.title_english || animeObj.title
      setStatus('🔄 Tentando animesonlinecc.to...')
      const ccRes  = await fetch(
        `https://animeonline-proxy.masterotaku487.workers.dev/?action=episode` +
        `&title=${encodeURIComponent(titleQuery)}&ep=${ep}&dub=${dub ? '1' : '0'}`
      )
      const ccData = await ccRes.json()
      if (ccData.sources?.length) {
        const mp4s = ccData.sources.filter(s => !s.isM3U8)
        const best = bestQuality(mp4s.length ? mp4s : ccData.sources)
        setSources(ccData.sources); setCurrentSrc(best?.url || ccData.sources[0].url)
        setStatus(`✅ animesonlinecc — ${best?.label || 'Auto'}`)
        setProvider('animesonlinecc')
        setLoading(false); return
      }
      if (ccData.iframe) {
        setCurrentSrc('__embed__'); setErrorMsg(ccData.iframe)
        setStatus('✅ animesonlinecc (embed)'); setProvider('animesonlinecc')
        setLoading(false); return
      }
      if (ccData.pageUrl) {
        setCurrentSrc('__embed__')
        setErrorMsg(`${RENDER_PROXY}/res?url=${encodeURIComponent(ccData.pageUrl)}`)
        setStatus('✅ animesonlinecc (página)'); setProvider('animesonlinecc')
        setLoading(false); return
      }
    } catch (ccErr) {
      console.warn('[animesonlinecc]', ccErr.message)
    }

    // ── FONTE 7: animesonline.cloud ───────────────────────────────────────────
    try {
      const titleQuery = animeObj.title_english || animeObj.title
      setStatus('🔄 Tentando animesonline.cloud...')
      const hdRes  = await fetch(
        `https://animesonlinecloud-proxy.masterotaku487.workers.dev/?action=episode` +
        `&title=${encodeURIComponent(titleQuery)}&ep=${ep}`
      )
      const hdData = await hdRes.json()
      if (hdData.sources?.length) {
        const mp4s = hdData.sources.filter(s => !s.isM3U8)
        const best = bestQuality(mp4s.length ? mp4s : hdData.sources)
        setSources(hdData.sources); setCurrentSrc(best?.url || hdData.sources[0].url)
        setStatus(`✅ animesonline.cloud — ${best?.label || 'Auto'}`)
        setProvider('animesonline.cloud')
        setLoading(false); return
      }
      if (hdData.iframe) {
        setCurrentSrc('__embed__')
        setErrorMsg(`${RENDER_PROXY}/res?url=${encodeURIComponent(hdData.iframe)}`)
        setStatus('✅ animesonline.cloud (embed)'); setProvider('animesonline.cloud')
        setLoading(false); return
      }
    } catch (hdErr) {
      console.warn('[animesonlinecloud]', hdErr.message)
    }

    // ── FONTE 8: animesfontes-proxy ───────────────────────────────────────────
    try {
      const titleQuery = animeObj.title_english || animeObj.title
      setStatus('🔄 Tentando AnimeFontes...')
      const afontesRes  = await fetch(
        `${RENDER_PROXY}/episode?title=${encodeURIComponent(titleQuery)}&ep=${ep}&dub=${dub ? '1' : '0'}`,
        { signal: AbortSignal.timeout(30000) }
      )
      const afontesData = await afontesRes.json()
      if (afontesData.sources?.length) {
        const mp4s = afontesData.sources.filter(s => !s.isM3U8)
        const best = bestQuality(mp4s.length ? mp4s : afontesData.sources)
        setSources(afontesData.sources); setCurrentSrc(best?.url || afontesData.sources[0].url)
        setStatus(`✅ AnimeFontes — ${best?.label || 'Auto'}`)
        setProvider('AnimeFontes')
        setLoading(false); return
      }
      if (afontesData.iframe) {
        setCurrentSrc('__embed__'); setErrorMsg(afontesData.iframe)
        setStatus('✅ AnimeFontes (embed)'); setProvider('AnimeFontes')
        setLoading(false); return
      }
    } catch (afErr) {
      console.warn('[animesfontes]', afErr.message)
    }

    // Nenhuma fonte funcionou
    setError(true)
    setErrorMsg('Todas as fontes falharam para este episódio.')
    setLoading(false)
  }

  useEffect(() => {
    if (anime) {
      doLoad(anime, epNum, isDub, adSlug, aqSlug, afSlug)
      const t = anime.title_english || anime.title || 'Anime'
      document.title = `${t} EP ${epNum} - Assistir | Up Anime+`
      saveHistory(anime, epNum)
    }
  }, [anime, epNum, isDub])

  const goEp = (n) => setSearchParams({ ep: n, ...(isDub ? { dub: '1' } : {}) })
  const toggleDub = () => { setAfSlug(null); setAdSlug(null); setAqSlug(null); setSearchParams({ ep: epNum, ...(!isDub ? { dub: '1' } : {}) }) }

  const loadMoreEps = async () => {
    const next = epPage + 1
    const data = await getAnimeEpisodes(id, next)
    setEpisodes(p => [...p, ...(data.data || [])])
    setHasMoreEps(data.pagination?.has_next_page || false)
    setEpPage(next)
  }

  const title      = anime?.title_english || anime?.title || ''
  const synopsis   = useTranslatedSynopsis(anime?.synopsis)
  const adExternal = adSlug
    ? `${AD_BASE}/anime/${adSlug}`
    : AD_BASE
  const afExternal = afSlug
    ? `https://animefire.io/animes/${afSlug}`
    : `https://animefire.io`
  const prevEp   = epNum > 1 ? epNum - 1 : null
  const nextEp   = anime?.episodes && epNum < anime.episodes ? epNum + 1 : null
  const epTitle  = episodes.find(e => e.mal_id === epNum)?.title || `Episódio ${epNum}`
  const filename = `${title} - EP${String(epNum).padStart(2, '0')}.mp4`

  // Badge de provider para mostrar na UI
  const providerLabel = {
    'DriveA':            '🚀 S1 AnimesDrive',
    'AnimeQ':            '⚡ S2 AnimeQ',
    'AniTube':           '📺 S3 AniTube',
    'AnimeFire':         '🇧🇷 AnimeFire',
    'MeusAnimes':        '📺 MeusAnimes',
    'Goyabu':            '🎌 Goyabu',
    'animesonlinecc':    '🌐 animesonlinecc',
    'animesonline.cloud':'☁️ animesonline.cloud',
    'AnimeFontes':       '🔁 AnimeFontes',
  }[provider] || provider

  const srvDot = (ok) =>
    ok === null ? '⚪' : ok ? '🟢' : '🔴'

  return (
    <div className="watch-page">

      {newAchievements.length > 0 && (
        <div className="achievement-toasts">
          {newAchievements.map(a => (
            <div key={a.id} className="achievement-toast">
              <span className="ach-toast-icon">{a.icon}</span>
              <div>
                <span className="ach-toast-label">Conquista desbloqueada!</span>
                <span className="ach-toast-title">{a.title}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="watch-layout">
        <div className="watch-main">

          {/* Player */}
          <div className="player-wrap">
            {loading ? (
              <div className="player-loading">
                <div className="loading-ring" />
                <img src="/logo.png" className="loading-logo" alt="" />
                <p className="loading-text">{status}</p>
                <p className="loading-sub">
                  {status.includes('DriveA') || status.includes('animesdrive')
                    ? 'Fonte: 🚀 animesdrive.online via DriveA'
                    : status.includes('AnimeFire')
                    ? 'Fonte: 🇧🇷 AnimeFire via Cloudflare'
                    : '🔄 Buscando fontes...'}
                </p>
              </div>
            ) : error && fallbackUrl ? (
              <iframe
                key={fallbackUrl}
                src={fallbackUrl}
                style={{ width: '100%', height: '100%', border: 'none', background: '#000' }}
                allowFullScreen
                allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
                title={`${title} EP${epNum}`}
              />
            ) : error ? (
              <div className="player-error">
                <span className="error-emoji">😕</span>
                <h3>Erro ao carregar o player</h3>
                <p className="error-hint">Tente novamente ou abra em outro player.</p>
                <div className="error-btns">
                  <button className="btn btn-primary" onClick={() => doLoad(anime, epNum, isDub, null, null)}>
                    🔄 Tentar novamente
                  </button>
                  {currentSrc && (
                    <button className="btn btn-ghost" onClick={() => openMXPlayer(currentSrc, `${title} EP${epNum}`)}>
                      🎬 Abrir no MX Player
                    </button>
                  )}
                  <a href={adExternal} target="_blank" rel="noreferrer" className="btn btn-ghost">
                    🚀 Ver no AnimesDrive
                  </a>
                </div>
              </div>
            ) : currentSrc === '__embed__' ? (
              <iframe
                key={errorMsg}
                src={errorMsg}
                style={{ width: '100%', height: '100%', border: 'none', background: '#000' }}
                allowFullScreen
                allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-pointer-lock allow-presentation"
                title={`${title} EP${epNum}`}
              />
            ) : currentSrc ? (
              <VideoPlayer
                key={currentSrc}
                src={currentSrc}
                title={`${title} EP${epNum}`}
                animeId={id}
                epNum={epNum}
                sources={sources}
                onQualityChange={(url) => setCurrentSrc(url)}
                onEpisodeWatched={() => {
                  if (!anime) return
                  const genres  = anime.genres?.map(g => g.name) || []
                  const unlocked = recordWatched({
                    malId: parseInt(id), ep: epNum,
                    totalEps: anime.episodes || 0, genres,
                  })
                  if (unlocked.length) {
                    setNewAchievements(unlocked)
                    setTimeout(() => setNewAchievements([]), 5000)
                  }
                }}
                onError={() => {
                  const directUrl = sources.find(s => s.url === currentSrc)?.directUrl
                  if (directUrl && currentSrc !== directUrl) setCurrentSrc(directUrl)
                  else setError(true)
                }}
              />
            ) : null}
          </div>

          {/* Dub / Leg + Qualidade */}
          <div className="audio-track-bar">
            <span className="audio-label">🎧 Áudio:</span>
            <div className="audio-toggle">
              <button className={`track-btn ${!isDub ? 'active' : ''}`} onClick={() => isDub && toggleDub()}>
                🇧🇷 Legendado
              </button>
              <button className={`track-btn ${isDub ? 'active' : ''}`} onClick={() => !isDub && toggleDub()}>
                🎙️ Dublado
              </button>
            </div>
            {sources.length > 1 && (
              <div className="quality-wrap">
                <span>📺</span>
                {sources.map((s, i) => (
                  <button
                    key={s.url}
                    className={`track-btn${currentSrc === s.url ? ' active' : ''}`}
                    onClick={() => setCurrentSrc(s.url)}
                  >
                    {s.label || `Fonte ${i + 1}`}
                  </button>
                ))}
              </div>
            )}
            {!loading && !error && (
              <span className="provider-tag" style={{ marginLeft: 'auto' }}>
                {providerLabel}
              </span>
            )}
          </div>

          {/* Status dos Servidores */}
          <div className="server-status-bar">
            <span className="srv-label">Servidores:</span>
            <span className={`srv-chip${provider === 'DriveA' ? ' active' : ''}`}
              title="animesdrive.online">
              {srvDot(serverStatus.driveA)} S1 AnimesDrive
            </span>
            <span className={`srv-chip${provider === 'AnimeQ' ? ' active' : ''}`}
              title="animeq.net">
              {srvDot(serverStatus.animeQ)} S2 AnimeQ
            </span>
            <span className={`srv-chip${provider === 'AniTube' ? ' active' : ''}`}
              title="anitube.zip">
              {srvDot(serverStatus.aniTube)} S3 AniTube
            </span>
          </div>

          {/* Ações */}
          <div className="ext-actions">
            {currentSrc && (
              <>
                <button className="ext-btn"
                  onClick={() => window.open(`https://www.webvideocast.com/play?url=${encodeURIComponent(currentSrc)}`, '_blank')}>
                  📡<span>Cast TV</span>
                </button>
                <button className="ext-btn" onClick={() => openADM(currentSrc, filename)}>
                  ⬇️<span>Baixar</span>
                </button>
                <button className="ext-btn"
                  onClick={() => isMobile ? openMXPlayer(currentSrc, `${title} EP${epNum}`) : openVLC(currentSrc, `${title} EP${epNum}`)}>
                  {isMobile ? <><span>🎬</span><span>MX Player</span></> : <><span>🖥️</span><span>VLC Player</span></>}
                </button>
              </>
            )}
            <a href={adExternal} target="_blank" rel="noreferrer" className="ext-btn">
              🚀<span>AnimesDrive</span>
            </a>
            <div className="share-container">
              <button className="ext-btn" onClick={() => setShowShare(o => !o)}>🔗<span>Share</span></button>
              {showShare && (
                <div className="share-dropdown">
                  <button onClick={() => {
                    navigator.clipboard.writeText(window.location.href)
                    setCopied(true); setTimeout(() => setCopied(false), 2000)
                  }}>{copied ? '✅ Copiado!' : '📋 Copiar link'}</button>
                  <a href={`https://wa.me/?text=${encodeURIComponent(`🔥 ${title} EP${epNum}\n${window.location.href}`)}`}
                    target="_blank" rel="noreferrer">💬 WhatsApp</a>
                  <a href={adExternal} target="_blank" rel="noreferrer">🚀 AnimesDrive</a>
                </div>
              )}
            </div>
          </div>

          {/* Nav */}
          <div className="ep-navigator">
            <button className="ep-nav-btn" disabled={!prevEp} onClick={() => prevEp && goEp(prevEp)}>
              <FiChevronLeft /> {prevEp ? `EP ${prevEp}` : '—'}
            </button>
            <div className="ep-nav-center">
              <span className="ep-nav-num">Episódio {epNum}</span>
              <span className="ep-nav-title">{epTitle}</span>
            </div>
            <button className="ep-nav-btn" disabled={!nextEp} onClick={() => nextEp && goEp(nextEp)}>
              {nextEp ? `EP ${nextEp}` : '—'} <FiChevronRight />
            </button>
          </div>

          {/* Info */}
          {anime && (
            <div className="watch-info-bar">
              <Link to={`/anime/${id}`} className="back-link">← {title}</Link>
              <h1 className="watch-anime-title">{title}</h1>
              <div className="watch-badges">
                {isDub ? <span className="wbadge dub">🎙️ Dublado</span> : <span className="wbadge sub">🇧🇷 Legendado</span>}
                {anime.score && <span className="wbadge">⭐ {anime.score.toFixed(1)}</span>}
                {anime.status === 'Currently Airing' && <span className="wbadge live">🔴 Em Exibição</span>}
                {anime.type && <span className="wbadge">{anime.type}</span>}
              </div>
              {synopsis && (
                <p className="watch-synopsis">{synopsis.slice(0, 300)}{synopsis.length > 300 ? '...' : ''}</p>
              )}
            </div>
          )}

          <Comments animeId={id} ep={epNum} />

          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
            <button className="report-ep-btn" onClick={() => setShowBugReport(true)}>
              🐛 Relatar problema nesse episódio
            </button>
          </div>

          {showBugReport && (
            <FeedbackModal
              animeId={id}
              ep={epNum}
              animeTitle={title}
              onClose={() => setShowBugReport(false)}
            />
          )}
        </div>

        {/* Sidebar */}
        <aside className="ep-sidebar">
          <div className="sidebar-head">
            <span>📋 Episódios</span>
            {anime?.episodes && <span className="ep-count-badge">{anime.episodes}</span>}
          </div>
          <div className="ep-scroll">
            {episodes.map(ep => (
              <button key={ep.mal_id} className={`ep-row ${ep.mal_id === epNum ? 'playing' : ''}`} onClick={() => goEp(ep.mal_id)}>
                <span className="ep-row-num">{ep.mal_id}</span>
                <div className="ep-row-info">
                  <span className="ep-row-title">{ep.title || `Episódio ${ep.mal_id}`}</span>
                  {ep.aired && <span className="ep-row-date">{new Date(ep.aired).toLocaleDateString('pt-BR')}</span>}
                </div>
                {ep.mal_id === epNum && <span className="now-playing">▶</span>}
              </button>
            ))}
            {hasMoreEps && <button className="load-more-btn" onClick={loadMoreEps}>⬇ Carregar mais</button>}
          </div>
        </aside>
      </div>
    </div>
  )
}
