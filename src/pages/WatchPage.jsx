import { useState, useEffect } from 'react'
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
import { recordWatched } from '../services/achievements'
import VideoPlayer from '../components/VideoPlayer'
import Comments from '../components/Comments'
import FeedbackModal from '../components/FeedbackModal'
import './WatchPage.css'
import { incrementAnimeViews, addWatchHistory } from '../services/supabase'
import { useAuth } from '../context/AuthContext'
import { api, arrayOf, mediaInfo, episodeInfo, videoUrl, isDub as checkDub, qualityNumber } from '../services/shi.mjs'

// ── Helpers para Players Externos e Download ──────────────────────────────
const isAndroid = /Android/i.test(navigator.userAgent)
const isMobile  = isAndroid || /iPhone|iPad|iPod/i.test(navigator.userAgent)

const openVLC = (url) => {
  window.location.href = `vlc://${url}`
  setTimeout(() => { if (!document.hidden) window.open(url, '_blank') }, 1500)
}

const openMXPlayer = (url, title) => {
  const titleEnc = encodeURIComponent(title)
  const intentFree = `intent:${url}#Intent;action=android.intent.action.VIEW;type=video/*;package=com.mxtech.videoplayer.ad;S.title=${titleEnc};end`
  const intentPro  = `intent:${url}#Intent;action=android.intent.action.VIEW;type=video/*;package=com.mxtech.videoplayer.pro;S.title=${titleEnc};end`
  window.location.href = intentFree
  setTimeout(() => { if (!document.hidden) window.location.href = intentPro }, 1000)
}

const openCastTV = (url) => {
  window.location.href = `intent:${url}#Intent;package=com.instantbits.cast.webvideo;action=android.intent.action.VIEW;type=video/*;end`
  setTimeout(() => {
    if (!document.hidden) window.open('https://play.google.com/store/apps/details?id=com.instantbits.cast.webvideo', '_blank')
  }, 2000)
}

const openTapTap = async (url, title) => {
  if (navigator.share) {
    try {
      await navigator.share({ title, url })
      return
    } catch {}
  }
  window.open('https://play.google.com/store/apps/details?id=com.taptap.client.android.tv', '_blank')
}

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
    window.open(url, '_blank')
  }
}

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
  const { user } = useAuth()

  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState('📡 Conectando ao Shinokai...')
  const [error, setError] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [showShare, setShowShare] = useState(false)
  const [copied, setCopied] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [newAchievements, setNewAchievements] = useState([])
  const [showBugReport, setShowBugReport] = useState(false)

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
    setLoading(true); setError(false); setSources([]); setCurrentSrc('')

    try {
      setStatus('🔍 Pesquisando anime na API Shinokai...')
      const searchTitle = animeObj.title_english || animeObj.title || ''
      const searchData = await api(`/medias?q=${encodeURIComponent(searchTitle)}`)
      const mediaItems = arrayOf(searchData).map(mediaInfo)

      if (!mediaItems.length) throw new Error('Anime não encontrado no catálogo.')

      // Tenta bater pelo mal_id ou usa o primeiro resultado da busca
      const media = mediaItems.find(m => String(m.mal_id) === String(animeObj.mal_id)) || mediaItems[0]

      setStatus('📋 Buscando lista de episódios...')
      const episodeData = await api(`/medias/${encodeURIComponent(media.id)}/episodes`)
      const fetchedEpisodes = arrayOf(episodeData).map(episodeInfo)
      const targetEp = fetchedEpisodes.find(e => Number(e.number) === Number(ep))

      if (!targetEp) throw new Error(`Episódio ${ep} não encontrado.`)

      setStatus('📡 Extraindo player do vídeo...')
      const dubVariants = targetEp.variants.filter(checkDub)
      const candidates = dub && dubVariants.length ? dubVariants : targetEp.variants

      if (!candidates.length) throw new Error('Nenhuma opção de vídeo disponível.')

      const sortedVariants = [...candidates].sort((a, b) => qualityNumber(b) - qualityNumber(a))
      const selectedVariant = sortedVariants[0]

      const suffix = selectedVariant.id ? `?variantId=${encodeURIComponent(selectedVariant.id)}` : ''
      const playData = await api(`/medias/${encodeURIComponent(media.id)}/episodes/${encodeURIComponent(targetEp.id)}/play${suffix}`)
      const playUrl = videoUrl(playData)

      if (!playUrl) throw new Error('Não foi possível carregar o link de reprodução.')

      const resolvedSources = sortedVariants.map(v => ({
        label: v.label || 'Auto',
        url: playUrl,
        id: v.id
      }))

      setSources(resolvedSources)
      setCurrentSrc(playUrl)
      setStatus(`✅ ${media.title} — ${dub ? '🎙️ Dublado' : '🇧🇷 Legendado'}`)
      setLoading(false)
      trackView(animeObj, ep)
    } catch (err) {
      console.error('[Shinokai Load Error]:', err.message)
      setError(true)
      setErrorMsg(err.message || 'Falha ao carregar episódio.')
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

  const title    = anime?.title_english || anime?.title || ''
  const synopsis = useTranslatedSynopsis(anime?.synopsis)
  const prevEp   = epNum > 1 ? epNum - 1 : null
  const nextEp   = anime?.episodes && epNum < anime.episodes ? epNum + 1 : null
  const epTitle  = episodes.find(e => e.mal_id === epNum)?.title || `Episódio ${epNum}`
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

          {/* Player */}
          <div className="player-wrap">
            {loading ? (
              <div className="player-loading">
                <div className="loading-ring" />
                <p className="loading-text">{status}</p>
                <p className="loading-sub">Fonte: ⚡ Shinokai API</p>
              </div>
            ) : error ? (
              <div className="player-error">
                <span className="error-emoji">😕</span>
                <h3>Erro ao carregar o player</h3>
                <p className="error-hint">{errorMsg}</p>
                <div className="error-btns">
                  <button className="btn btn-primary" onClick={() => doLoad(anime, epNum, isDub)}>
                    🔄 Tentar novamente
                  </button>
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
              />
            ) : null}
          </div>

          {/* Áudio Toggle + Qualidade */}
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
                    key={s.url + i}
                    className={`track-btn${currentSrc === s.url ? ' active' : ''}`}
                    onClick={() => setCurrentSrc(s.url)}
                  >
                    {s.label || `Opção ${i + 1}`}
                  </button>
                ))}
              </div>
            )}
            {!loading && !error && (
              <span className="provider-tag" style={{ marginLeft: 'auto' }}>
                🚀 Shinokai API
              </span>
            )}
          </div>

          {/* Ações / Players Externos */}
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
                  onClick={() => isMobile ? openMXPlayer(currentSrc, `${title} EP${epNum}`) : openVLC(currentSrc)}>
                  {isMobile ? <><BsFillCameraVideoFill /><span>MX Player</span></> : <><FiMonitor /><span>VLC Player</span></>}
                </button>
              </>
            )}
            <div className="share-container">
              <button className="ext-btn" onClick={() => setShowShare(o => !o)}><FiShare2 /><span>Compartilhar</span></button>
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

          {/* Navegação de Episódios */}
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

          {/* Info Bar */}
          {anime && (
            <div className="watch-info-bar">
              <Link to={`/anime/${id}`} className="back-link">← {title}</Link>
              <h1 className="watch-anime-title">{title}</h1>
              <div className="watch-badges">
                {isDub ? <span className="wbadge dub"><FiHeadphones /> Dublado</span> : <span className="wbadge sub">🇧🇷 Legendado</span>}
                {anime.score && <span className="wbadge"><FiStar /> {anime.score.toFixed(1)}</span>}
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

        {/* Sidebar de Episódios */}
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
    
