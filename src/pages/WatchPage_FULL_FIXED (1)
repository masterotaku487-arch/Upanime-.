import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useSearchParams, Link } from 'react-router-dom'
import { FiChevronLeft, FiChevronRight } from 'react-icons/fi'
import { getAnimeById, getAnimeEpisodes } from '../services/api'
import { useTranslatedSynopsis } from '../services/translate'
import { saveHistory } from '../services/history'
import { recordWatched } from '../services/achievements'
import VideoPlayer from '../components/VideoPlayer'
import Comments from '../components/Comments'
import FeedbackModal from '../components/FeedbackModal'
import './WatchPage.css'

// ─────────────────────────────────────────────────────────
// CONFIGURAÇÃO DOS WORKERS (V2 UNIFICADO)
// ─────────────────────────────────────────────────────────
const AF_V2 = 'https://animefire-v2.masterotaku487.workers.dev'
const RENDER_PROXY = 'https://animesfontes-proxy.onrender.com'

// Função de Proxy de Streaming (CRÍTICA PARA O TOKEN FUNCIONAR)
const proxyUrl = (url) => {
  if (!url || url.startsWith('__embed__')) return url
  return `${AF_V2}?action=stream&url=${encodeURIComponent(url)}`
}

const afFetch = async (params) => {
  const qs = new URLSearchParams(params).toString()
  const r = await fetch(`${AF_V2}?${qs}`)
  if (!r.ok) throw new Error(`Proxy ${r.status}`)
  return r.json()
}

// ─────────────────────────────────────────────────────────
// HELPERS ORIGINAIS
// ─────────────────────────────────────────────────────────
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

const stripSubtitle = (s) => s.replace(/\s*[:–]\s*.+$/, '').trim()

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

const loadOverrides = async () => {
  try {
    const res = await fetch('/slug-overrides.json?_t=' + Date.now())
    const json = await res.json()
    return json.animes || {}
  } catch { return {} }
}

const probeSlug = async (slug, isMovie = false) => {
  try {
    const data = await afFetch({ action: 'info', slug })
    if (data.episodes?.length > 0) return slug
    if (isMovie && data.slug) return slug
  } catch { }
  return null
}

const resolveSlug = async (anime, dub = false) => {
  const isMovie = ['Movie', 'OVA', 'Special', 'TV Special', 'Music'].includes(anime.type)
  const overrides = await loadOverrides()
  const ov = overrides[String(anime.mal_id)]
  if (ov) {
    const slug = (dub && ov.dub) ? ov.dub : ov.leg
    if (slug) return slug
  }

  const candidates = buildSlugCandidates(anime, dub)
  for (const slug of candidates) {
    const found = await probeSlug(slug, isMovie)
    if (found) return found
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
    if (u.searchParams.get('url')) return decodeURIComponent(u.searchParams.get('url'))
  } catch {}
  return url
}

const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)

const openVLC = (url, title) => {
  const directUrl = getDirectUrl(url)
  window.location.href = `vlc://${directUrl}`
  setTimeout(() => { if (!document.hidden) window.open(directUrl, '_blank') }, 1500)
}

const openMXPlayer = (url, title) => {
  const directUrl = getDirectUrl(url)
  const titleEnc  = encodeURIComponent(title)
  const referer   = encodeURIComponent('https://animefire.io')
  const ua        = encodeURIComponent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36')
  const intentFree = `intent:${directUrl}#Intent;action=android.intent.action.VIEW;type=video/*;package=com.mxtech.videoplayer.ad;S.title=${titleEnc};S.headers_Referer=${referer};S.headers_User-Agent=${ua};end`
  window.location.href = intentFree
}

const openADM = (url, fn) => {
  window.location.href = `adm://add?url=${encodeURIComponent(url)}&filename=${encodeURIComponent(fn)}`
  setTimeout(() => window.open(url, '_blank'), 900)
}

// ─────────────────────────────────────────────────────────
// COMPONENTE PRINCIPAL
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
  const [status, setStatus] = useState('🇧🇷 Conectando ao AnimeFire...')
  const [error, setError] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [showShare, setShowShare] = useState(false)
  const [copied, setCopied] = useState(false)
  const [newAchievements, setNewAchievements] = useState([])
  const [showBugReport,   setShowBugReport]   = useState(false)
  const [fallbackUrl,     setFallbackUrl]     = useState(null)

  useEffect(() => {
    setAnime(null); setEpisodes([]); setAfSlug(null)
    Promise.allSettled([getAnimeById(id), getAnimeEpisodes(id, 1)]).then(([d, e]) => {
      if (d.status === 'fulfilled') {
        const a = d.value.data
        setAnime(a)
        document.title = `${a.title_english || a.title || 'Anime'} EP ${epNum} - Assistir | Up Anime+`
      }
      if (e.status === 'fulfilled') {
        setEpisodes(e.value.data || [])
        setHasMoreEps(e.value.pagination?.has_next_page || false)
      }
    })
    window.scrollTo(0, 0)
    return () => { document.title = 'Up Anime+ | Assistir Animes Online Grátis em HD' }
  }, [id])

  const doLoad = async (animeObj, ep, dub, cachedSlug) => {
    setLoading(true); setError(false); setSources([]); setCurrentSrc(''); setFallbackUrl(null)
    try {
      const overrides = await loadOverrides()
      const ov = overrides[String(animeObj.mal_id)]
      const fbUrl = ov?.fallback?.[String(ep)]
      if (fbUrl) { setFallbackUrl(fbUrl); setError(true); setLoading(false); return }
    } catch {}

    try {
      let slug = cachedSlug
      if (!slug) {
        setStatus('🔍 Localizando no AnimeFire...')
        slug = await resolveSlug(animeObj, dub)
        setAfSlug(slug)
      }
      setStatus(`📡 Carregando EP${ep}...`)
      
      // Busca fontes via Worker Unificado
      const cfData = await afFetch({ action: 'video', slug, ep })
      const srcs = cfData.sources || []
      
      if (!srcs.length) throw new Error(`EP${ep} sem fontes (slug: ${slug})`)

      // APLICA O PROXY DE STREAMING EM TODAS AS FONTES
      const proxiedSrcs = srcs.map(s => ({
        ...s,
        url: proxyUrl(s.url),
        directUrl: s.url,
      }))
      
      setSources(proxiedSrcs)
      const best = bestQuality(proxiedSrcs)
      setCurrentSrc(best?.url || '')
      setStatus(`✅ ${dub ? '🎙️ Dublado' : '🇧🇷 Legendado'} — ${best?.label || 'Auto'}`)

    } catch (e) {
      console.warn('[AnimeFire] falhou, tentando fontes alternativas...', e.message)
      // Aqui você pode manter os fallbacks de embed se desejar, 
      // mas o foco é fazer o Worker V2 funcionar primeiro.
      setError(true)
      setErrorMsg(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (anime) {
      doLoad(anime, epNum, isDub, afSlug)
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
                <p className="loading-sub">Fonte: 🇧🇷 AnimeFire via Cloudflare V2</p>
              </div>
            ) : error && fallbackUrl ? (
              <iframe key={fallbackUrl} src={fallbackUrl} style={{ width: '100%', height: '100%', border: 'none', background: '#000' }} allowFullScreen title="Fallback" />
            ) : error ? (
              <div className="player-error">
                <span className="error-emoji">😕</span>
                <h3>Erro ao carregar o player</h3>
                <div className="error-btns">
                  <button className="btn btn-primary" onClick={() => doLoad(anime, epNum, isDub, null)}>🔄 Tentar novamente</button>
                  <a href={afExternal} target="_blank" rel="noreferrer" className="btn btn-ghost">🇧🇷 Ver no AnimeFire</a>
                </div>
              </div>
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
                  const unlocked = recordWatched({
                    malId: parseInt(id), ep: epNum,
                    totalEps: anime.episodes || 0, genres: anime.genres?.map(g => g.name) || [],
                  })
                  if (unlocked.length) {
                    setNewAchievements(unlocked)
                    setTimeout(() => setNewAchievements([]), 5000)
                  }
                }}
              />
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
                <select className="quality-select" value={currentSrc} onChange={e => setCurrentSrc(e.target.value)}>
                  {sources.map(s => <option key={s.url} value={s.url}>{s.label || 'Auto'}</option>)}
                </select>
              </div>
            )}
          </div>

          <div className="ext-actions">
            {currentSrc && (
              <>
                <button className="ext-btn" onClick={() => window.open(`https://www.webvideocast.com/play?url=${encodeURIComponent(currentSrc)}`, '_blank')}>📡<span>Cast TV</span></button>
                <button className="ext-btn" onClick={() => openADM(currentSrc, filename)}>⬇️<span>Baixar</span></button>
                <button className="ext-btn" onClick={() => isMobile ? openMXPlayer(currentSrc, `${title} EP${epNum}`) : openVLC(currentSrc, `${title} EP${epNum}`)}>
                  {isMobile ? <><span>🎬</span><span>MX Player</span></> : <><span>🖥️</span><span>VLC Player</span></>}
                </button>
              </>
            )}
            <a href={afExternal} target="_blank" rel="noreferrer" className="ext-btn">🇧🇷<span>AnimeFire</span></a>
          </div>

          <div className="ep-navigator">
            <button className="ep-nav-btn" disabled={!prevEp} onClick={() => prevEp && goEp(prevEp)}><FiChevronLeft /> {prevEp ? `EP ${prevEp}` : '—'}</button>
            <div className="ep-nav-center"><span className="ep-nav-num">Episódio {epNum}</span></div>
            <button className="ep-nav-btn" disabled={!nextEp} onClick={() => nextEp && goEp(nextEp)}>{nextEp ? `EP ${nextEp}` : '—'} <FiChevronRight /></button>
          </div>

          {anime && (
            <div className="watch-info-bar">
              <Link to={`/anime/${id}`} className="back-link">← {title}</Link>
              <h1 className="watch-anime-title">{title}</h1>
              <p className="watch-synopsis">{synopsis}</p>
            </div>
          )}
          <Comments animeId={id} ep={epNum} />
        </div>

        <aside className="ep-sidebar">
          <div className="sidebar-head"><span>📋 Episódios</span></div>
          <div className="ep-scroll">
            {episodes.map(ep => (
              <button key={ep.mal_id} className={`ep-row ${ep.mal_id === epNum ? 'playing' : ''}`} onClick={() => goEp(ep.mal_id)}>
                <span className="ep-row-num">{ep.mal_id}</span>
                <span className="ep-row-title">{ep.title || `Episódio ${ep.mal_id}`}</span>
              </button>
            ))}
            {hasMoreEps && <button className="load-more-btn" onClick={loadMoreEps}>⬇ Carregar mais</button>}
          </div>
        </aside>
      </div>
    </div>
  )
}
