import { useState, useEffect, useCallback } from 'react'
import { useParams, useSearchParams, Link } from 'react-router-dom'
import {
  FiChevronLeft, FiChevronRight, FiCast, FiDownload, FiMonitor, FiExternalLink,
  FiShare2, FiCopy, FiCheck, FiHeadphones, FiTv, FiStar,
} from 'react-icons/fi'
import { BsFillCameraVideoFill } from 'react-icons/bs'
import { FaWhatsapp } from 'react-icons/fa'
import { getAnimeById, getAnimeEpisodes } from '../services/api'
import { useTranslatedSynopsis } from '../services/translate'
import { saveHistory } from '../services/history'
import { recordWatched, ACHIEVEMENTS } from '../services/achievements'
import VideoPlayer from '../components/VideoPlayer'
import Comments from '../components/Comments'
import FeedbackModal from '../components/FeedbackModal'
import './WatchPage.css'
import { incrementAnimeViews, addWatchHistory } from '../services/supabase'
import { useAuth } from '../context/AuthContext'

// ── Fonte única: Shinokai — integração direta autorizada ─────────────────────
const SHINOKAI_BASE = 'https://api-prod.shinokai.online'
const SHINOKAI_AES_KEY_B64 = 'LClZ5k9139ypHE4c863iIrMALnupsPH+4TUF6zhA6nk='
let shinokaiToken = null
let shinokaiLoginPromise = null

const shinokaiList = (payload) => {
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.data)) return payload.data
  if (Array.isArray(payload?.results)) return payload.results
  if (Array.isArray(payload?.episodes)) return payload.episodes
  return []
}

const shinokaiTitle = (media) => {
  if (typeof media?.title === 'string') return media.title
  if (media?.title && typeof media.title === 'object') {
    return media.title.romaji || media.title.english || media.title.native || ''
  }
  return media?.name || ''
}

const normalizeTitle = (value) => String(value || '')
  .toLowerCase()
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9\s]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const decodeBase64 = (value) => {
  const normalized = String(value).replace(/-/g, '+').replace(/_/g, '/')
  const padded = normalized + '='.repeat((4 - normalized.length % 4) % 4)
  const binary = atob(padded)
  return Uint8Array.from(binary, char => char.charCodeAt(0))
}

const decryptShinokai = async (envelope) => {
  if (!envelope?.iv || !envelope?.tag || !envelope?.payload) return envelope
  const key = await crypto.subtle.importKey(
    'raw', decodeBase64(SHINOKAI_AES_KEY_B64), { name: 'AES-GCM' }, false, ['decrypt']
  )
  const payload = decodeBase64(envelope.payload)
  const tag = decodeBase64(envelope.tag)
  const ciphertext = new Uint8Array(payload.length + tag.length)
  ciphertext.set(payload)
  ciphertext.set(tag, payload.length)
  const clear = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: decodeBase64(envelope.iv), tagLength: 128 }, key, ciphertext
  )
  return JSON.parse(new TextDecoder().decode(clear))
}

const readShinokai = async (response) => {
  const text = await response.text()
  let parsed
  try { parsed = JSON.parse(text) } catch { throw new Error(`Shinokai HTTP ${response.status}`) }
  if (!response.ok) throw new Error(parsed?.message || parsed?.error || `Shinokai HTTP ${response.status}`)
  const clear = parsed?.iv && parsed?.tag && parsed?.payload ? await decryptShinokai(parsed) : parsed
  return clear?.data && typeof clear.data === 'object' ? clear.data : clear
}

const loginShinokai = async () => {
  const response = await fetch(`${SHINOKAI_BASE}/auth/anonymous`, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: '{}',
  })
  const data = await readShinokai(response)
  shinokaiToken = data?.accessToken || data?.access_token || data?.token
  if (!shinokaiToken) throw new Error('Token anônimo ausente na resposta Shinokai')
}

const shinokaiFetch = async (path, retry = true) => {
  if (!shinokaiToken) {
    if (!shinokaiLoginPromise) shinokaiLoginPromise = loginShinokai().finally(() => { shinokaiLoginPromise = null })
    await shinokaiLoginPromise
  }
  const response = await fetch(`${SHINOKAI_BASE}${path}`, {
    headers: { Accept: 'application/json', Authorization: `Bearer ${shinokaiToken}` },
  })
  if (response.status === 401 && retry) {
    shinokaiToken = null
    return shinokaiFetch(path, false)
  }
  return readShinokai(response)
}

async function findShinokaiId(anime, epNum, dub) {
  const queries = [...new Set([anime.title_english, anime.title, anime.title_japanese].filter(Boolean))]
  let items = []
  for (const query of queries) {
    items = shinokaiList(await shinokaiFetch(`/medias?q=${encodeURIComponent(query)}`))
    if (items.length) break
  }
  if (!items.length) throw new Error('Anime não encontrado na Shinokai')
  const wanted = normalizeTitle(anime.title_english || anime.title)
  const score = (item) => {
    const title = normalizeTitle(shinokaiTitle(item))
    const exact = title && title === wanted ? 100 : 0
    const overlap = wanted.split(' ').filter(t => t.length > 2 && title.includes(t)).length
    const malMatch = anime.mal_id && item.mal_id && String(anime.mal_id) === String(item.mal_id) ? 1000 : 0
    return malMatch + exact + overlap
  }
  const ranked = [...items].sort((a, b) => score(b) - score(a))
  if (score(ranked[0]) > 0) return ranked[0].shinokai_id || ranked[0].id
  for (const item of ranked) {
    const mediaId = item.shinokai_id || item.id
    if (!mediaId) continue
    try {
      const list = shinokaiList(await shinokaiFetch(`/medias/${encodeURIComponent(mediaId)}/episodes`))
      const episode = list.find(e => Number(e.number ?? e.episodeNumber) === Number(epNum))
      const variants = Array.isArray(episode?.variants) ? episode.variants : []
      const hasWantedAudio = variants.some(v => dub
        ? /dub|dublado|pt[- ]?br|portuguese/i.test(JSON.stringify(v))
        : /sub|leg|legendado|japanese/i.test(JSON.stringify(v)))
      const countMatches = !anime.episodes || list.length === Number(anime.episodes)
      if (episode && hasWantedAudio && countMatches) return mediaId
    } catch {}
  }
  return ranked[0].shinokai_id || ranked[0].id
}

async function getShinokaiEp(mediaId, epNum, dub) {
  const episodes = shinokaiList(await shinokaiFetch(`/medias/${encodeURIComponent(mediaId)}/episodes`))
  const ep = episodes.find(e => Number(e.number ?? e.episodeNumber) === Number(epNum))
  if (!ep) throw new Error(`EP ${epNum} não encontrado na Shinokai`)
  const variants = Array.isArray(ep.variants) ? ep.variants : []
  const hasDub = (variant) => /dub|dublado|pt[- ]?br|portuguese/i.test(JSON.stringify(variant))
  const hasLeg = (variant) => /sub|leg|legendado|japanese/i.test(JSON.stringify(variant))
  const chosen = (dub ? variants.find(hasDub) : variants.find(hasLeg)) || variants[0]
  if (!chosen) throw new Error('Nenhuma variante disponível')
  return { epId: ep.id, varId: chosen.id || chosen.variantId || ep.id, label: chosen.label || chosen.audioType || (dub ? 'Dublado' : 'Legendado') }
}

async function resolveShinokai(anime, ep, dub) {
  const mediaId = await findShinokaiId(anime, ep, dub)
  const { epId, varId, label } = await getShinokaiEp(mediaId, ep, dub)
  const data = await shinokaiFetch(`/medias/${encodeURIComponent(mediaId)}/episodes/${encodeURIComponent(epId)}/play?variantId=${encodeURIComponent(varId)}`)
  const url = data?.url || data?.videoUrl || data?.playUrl || data?.source?.url
  if (!url) throw new Error('URL de vídeo vazia na Shinokai')
  return { url, label }
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
  const referer   = encodeURIComponent('https://shinokai.online/')
  const ua        = encodeURIComponent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36')
  const intentFree = `intent:${directUrl}#Intent;action=android.intent.action.VIEW;type=video/*;package=com.mxtech.videoplayer.ad;S.title=${titleEnc};S.headers_Referer=${referer};S.headers_User-Agent=${ua};end`
  const intentPro  = `intent:${directUrl}#Intent;action=android.intent.action.VIEW;type=video/*;package=com.mxtech.videoplayer.pro;S.title=${titleEnc};S.headers_Referer=${referer};S.headers_User-Agent=${ua};end`
  window.location.href = intentFree
  setTimeout(() => { if (!document.hidden) window.location.href = intentPro }, 1000)
}

// Baixa via blob: com <a download> puro, se o CDN não manda o header
// Content-Disposition (nenhum dos nossos manda), o navegador ignora o
// atributo "download" em link cross-origin e só abre/reproduz o vídeo.
// Buscando como blob primeiro, o "Salvar como" é forçado de verdade.
// Importante: usa a URL PROXIED (currentSrc, não getDirectUrl) porque
// os workers de proxy já liberam CORS e mandam o Referer certo — a URL
// crua do CDN muitas vezes bloqueia o fetch().
const downloadDirect = async (url, fn) => {
  try {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const blob = await res.blob()
    const blobUrl = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = blobUrl
    a.download = fn || 'episodio.mp4'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(blobUrl), 60000)
  } catch (err) {
    console.warn('[download] blob falhou, abrindo em nova aba pra salvar manualmente:', err.message)
    window.open(getDirectUrl(url), '_blank')
  }
}

// Abre app de cast (Web Video Cast) via intent Android — mesmo padrão que já
// funciona na página de Fan-Dub, agora usando a URL direta do vídeo
const openCastTV = (url) => {
  const directUrl = getDirectUrl(url)
  window.location.href = `intent:${directUrl}#Intent;package=com.instantbits.cast.webvideo;action=android.intent.action.VIEW;type=video/*;end`
  setTimeout(() => {
    if (!document.hidden) window.open('https://play.google.com/store/apps/details?id=com.instantbits.cast.webvideo', '_blank')
  }, 2000)
}

// TapTap (downloader/cast para TV) — não achamos um esquema de intent oficial
// documentado, então usamos o share sheet nativo do Android (o usuário escolhe
// o TapTap na lista) com fallback pra Play Store se não tiver instalado
const openTapTap = async (url, title) => {
  if (navigator.share) {
    try {
      await navigator.share({ title, url: getDirectUrl(url) })
      return
    } catch { /* usuário cancelou o share sheet */ }
  }
  window.open('https://play.google.com/store/apps/details?id=com.taptap.client.android.tv', '_blank')
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
  const { user } = useAuth()

  const trackView = async (animeObj, ep) => {
    if (!animeObj) return
    const title = animeObj.title_english || animeObj.title || ''
    const image = animeObj.images?.jpg?.large_image_url || animeObj.images?.jpg?.image_url || ''
    const animeId = String(animeObj.mal_id)
    try {
      await incrementAnimeViews(animeId, title, image)
      if (user) {
        await addWatchHistory(user.id, animeId, title, image, Number(ep))
      }
    } catch {}
  }

  const [loading,      setLoading]      = useState(true)
  const [status,       setStatus]       = useState('📡 Conectando ao Shinokai...')
  const [error,        setError]        = useState(false)
  const [errorMsg,     setErrorMsg]     = useState('')
  const [showShare,    setShowShare]    = useState(false)
  const [copied,       setCopied]       = useState(false)
  const [downloading,  setDownloading]  = useState(false)
  const [newAchievements, setNewAchievements] = useState([])
  const [showBugReport,   setShowBugReport]   = useState(false)
  const [provider,        setProvider]        = useState('Shinokai')

  useEffect(() => {
    setAnime(null); setEpisodes([])
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

  const doLoad = async (animeObj, ep, dub) => {
    setLoading(true)
    setError(false)
    setSources([])
    setCurrentSrc('')
    setProvider('Shinokai')
    setStatus('📡 Conectando ao Shinokai...')

    try {
      const skResult = await resolveShinokai(animeObj, ep, dub)
      setSources([{ label: skResult.label, url: skResult.url }])
      setCurrentSrc(skResult.url)
      setStatus(`✅ Shinokai — ${dub ? '🎙️ Dublado' : '🇧🇷 Legendado'}`)
      setLoading(false)
      trackView(animeObj, ep)
    } catch (err) {
      console.warn('[Shinokai] falhou:', err)
      setErrorMsg(err?.message || 'Não foi possível carregar este episódio pela Shinokai.')
      setError(true)
      setLoading(false)
    }
  }

  useEffect(() => {
    if (anime) {
      doLoad(anime, epNum, isDub)
      const t = anime.title_english || anime.title || 'Anime'
      document.title = `${t} EP ${epNum} - Assistir | Up Anime+`
      saveHistory(anime, epNum)
    }
  }, [anime, epNum, isDub])

  const goEp = (n) => setSearchParams({ ep: n, ...(isDub ? { dub: '1' } : {}) })
  const toggleDub = () => setSearchParams({ ep: epNum, ...(!isDub ? { dub: '1' } : {}) })

  const loadMoreEps = async () => {
    const next = epPage + 1
    const data = await getAnimeEpisodes(id, next)
    setEpisodes(p => [...p, ...(data.data || [])])
    setHasMoreEps(data.pagination?.has_next_page || false)
    setEpPage(next)
  }

  const title      = anime?.title_english || anime?.title || ''
  const synopsis   = useTranslatedSynopsis(anime?.synopsis)
  const prevEp   = epNum > 1 ? epNum - 1 : null
  const nextEp   = anime?.episodes && epNum < anime.episodes ? epNum + 1 : null
  const epTitle  = episodes.find(e => e.mal_id === epNum)?.title || `Episódio ${epNum}`
  const filename = `${title} - EP${String(epNum).padStart(2, '0')}.mp4`

  // Badge de provider para mostrar na UI
  const providerLabel = provider === 'Shinokai' ? '🔥 Shinokai' : provider

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
                <p className="loading-sub">Fonte única: Shinokai</p>
              </div>
            ) : error ? (
              <div className="player-error">
                <span className="error-emoji">😕</span>
                <h3>Erro ao carregar o player</h3>
                <p className="error-hint">Tente novamente ou abra em outro player.</p>
                <div className="error-btns">
                  <button className="btn btn-primary" onClick={() => doLoad(anime, epNum, isDub)}>
                    🔄 Tentar novamente
                  </button>
                  {currentSrc && (
                    <button className="btn btn-ghost" onClick={() => openMXPlayer(currentSrc, `${title} EP${epNum}`)}>
                      🎬 Abrir no MX Player
                    </button>
                  )}
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
            <span className="audio-label"><FiHeadphones /> Áudio:</span>
            <div className="audio-toggle">
              <button className={`track-btn ${!isDub ? 'active' : ''}`} onClick={() => isDub && toggleDub()}>
                Legendado
              </button>
              <button className={`track-btn ${isDub ? 'active' : ''}`} onClick={() => !isDub && toggleDub()}>
                Dublado
              </button>
            </div>
            {sources.length > 1 && (
              <div className="quality-wrap">
                <FiMonitor />
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

          {/* Ações */}
          <div className="ext-actions">
            {currentSrc && (
              <>
                <button className="ext-btn" onClick={() => openCastTV(currentSrc)}>
                  <FiCast /><span>Cast TV</span>
                </button>
                <button className="ext-btn" onClick={() => openTapTap(currentSrc, `${title} EP${epNum}`)}>
                  <FiTv /><span>TapTap</span>
                </button>
                <button className="ext-btn" disabled={downloading} onClick={async () => {
                  setDownloading(true)
                  await downloadDirect(currentSrc, filename)
                  setDownloading(false)
                }}>
                  <FiDownload /><span>{downloading ? 'Baixando...' : 'Baixar'}</span>
                </button>
                <button className="ext-btn"
                  onClick={() => isMobile ? openMXPlayer(currentSrc, `${title} EP${epNum}`) : openVLC(currentSrc, `${title} EP${epNum}`)}>
                  {isMobile ? <><BsFillCameraVideoFill /><span>MX Player</span></> : <><FiMonitor /><span>VLC Player</span></>}
                </button>
              </>
            )}
            <div className="share-container">
              <button className="ext-btn" onClick={() => setShowShare(o => !o)}><FiShare2 /><span>Share</span></button>
              {showShare && (
                <div className="share-dropdown">
                  <button onClick={() => {
                    navigator.clipboard.writeText(window.location.href)
                    setCopied(true); setTimeout(() => setCopied(false), 2000)
                  }}>{copied ? <FiCheck /> : <FiCopy />} {copied ? 'Copiado!' : 'Copiar link'}</button>
                  <a href={`https://wa.me/?text=${encodeURIComponent(`${title} EP${epNum}\n${window.location.href}`)}`}
                    target="_blank" rel="noreferrer"><FaWhatsapp /> WhatsApp</a>
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
                {isDub ? <span className="wbadge dub"><FiHeadphones /> Dublado</span> : <span className="wbadge sub">🇧🇷 Legendado</span>}
                {anime.score && <span className="wbadge"><FiStar /> {anime.score.toFixed(1)}</span>}
                {anime.status === 'Currently Airing' && <span className="wbadge live"><span className="live-dot" /> Em Exibição</span>}
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
