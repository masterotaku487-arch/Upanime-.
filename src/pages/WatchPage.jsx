import { useState, useEffect, useCallback } from 'react'
import { useParams, useSearchParams, Link } from 'react-router-dom'
import { FiChevronLeft, FiChevronRight } from 'react-icons/fi'
import { getAnimeById, getAnimeEpisodes } from '../services/api'
import { useTranslatedSynopsis } from '../services/translate'
import { saveHistory } from '../services/history'
import { recordWatched, ACHIEVEMENTS } from '../services/achievements'
import {
  searchAnimes,
  fetchEpisodes,
  fetchVideoSources,
  createProxyUrl,
  resolveBloggerPlayer
} from '../services/animesDrive'
import VideoPlayer from '../components/VideoPlayer'
import Comments from '../components/Comments'
import FeedbackModal from '../components/FeedbackModal'
import './WatchPage.css'

// ─────────────────────────────────────────────────────────
// STREAMING via AnimeFire (animefire.io)
// IMPORTANTE: usa /api/animefire local (não o Worker externo)
// Assim o token CDN fica com o IP do Vercel, e o /api/proxy
// streama do mesmo IP → CDN aceita ✅
// ─────────────────────────────────────────────────────────

const AF = 'https://animefire-proxy.masterotaku487.workers.dev'
const RENDER_PROXY = 'https://animesfontes-proxy.onrender.com'

// Redireciona vídeo pelo Vercel proxy (adiciona Referer correto)
const proxyUrl = (url) =>
  `/api/proxy?url=${encodeURIComponent(url)}`

const afFetch = async (params) => {
  const qs = new URLSearchParams(params).toString()
  const r = await fetch(`${AF}?${qs}`, { signal: AbortSignal.timeout(30000) })
  if (!r.ok) throw new Error(`Proxy ${r.status}`)
  return r.json()
}

// Converte título em slug no padrão AnimeFire
const slugify = (s) =>
  s.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/['":`]/g, '')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .trim().replace(/\s+/g, '-').replace(/-+/g, '-')

// Remove sufixos de temporada
const stripSeason = (s) =>
  s.replace(/\s*[-–:]\s*(season|parte?|part|cour)\s*\d*/gi, '')
   .replace(/\s+\d+(st|nd|rd|th)\s*(season|cour)/gi, '')
   .replace(/\s+(the\s+)?(final|last|new)\s+season/gi, '')
   .replace(/\s+(season|parte?|part)\s*\d*/gi, '')
   .replace(/\s+\d+$/g, '').trim()

const stripSubtitle = (s) => s.replace(/\s*[:–]\s*.+$/, '').trim()

// Gera candidatos de slug — SEM usar busca, testa diretamente
// Padrão AnimeFire: {slug}-todos-os-episodios (leg) | {slug}-dublado-todos-os-episodios (dub)
const buildSlugCandidates = (anime, dub = false) => {
  const titles = [
    anime.title,
    anime.title_english,
    anime.title_portuguese,
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

  // Prioridade: título com season > título sem season
  const withSeason = []
  const withoutSeason = []

  for (const base of bases) {
    const isFull = [...bases].some(b => b !== base && base.startsWith(b))
    const target = isFull ? withSeason : withoutSeason

    if (dub) {
      target.push(base + '-dublado-todos-os-episodios')
      target.push(base + '-dublado')
    } else {
      target.push(base + '-todos-os-episodios')
    }
    target.push(base)
  }

  return [...new Set([...withSeason, ...withoutSeason])]
}

// Cache do slug-overrides.json — editável no GitHub sem redeploy
let _overridesCache = null
const loadOverrides = async () => {
  if (_overridesCache) return _overridesCache
  try {
    const res = await fetch('/slug-overrides.json?_t=' + Date.now())
    const json = await res.json()
    _overridesCache = json.animes || {}
  } catch { _overridesCache = {} }
  return _overridesCache
}

// Testa se slug existe E tem episódios no AnimeFire
const probeSlug = async (slug, isMovie = false) => {
  try {
    const data = await afFetch({ action: 'info', slug })
    if (data.episodes?.length > 0) return slug
    if (isMovie && data.slug) return slug
  } catch { /* não existe */ }
  return null
}

// Resolve slug correto testando candidatos
const resolveSlug = async (anime, dub = false) => {
  const isMovie = ['Movie', 'OVA', 'Special', 'TV Special', 'Music'].includes(anime.type)
  const overrides = await loadOverrides()
  const ov = overrides[String(anime.mal_id)]
  if (ov) {
    const slug = (dub && ov.dub) ? ov.dub : ov.leg
    if (slug) { console.log('[AnimeFire] ✅ (override)', slug); return slug }
  }

  const candidates = buildSlugCandidates(anime, dub)
  console.log('[AnimeFire] testando slugs:', candidates.join(', '))

  if (isMovie) {
    for (const slug of candidates) {
      try {
        const data = await afFetch({ action: 'video', slug, ep: 1 })
        if (data.sources?.length > 0) {
          console.log('[AnimeFire] ✅ (movie/ova direct)', slug)
          return slug
        }
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
    if (u.pathname.includes('/api/proxy')) {
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
  setTimeout(() => {
    if (!document.hidden) {
      window.open(directUrl, '_blank')
    }
  }, 1500)
}

const openMXPlayer = (url, title) => {
  const directUrl = getDirectUrl(url)
  const titleEnc  = encodeURIComponent(title)
  const referer   = encodeURIComponent('https://animesdrive.online')
  const ua        = encodeURIComponent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36')

  const intentFree = `intent:${directUrl}#Intent;action=android.intent.action.VIEW;type=video/*;package=com.mxtech.videoplayer.ad;S.title=${titleEnc};S.headers_Referer=${referer};S.headers_User-Agent=${ua};end`
  const intentPro  = `intent:${directUrl}#Intent;action=android.intent.action.VIEW;type=video/*;package=com.mxtech.videoplayer.pro;S.title=${titleEnc};S.headers_Referer=${referer};S.headers_User-Agent=${ua};end`

  window.location.href = intentFree
  setTimeout(() => {
    if (!document.hidden) window.location.href = intentPro
  }, 1000)
}
const openADM = (url, fn) => {
  window.location.href = `adm://add?url=${encodeURIComponent(url)}&filename=${encodeURIComponent(fn)}`
  setTimeout(() => window.open(url, '_blank'), 900)
}

// ─────────────────────────────────────────────────────────
export default function WatchPage() {
  const { id } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const epNum = parseInt(searchParams.get('ep') || '1')
  const isDub = searchParams.get('dub') === '1'

  const [anime, setAnime] = useState(null)
  const [episodes, setEpisodes] = useState([])
  const [hasMoreEps, setHasMoreEps] = useState(false)
  const [epPage, setEpPage] = useState(1)

  const [sources, setSources] = useState([])
  const [currentSrc, setCurrentSrc] = useState('')
  const [afSlug, setAfSlug] = useState(null)
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState('🇧🇷 Conectando...')
  const [error, setError] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [showShare, setShowShare] = useState(false)
  const [copied, setCopied] = useState(false)
  const [newAchievements, setNewAchievements] = useState([])
  const [showBugReport,   setShowBugReport]   = useState(false)
  const [fallbackUrl,     setFallbackUrl]     = useState(null)
  const [provider,        setProvider]        = useState('')

  useEffect(() => {
    setAnime(null); setEpisodes([]); setAfSlug(null)
    Promise.allSettled([getAnimeById(id), getAnimeEpisodes(id, 1)]).then(([d, e]) => {
      if (d.status === 'fulfilled') {
        const a = d.value.data
        setAnime(a)
        const t = a.title_english || a.title || 'Anime'
        const epNum = searchParams.get('ep') || '1'
        document.title = `${t} EP ${epNum} - Assistir | Up Anime+`
      }
      if (e.status === 'fulfilled') {
        setEpisodes(e.value.data || [])
        setHasMoreEps(e.value.pagination?.has_next_page || false)
      }
    })
    window.scrollTo(0, 0)
    return () => {
      document.title = 'Up Anime+ | Assistir Animes Online Grátis em HD'
    }
  }, [id])

  const doLoad = async (animeObj, ep, dub, cachedSlug) => {
    setLoading(true); setError(false); setSources([]); setCurrentSrc(''); setFallbackUrl(null); setProvider('')

    // 1. Fallback imediato do slug-overrides
    try {
      const overrides = await loadOverrides()
      const ov = overrides[String(animeObj.mal_id)]
      const fbUrl = ov?.fallback?.[String(ep)]
      if (fbUrl) {
        setFallbackUrl(fbUrl); setError(true); setLoading(false); return
      }
    } catch {}

    try {
      // ─────────────────────────────────────────────────────────
      // FONTE PRINCIPAL: AnimesDrive + Worker
      // ─────────────────────────────────────────────────────────
      try {
        setStatus('🔍 Buscando no AnimesDrive...')
        const searchTitle = animeObj.title_english || animeObj.title
        const searchResults = await searchAnimes(searchTitle)
        
        if (searchResults.length > 0) {
          let selected = searchResults[0]
          if (dub) {
            const dubbed = searchResults.find(r => r.isDub)
            if (dubbed) selected = dubbed
          }

          setStatus('📺 Carregando episódios...')
          const adEps = await fetchEpisodes(selected.url)
          
          if (adEps.length > 0) {
            const targetEp = adEps.find(e => e.number === ep) || adEps[0]
            setStatus(`📡 Buscando vídeos via Worker...`)
            const videoData = await fetchVideoSources(targetEp.url)

            if (videoData.success && videoData.results?.length > 0) {
              const processedSources = videoData.results.map(s => {
                if (s.isBlogger) return { ...s, url: s.resolveUrl || s.url, label: s.label + ' (Blogger)' }
                if (s.url.includes('.mp4') || s.label?.includes('MP4')) {
                  return { ...s, url: createProxyUrl(s.url), directUrl: s.url, label: s.label || 'MP4' }
                }
                return s
              })

              setSources(processedSources)
              const best = bestQuality(processedSources)
              setCurrentSrc(best?.url || '')
              setStatus(`✅ ${dub ? '🎙️ Dublado' : '🇧🇷 Legendado'} — ${best?.label || 'Auto'}`)
              setProvider('animesDrive')
              setLoading(false); return
            }
          }
        }
      } catch (adErr) { console.warn('[AnimesDrive] Falhou:', adErr.message) }

      // ─────────────────────────────────────────────────────────
      // FONTE SECUNDÁRIA: AnimeFire
      // ─────────────────────────────────────────────────────────
      let slug = cachedSlug
      if (!slug) {
        setStatus('🔍 Localizando no AnimeFire...')
        slug = await resolveSlug(animeObj, dub)
        setAfSlug(slug)
      }

      setStatus(`📡 Buscando fontes AnimeFire...`)
      let srcs = []
      try {
        const renderRes = await fetch(`${RENDER_PROXY}/af-sources?slug=${encodeURIComponent(slug)}&ep=${ep}`, { signal: AbortSignal.timeout(35000) })
        const renderData = await renderRes.json()
        srcs = renderData.sources || []
      } catch (renderErr) { console.warn('[Render] falhou:', renderErr.message) }

      if (!srcs.length) {
        try {
          setStatus('🔄 Tentando fonte alternativa AnimeFire...')
          const data = await afFetch({ action: 'video', slug, ep })
          srcs = data.sources || []
        } catch (cfErr) { console.warn('[CF Worker] falhou:', cfErr.message) }
      }

      if (srcs.length > 0) {
        const proxiedSrcs = srcs.map(s => ({ ...s, url: proxyUrl(s.url), directUrl: s.url }))
        setSources(proxiedSrcs)
        const best = bestQuality(proxiedSrcs)
        setCurrentSrc(best?.url || '')
        setStatus(`✅ ${dub ? '🎙️ Dublado' : '🇧🇷 Legendado'} — ${best?.label || 'Auto'}`)
        setProvider('animeFire')
        setLoading(false); return
      }

      throw new Error(`EP${ep} sem fontes`)

    } catch (e) {
      console.warn('[WatchPage] Fontes principais falharam, tentando fallbacks...', e.message)

      // ── Fallback 0: meusanimes / goyabu ───────────
      try {
        const overrides  = await loadOverrides()
        const ov         = overrides[String(animeObj.mal_id)]
        const PROXY_BASE = 'https://animesfontes-proxy.onrender.com'

        const maOv = ov?.sources?.meusanimes
        if (maOv) {
          const maBase = (dub ? maOv.dub : maOv.leg) || maOv.any
          if (maBase) {
            const embedUrl = `${PROXY_BASE}/ma/${maBase}-episodio-${ep}`
            setCurrentSrc('__embed__'); setErrorMsg(embedUrl); setStatus(`✅ MeusAnimes — EP${ep}`); setLoading(false); return
          }
        }

        const gyOv = ov?.sources?.goyabu
        if (gyOv) {
          const gyId = gyOv.ids ? (gyOv.ids[ep - 1] || gyOv.ids[0]) : (gyOv.id || (dub ? gyOv.dub : gyOv.leg) || gyOv.any)
          if (gyId) {
            const embedUrl = `${PROXY_BASE}/gy/${gyId}`
            setCurrentSrc('__embed__'); setErrorMsg(embedUrl); setStatus(`✅ Goyabu — EP${ep}`); setLoading(false); return
          }
        }
      } catch (ovErr) {}

      // ── Fallback 1: animesonlinecc ─────────────
      try {
        setStatus('🔄 Tentando animesonlinecc...')
        const ccRes = await fetch(`https://animeonline-proxy.masterotaku487.workers.dev/?action=episode&title=${encodeURIComponent(animeObj.title_english || animeObj.title)}&ep=${ep}&dub=${dub ? '1' : '0'}`)
        const ccData = await ccRes.json()
        if (ccData.sources?.length || ccData.iframe || ccData.pageUrl) {
          const src = ccData.sources?.[0]?.url || ccData.iframe || ccData.pageUrl
          const isEmbed = !ccData.sources?.length
          setSources(ccData.sources || [])
          setCurrentSrc(isEmbed ? '__embed__' : src)
          if (isEmbed) setErrorMsg(ccData.iframe || `https://animesfontes-proxy.onrender.com/res?url=${encodeURIComponent(ccData.pageUrl)}`)
          setStatus(`✅ animesonlinecc — Auto`); setLoading(false); return
        }
      } catch (ccErr) {}

      // ── Fallback 2: animesonline.cloud ─────────────
      try {
        setStatus('🔄 Tentando animesonline.cloud...')
        const hdRes = await fetch(`https://animesonlinecloud-proxy.masterotaku487.workers.dev/?action=episode&title=${encodeURIComponent(animeObj.title_english || animeObj.title)}&ep=${ep}`)
        const hdData = await hdRes.json()
        if (hdData.sources?.length) {
          const best = bestQuality(hdData.sources)
          setSources(hdData.sources); setCurrentSrc(best?.url || hdData.sources[0].url); setStatus(`✅ animesonline.cloud — Auto`); setLoading(false); return
        }
        if (hdData.iframe || hdData.pageUrl) {
          setCurrentSrc('__embed__'); setErrorMsg(`https://animesfontes-proxy.onrender.com/res?url=${encodeURIComponent(hdData.iframe || hdData.pageUrl)}`); setStatus('✅ animesonline.cloud (embed)'); setLoading(false); return
        }
      } catch (hdErr) {}

      setError(true); setErrorMsg(e.message)
    } finally { setLoading(false) }
  }

  useEffect(() => {
    if (anime) {
      doLoad(anime, epNum, isDub, afSlug)
      const t = anime.title_english || anime.title || 'Anime'
      document.title = `${t} EP ${epNum} - Assistir | Up Anime+`
      saveHistory(anime, epNum)
    }
  }, [anime, epNum, isDub])

  const goEp = (n) => setSearchParams({ ep: n, ...(isDub ? { dub: '1' } : {}) })
  const toggleDub = () => { setAfSlug(null); setSearchParams({ ep: epNum, ...(!isDub ? { dub: '1' } : {}) }) }

  const loadMoreEps = async () => {
    const next = epPage + 1
    const data = await getAnimeEpisodes(id, next)
    setEpisodes(p => [...p, ...(data.data || [])])
    setHasMoreEps(data.pagination?.has_next_page || false)
    setEpPage(next)
  }

  const title = anime?.title_english || anime?.title || ''
  const synopsis = useTranslatedSynopsis(anime?.synopsis)
  const afExternal = afSlug ? `https://animefire.io/animes/${afSlug}` : `https://animefire.io`
  const prevEp = epNum > 1 ? epNum - 1 : null
  const nextEp = anime?.episodes && epNum < anime.episodes ? epNum + 1 : null
  const epTitle = episodes.find(e => e.mal_id === epNum)?.title || `Episódio ${epNum}`
  const filename = `${title} - EP${String(epNum).padStart(2, '0')}.mp4`

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
          <div className="player-wrap">
            {loading ? (
              <div className="player-loading">
                <div className="loading-ring" />
                <img src="/logo.png" className="loading-logo" alt="" />
                <p className="loading-text">{status}</p>
                <p className="loading-sub">
                  {provider === 'animesDrive' ? '🌐 Fonte: AnimesDrive + Worker'
                   : provider === 'animeFire' ? '🇧🇷 Fonte: AnimeFire'
                   : '🔄 Buscando fontes...'}
                </p>
              </div>
            ) : error && fallbackUrl ? (
              <iframe key={fallbackUrl} src={fallbackUrl} style={{ width: '100%', height: '100%', border: 'none', background: '#000' }} allowFullScreen allow="autoplay; fullscreen; encrypted-media; picture-in-picture" title={`${title} EP${epNum}`} />
            ) : error ? (
              <div className="player-error">
                <span className="error-emoji">😕</span>
                <h3>Erro ao carregar o player</h3>
                <p className="error-hint">O player interno nao conseguiu reproduzir. Tente outra opcao abaixo.</p>
                <div className="error-btns">
                  <button className="btn btn-primary" onClick={() => doLoad(anime, epNum, isDub, null)}>🔄 Tentar novamente</button>
                  {currentSrc && <button className="btn btn-ghost" onClick={() => openMXPlayer(currentSrc, `${title} EP${epNum}`)}>🎬 Abrir no MX Player</button>}
                  <a href={afExternal} target="_blank" rel="noreferrer" className="btn btn-ghost">🇧🇷 Ver no AnimeFire</a>
                </div>
              </div>
            ) : currentSrc === '__embed__' ? (
              <iframe key={errorMsg} src={errorMsg} style={{ width: '100%', height: '100%', border: 'none', background: '#000' }} allowFullScreen allow="autoplay; fullscreen; encrypted-media; picture-in-picture" sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-pointer-lock allow-presentation" title={`${title} EP${epNum}`} />
            ) : currentSrc ? (
              <VideoPlayer key={currentSrc} src={currentSrc} title={`${title} EP${epNum}`} animeId={id} epNum={epNum} sources={sources} onQualityChange={(url) => setCurrentSrc(url)} onEpisodeWatched={() => { if (!anime) return; const genres = anime.genres?.map(g => g.name) || []; const unlocked = recordWatched({ malId: parseInt(id), ep: epNum, totalEps: anime.episodes || 0, genres }); if (unlocked.length) { setNewAchievements(unlocked); setTimeout(() => setNewAchievements([]), 5000); } }} onError={() => { const directUrl = sources.find(s => s.url === currentSrc)?.directUrl; if (directUrl && currentSrc !== directUrl) { setCurrentSrc(directUrl); } else { setError(true); } }} />
            ) : null}
          </div>

          <div className="audio-track-bar">
            <span className="audio-label">🎧 Áudio:</span>
            <div className="audio-toggle">
              <button className={`track-btn ${!isDub ? 'active' : ''}`} onClick={() => isDub && toggleDub()}>🇧🇷 Legendado</button>
              <button className={`track-btn ${isDub ? 'active' : ''}`} onClick={() => !isDub && toggleDub()}>🎙️ Dublado</button>
            </div>
            {sources.length > 1 && (
              <div className="quality-wrap">
                <span>📺</span>
                {sources.map((s, i) => (
                  <button key={s.url} className={`track-btn${currentSrc === s.url ? ' active' : ''}`} onClick={() => setCurrentSrc(s.url)}>{s.label || `Fonte ${i + 1}`}</button>
                ))}
              </div>
            )}
            {!loading && !error && (
              <span className="provider-tag" style={{ marginLeft: 'auto' }}>
                {provider === 'animesDrive' ? '🌐 AnimesDrive' : provider === 'animeFire' ? '✅ AnimeFire' : '🌐 Externo'}
              </span>
            )}
          </div>

          <div className="ext-actions">
            {currentSrc && (
              <>
                <button className="ext-btn" onClick={() => window.open(`https://www.webvideocast.com/play?url=${encodeURIComponent(currentSrc)}`, '_blank')}>📡<span>Cast TV</span></button>
                <button className="ext-btn" onClick={() => openADM(currentSrc, filename)}>⬇️<span>Baixar</span></button>
                <button className="ext-btn" onClick={() => isMobile ? openMXPlayer(currentSrc, `${title} EP${epNum}`) : openVLC(currentSrc, `${title} EP${epNum}`)}>{isMobile ? <><span>🎬</span><span>MX Player</span></> : <><span>🖥️</span><span>VLC Player</span></>}</button>
              </>
            )}
            <a href={afExternal} target="_blank" rel="noreferrer" className="ext-btn">🇧🇷<span>AnimeFire</span></a>
            <div className="share-container">
              <button className="ext-btn" onClick={() => setShowShare(o => !o)}>🔗<span>Share</span></button>
              {showShare && (
                <div className="share-dropdown">
                  <button onClick={() => { navigator.clipboard.writeText(window.location.href); setCopied(true); setTimeout(() => setCopied(false), 2000) }}>{copied ? '✅ Copiado!' : '📋 Copiar link'}</button>
                  <a href={`https://wa.me/?text=${encodeURIComponent(`🔥 ${title} EP${epNum}\n${window.location.href}`)}`} target="_blank" rel="noreferrer">💬 WhatsApp</a>
                  <a href={afExternal} target="_blank" rel="noreferrer">🇧🇷 AnimeFire</a>
                </div>
              )}
            </div>
          </div>

          <div className="ep-navigator">
            <button className="ep-nav-btn" disabled={!prevEp} onClick={() => prevEp && goEp(prevEp)}><FiChevronLeft /> {prevEp ? `EP ${prevEp}` : '—'}</button>
            <div className="ep-nav-center"><span className="ep-nav-num">Episódio {epNum}</span><span className="ep-nav-title">{epTitle}</span></div>
            <button className="ep-nav-btn" disabled={!nextEp} onClick={() => nextEp && goEp(nextEp)}>{nextEp ? `EP ${nextEp}` : '—'} <FiChevronRight /></button>
          </div>

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
              {synopsis && <p className="watch-synopsis">{synopsis.slice(0, 300)}{synopsis.length > 300 ? '...' : ''}</p>}
            </div>
          )}

          <Comments animeId={id} ep={epNum} />

          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
            <button className="report-ep-btn" onClick={() => setShowBugReport(true)}>🐛 Relatar problema nesse episódio</button>
          </div>

          {showBugReport && <FeedbackModal animeId={id} ep={epNum} animeTitle={title} onClose={() => setShowBugReport(false)} />}
        </div>

        <aside className="ep-sidebar">
          <div className="sidebar-head"><span>📋 Episódios</span>{anime?.episodes && <span className="ep-count-badge">{anime.episodes}</span>}</div>
          <div className="ep-scroll">
            {episodes.map(ep => (
              <button key={ep.mal_id} className={`ep-row ${ep.mal_id === epNum ? 'playing' : ''}`} onClick={() => goEp(ep.mal_id)}>
                <span className="ep-row-num">{ep.mal_id}</span>
                <div className="ep-row-info"><span className="ep-row-title">{ep.title || `Episódio ${ep.mal_id}`}</span>{ep.aired && <span className="ep-row-date">{new Date(ep.aired).toLocaleDateString('pt-BR')}</span>}</div>
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
