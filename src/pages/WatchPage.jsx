import { useState, useEffect, useRef } from 'react'
import { useParams, useSearchParams, Link } from 'react-router-dom'
import {
  FiChevronLeft, FiChevronRight, FiCast, FiDownload, FiMonitor, FiExternalLink,
  FiShare2, FiCopy, FiCheck, FiHeadphones, FiTv, FiStar, FiArrowLeft,
} from 'react-icons/fi'
import { BsFillCameraVideoFill } from 'react-icons/bs'
import { FaWhatsapp } from 'react-icons/fa'
import { getAnimeById } from '../services/api'
import {
  buscarAnimePorNome,
  carregarEpisodiosPaginados,
  obterLinkPlay,
} from '../services/shinokaiService'
import { useTranslatedSynopsis } from '../services/translate'
import { recordWatched } from '../services/achievements'
import VideoPlayer from '../components/VideoPlayer'
import Comments from '../components/Comments'
import FeedbackModal from '../components/FeedbackModal'
import './WatchPage.css'
import { incrementAnimeViews, addWatchHistory } from '../services/supabase'
import { addDownload } from '../services/downloads'
import { useAuth } from '../context/AuthContext'

// ─────────────────────────────────────────────────────────────────────────────
// FONTE: seu backend próprio, via shinokaiService.js
// ─────────────────────────────────────────────────────────────────────────────

const isAndroid = /Android/i.test(navigator.userAgent)
const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent)
const isMobile = isAndroid || isIOS

// TWAs (apk gerado via GitHub Action + Bubblewrap) rodam sobre o Chrome, que
// bloqueia navegação programática (`window.location.href = 'intent://...'`)
// pra esquemas que não são http/https — só permite quando é um clique real
// num link <a>. Por isso simulamos um clique de verdade em vez de setar o href.
const navigateToIntent = (url) => {
  const a = document.createElement('a')
  a.href = url
  a.style.display = 'none'
  document.body.appendChild(a)
  a.click()
  setTimeout(() => a.remove(), 100)
}

// Formato correto do Android: "intent://" (com barra dupla) + link SEM o
// "https://" + "scheme=https;" como campo separado. Sem isso o Chrome não
// reconhece como intent e dá ERR_UNKNOWN_URL_SCHEME.
const stripScheme = (url) => url.replace(/^https?:\/\//, '')

const openVLC = (url, title) => {
  navigateToIntent(`vlc://${url}`)
  setTimeout(() => { if (!document.hidden) window.open(url, '_blank') }, 1500)
}

const openMXPlayer = (url, title) => {
  const titleEnc = encodeURIComponent(title)
  const ua = encodeURIComponent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36')
  const noScheme = stripScheme(url)
  const intentFree = `intent://${noScheme}#Intent;scheme=https;action=android.intent.action.VIEW;type=video/*;package=com.mxtech.videoplayer.ad;S.title=${titleEnc};S.headers_User-Agent=${ua};S.browser_fallback_url=${encodeURIComponent('https://play.google.com/store/apps/details?id=com.mxtech.videoplayer.ad')};end`
  const intentPro = `intent://${noScheme}#Intent;scheme=https;action=android.intent.action.VIEW;type=video/*;package=com.mxtech.videoplayer.pro;S.title=${titleEnc};S.headers_User-Agent=${ua};end`
  navigateToIntent(intentFree)
  setTimeout(() => { if (!document.hidden) navigateToIntent(intentPro) }, 1000)
}

const downloadDirect = async (url, fn, onProgress) => {
  try {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const total = Number(res.headers.get('content-length')) || 0
    const reader = res.body?.getReader()

    if (!reader || !total) {
      // Sem suporte a stream ou sem content-length: baixa direto sem % exata
      onProgress?.(-1)
      const blob = await res.blob()
      triggerDownload(blob, fn)
      return
    }

    let received = 0
    const chunks = []
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      chunks.push(value)
      received += value.length
      onProgress?.(Math.min(99, Math.round((received / total) * 100)))
    }
    onProgress?.(100)
    triggerDownload(new Blob(chunks), fn)
  } catch (err) {
    console.warn('[download] blob falhou, abrindo em nova aba:', err.message)
    window.open(url, '_blank')
  }
}

const triggerDownload = (blob, fn) => {
  const blobUrl = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = blobUrl
  a.download = fn || 'episodio.mp4'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(blobUrl), 60000)
}

const openCastTV = (url) => {
  navigateToIntent(`intent://${stripScheme(url)}#Intent;scheme=https;package=com.instantbits.cast.webvideo;action=android.intent.action.VIEW;type=video/*;S.browser_fallback_url=${encodeURIComponent('https://play.google.com/store/apps/details?id=com.instantbits.cast.webvideo')};end`)
  setTimeout(() => {
    if (!document.hidden) window.open('https://play.google.com/store/apps/details?id=com.instantbits.cast.webvideo', '_blank')
  }, 2000)
}

const openTapTap = async (url, title) => {
  if (navigator.share) {
    try {
      await navigator.share({ title, url })
      return
    } catch { /* usuário cancelou */ }
  }
  window.open('https://play.google.com/store/apps/details?id=com.taptap.client.android.tv', '_blank')
}

const DownloadRing = ({ progress }) => {
  const size = 16
  const stroke = 2
  const r = (size - stroke) / 2
  const circ = 2 * Math.PI * r
  const indeterminate = progress < 0
  const pct = indeterminate ? 0.25 : progress / 100
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className={`dl-ring ${indeterminate ? 'dl-ring-spin' : ''}`}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth={stroke} />
      <circle
        cx={size/2} cy={size/2} r={r} fill="none"
        stroke="currentColor" strokeWidth={stroke}
        strokeDasharray={circ}
        strokeDashoffset={circ * (1 - pct)}
        strokeLinecap="round"
        transform={`rotate(-90 ${size/2} ${size/2})`}
      />
    </svg>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
export default function WatchPage() {
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const epNum = parseInt(searchParams.get('ep') || '1')
  const isDub = searchParams.get('dub') === '1'
  const { user } = useAuth()

  const [anime, setAnime] = useState(null)
  const [episodes, setEpisodes] = useState([])
  const [epPage, setEpPage] = useState(1)
  const [hasMoreEps, setHasMoreEps] = useState(false)

  const [shinokaiAnime, setShinokaiAnime] = useState(null)
  const lastPlayedRef = useRef(null)
  const [currentSrc, setCurrentSrc] = useState('')
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState('Carregando...')
  const [error, setError] = useState(false)

  const [showShare, setShowShare] = useState(false)
  const [copied, setCopied] = useState(false)
  const [downloadProgress, setDownloadProgress] = useState(null) // null=parado, -1=indeterminado, 0-100=%
  const [newAchievements, setNewAchievements] = useState([])
  const [showBugReport, setShowBugReport] = useState(false)

  const title = anime?.title_english || anime?.title || 'Anime'
  const { synopsis } = useTranslatedSynopsis(anime?.synopsis)
  const activeEp = episodes.find(e => (e.number ?? e.episode ?? e.id) == epNum)
  const epTitle = activeEp?.title || ''

  const trackView = async (animeObj) => {
    if (!animeObj) return
    const t = animeObj.title_english || animeObj.title || ''
    const image = animeObj.images?.jpg?.large_image_url || animeObj.images?.jpg?.image_url || ''
    const animeId = String(animeObj.mal_id)
    try {
      await incrementAnimeViews(animeId, t, image)
      if (user) await addWatchHistory(user.id, animeId, t, image, Number(epNum))
    } catch {}
  }

  // Metadados (título, sinopse, capa) — via API pública de catálogo (Jikan/AniList)
  useEffect(() => {
    setAnime(null)
    getAnimeById(id).then(d => {
      const a = d.data
      setAnime(a)
      document.title = `${a.title_english || a.title} EP ${epNum} - Assistir | Up Anime+`
      trackView(a)
    }).catch(() => {})
    window.scrollTo(0, 0)
    return () => { document.title = 'Up Anime+ | Assistir Animes Online Grátis em HD' }
  }, [id])

  // Anime + episódios na sua fonte própria (busca pelo nome, já que
  // o id da rota é o id do AniList/Jikan, que sua API não usa)
  useEffect(() => {
    if (!title || title === 'Anime') return // espera os metadados carregarem
    let cancelado = false
    const carregar = async () => {
      setLoading(true); setError(false); setStatus('Localizando anime...')
      try {
        const nomesTentativa = [
          anime?.title_english,
          anime?.title,
          title,
        ].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i)

        let sAnime = null
        let ultimoErro = null
        for (const nome of nomesTentativa) {
          try {
            sAnime = await buscarAnimePorNome(nome)
            break
          } catch (e) {
            ultimoErro = e
          }
        }
        if (!sAnime) throw ultimoErro || new Error('Anime não encontrado.')
        if (cancelado) return
        setShinokaiAnime(sAnime)

        setStatus('Carregando episódios...')
        const pag = await carregarEpisodiosPaginados(sAnime.id, 1, 30)
        if (cancelado) return
        setEpisodes(pag.episodios)
        setHasMoreEps(pag.temMais)
        setEpPage(1)
        // A reprodução em si fica a cargo do efeito abaixo (que também cuida
        // de trocar de episódio via ?ep=), pra não chamar duas vezes o mesmo link.
      } catch (err) {
        console.error('[Shinokai] erro:', err)
        if (!cancelado) { setError(true); setLoading(false) }
      }
    }
    carregar()
    return () => { cancelado = true }
  }, [title])

  // Troca de episódio (via ?ep= na URL) — único lugar que chama reproduzir(),
  // pra nunca disparar o mesmo link 2x.
  useEffect(() => {
    if (!shinokaiAnime || !episodes.length) return
    const key = `${shinokaiAnime.id}_${epNum}`
    if (lastPlayedRef.current === key) return // já tocando esse episódio, evita chamada duplicada
    lastPlayedRef.current = key
    reproduzir(shinokaiAnime, episodes)
  }, [shinokaiAnime, episodes.length, epNum])

  const reproduzir = async (animeObj, epsList) => {
    const ep = epsList.find(e => (e.number ?? e.episode ?? e.id) == epNum) || epsList[0]
    if (!ep) { setError(true); setLoading(false); return }

    setLoading(true); setError(false); setCurrentSrc('')
    try {
      setStatus(`Carregando episódio ${epNum}...`)
      const url = await obterLinkPlay(animeObj.id, ep.id)
      setCurrentSrc(url)
      setStatus('')
    } catch (err) {
      console.error('[Shinokai] erro ao obter link:', err)
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  const carregarMaisEpisodios = async () => {
    if (!shinokaiAnime) return
    const proxima = epPage + 1
    const pag = await carregarEpisodiosPaginados(shinokaiAnime.id, proxima, 30)
    setEpisodes(prev => [...prev, ...pag.episodios])
    setHasMoreEps(pag.temMais)
    setEpPage(proxima)
  }

  const goEp = (novoEp) => {
    const url = new URL(window.location.href)
    url.searchParams.set('ep', novoEp)
    window.history.pushState({}, '', url)
    window.dispatchEvent(new PopStateEvent('popstate'))
  }

  const epNumbers = episodes.map(e => e.number ?? e.episode ?? e.id)
  const idx = epNumbers.indexOf(epNum)
  const prevEp = idx > 0 ? epNumbers[idx - 1] : null
  const nextEp = idx >= 0 && idx < epNumbers.length - 1 ? epNumbers[idx + 1] : null
  const filename = `${title} - EP${epNum}.mp4`

  return (
    <div className="watch-page">
      <div className="watch-layout">
        <div className="watch-main">

          <div className="video-area">
            <div className="player-topbar">
              <Link to={`/anime/${id}`} className="player-back-btn"><FiArrowLeft size={16} /></Link>
              <span className="player-title-mini">{title} · EP {epNum}</span>
              {currentSrc && (
                <button className="player-cast-btn" onClick={() => openCastTV(currentSrc)}><FiCast size={15} /></button>
              )}
            </div>
            {loading ? (
              <div className="video-status">
                <p>{status}</p>
              </div>
            ) : error ? (
              <div className="video-status">
                <p>Não foi possível carregar este episódio.</p>
              </div>
            ) : currentSrc ? (
              <VideoPlayer
                key={currentSrc}
                src={currentSrc}
                title={`${title} EP${epNum}`}
                animeId={id}
                epNum={epNum}
                sources={[]}
                onEpisodeWatched={() => {
                  if (!anime) return
                  const genres = anime.genres?.map(g => g.name) || []
                  const unlocked = recordWatched({
                    malId: parseInt(id), ep: epNum,
                    totalEps: anime.episodes || 0, genres,
                  })
                  if (unlocked.length) {
                    setNewAchievements(unlocked)
                    setTimeout(() => setNewAchievements([]), 5000)
                  }
                }}
                onError={() => {}}
              />
            ) : null}
          </div>

          <div className="audio-track-bar">
            <span className="audio-label"><FiHeadphones /> Áudio:</span>
            {!loading && !error && (
              <span className="provider-tag" style={{ marginLeft: 'auto' }}>
                Sua fonte
              </span>
            )}
          </div>

          <div className="ext-actions">
            {currentSrc && (
              <>
                <button className="ext-btn" onClick={() => openCastTV(currentSrc)}>
                  <FiCast /><span>Cast TV</span>
                </button>
                <button className="ext-btn" onClick={() => openTapTap(currentSrc, `${title} EP${epNum}`)}>
                  <FiTv /><span>TapTap</span>
                </button>
                <button
                  className="ext-btn ext-btn-download"
                  disabled={downloadProgress !== null}
                  onClick={async () => {
                    setDownloadProgress(-1)
                    await downloadDirect(currentSrc, filename, setDownloadProgress)
                    addDownload({
                      animeId: id,
                      ep: epNum,
                      title,
                      filename,
                      image: anime?.images?.jpg?.large_image_url,
                      url: currentSrc,
                    })
                    setDownloadProgress(null)
                  }}
                >
                  {downloadProgress !== null ? (
                    <DownloadRing progress={downloadProgress} />
                  ) : (
                    <FiDownload />
                  )}
                  <span>
                    {downloadProgress === null ? 'Baixar'
                      : downloadProgress < 0 ? 'Baixando...'
                      : `${downloadProgress}%`}
                  </span>
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

          {anime && (
            <div className="watch-info-bar">
              <Link to={`/anime/${id}`} className="back-link">← {title}</Link>
              <h1 className="watch-anime-title">{epTitle || title}</h1>
              <div className="watch-ep-sub">
                <span>Episódio {epNum}</span>
                <span className="dot">·</span>
                <span>{title}</span>
                {isDub && <><span className="dot">·</span><span>Dublado PT-BR</span></>}
              </div>
              <div className="watch-badges">
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

        <aside className="ep-sidebar">
          <div className="sidebar-head">
            <span>📋 Episódios</span>
            {episodes.length > 0 && <span className="ep-count-badge">{episodes.length}</span>}
          </div>
          <div className="ep-scroll">
            {episodes.map(ep => {
              const num = ep.number ?? ep.episode ?? ep.id
              return (
                <button key={ep.id} className={`wsb-row ${num === epNum ? 'playing' : ''}`} onClick={() => goEp(num)}>
                  <span className="wsb-row-num">{num}</span>
                  <div className="wsb-row-info">
                    <span className="wsb-row-title">{ep.title || `Episódio ${num}`}</span>
                  </div>
                  {num === epNum && <span className="now-playing">▶</span>}
                </button>
              )
            })}
            {hasMoreEps && <button className="load-more-btn" onClick={carregarMaisEpisodios}>⬇ Carregar mais</button>}
          </div>
        </aside>
      </div>
    </div>
  )
      }
