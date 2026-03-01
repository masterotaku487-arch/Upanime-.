import { useState, useEffect } from 'react'
import { useParams, useSearchParams, Link } from 'react-router-dom'
import { FiChevronLeft, FiChevronRight } from 'react-icons/fi'
import { getAnimeById, getAnimeEpisodes, fetchSourcesWithFallback, pickBestSource } from '../services/api'
import './WatchPage.css'

const openMXPlayer = (url, title) => {
  window.location.href = `intent:${url}#Intent;package=com.mxtech.videoplayer.ad;S.title=${encodeURIComponent(title)};end`
  setTimeout(() => window.open(url, '_blank'), 900)
}
const openADM = (url, filename) => {
  window.location.href = `adm://add?url=${encodeURIComponent(url)}&filename=${encodeURIComponent(filename)}`
  setTimeout(() => window.open(url, '_blank'), 900)
}
const openWebVideoCast = (url) =>
  window.open(`https://www.webvideocast.com/play?url=${encodeURIComponent(url)}`, '_blank')

const buildSlug = (anime) =>
  (anime.title_english || anime.title).toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, '-')

export default function WatchPage() {
  const { id } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const epNum = parseInt(searchParams.get('ep') || '1')

  const [anime, setAnime] = useState(null)
  const [episodes, setEpisodes] = useState([])
  const [sources, setSources] = useState(null)
  const [currentSrc, setCurrentSrc] = useState('')
  const [provider, setProvider] = useState('')
  const [idsCache, setIdsCache] = useState({})
  const [loadingVideo, setLoadingVideo] = useState(true)
  const [loadingStatus, setLoadingStatus] = useState('🔍 Carregando...')
  const [error, setError] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [showShare, setShowShare] = useState(false)
  const [hasMoreEps, setHasMoreEps] = useState(false)
  const [epPage, setEpPage] = useState(1)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    setAnime(null); setEpisodes([]); setIdsCache({})
    Promise.allSettled([getAnimeById(id), getAnimeEpisodes(id, 1)]).then(([d, e]) => {
      if (d.status === 'fulfilled') setAnime(d.value.data)
      if (e.status === 'fulfilled') {
        setEpisodes(e.value.data || [])
        setHasMoreEps(e.value.pagination?.has_next_page || false)
      }
    })
    window.scrollTo(0, 0)
  }, [id])

  useEffect(() => {
    if (!anime) return
    let cancelled = false

    const statuses = [
      '🔍 Buscando no Zoro...',
      '📡 Conectando ao servidor...',
      '🎬 Preparando episódio...',
    ]
    let si = 0
    const ticker = setInterval(() => {
      si = (si + 1) % statuses.length
      if (!cancelled) setLoadingStatus(statuses[si])
    }, 2500)

    const run = async () => {
      setLoadingVideo(true); setError(false); setSources(null); setCurrentSrc(''); setProvider('')
      setLoadingStatus('🔍 Buscando no Zoro...')

      try {
        // ── Busca vídeo com fallback automático ──
        // Cache de IDs para não refazer busca ao trocar episódio
        const result = await fetchSourcesWithFallback(anime, epNum, idsCache)

        if (cancelled) return
        clearInterval(ticker)

        setIdsCache(result.cache || {})
        setProvider(result.provider || '')
        setSources(result)

        const best = pickBestSource(result.sources || [])
        if (best) {
          setCurrentSrc(best.url)
        } else {
          throw new Error('Nenhuma fonte de vídeo disponível')
        }
      } catch (e) {
        clearInterval(ticker)
        if (!cancelled) {
          setError(true)
          setErrorMsg(e.message)
        }
      } finally {
        if (!cancelled) setLoadingVideo(false)
      }
    }

    run()
    return () => { cancelled = true; clearInterval(ticker) }
  }, [anime, epNum])

  const goEp = (n) => setSearchParams({ ep: n })

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href)
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }

  const loadMoreEps = async () => {
    const next = epPage + 1
    const data = await getAnimeEpisodes(id, next)
    setEpisodes(p => [...p, ...(data.data || [])])
    setHasMoreEps(data.pagination?.has_next_page || false)
    setEpPage(next)
  }

  const retry = () => { setError(false); setLoadingVideo(true); setIdsCache({}) }

  const prevEp = epNum > 1 ? epNum - 1 : null
  const nextEp = anime?.episodes && epNum < anime.episodes ? epNum + 1 : null
  const epTitle = episodes.find(e => e.mal_id === epNum)?.title || `Episódio ${epNum}`
  const filename = `${anime?.title_english || anime?.title || 'anime'} - EP${String(epNum).padStart(2,'0')}.mp4`
  const externalUrl = anime ? `https://gogoanime3.cc/${buildSlug(anime)}-episode-${epNum}` : '#'
  const waText = encodeURIComponent(`🔥 ${anime?.title_english || anime?.title} - EP${epNum}\n${window.location.href}`)

  return (
    <div className="watch-page">
      <div className="watch-layout">
        <div className="watch-main">

          {/* Player */}
          <div className="player-wrap">
            {loadingVideo ? (
              <div className="player-loading">
                <div className="loading-ring" />
                <img src="/logo.png" className="loading-logo" alt="" />
                <p className="loading-text">{loadingStatus}</p>
              </div>
            ) : error ? (
              <div className="player-error">
                <span className="error-emoji">😵</span>
                <h3>Episódio indisponível</h3>
                <p className="error-msg">{errorMsg}</p>
                <p className="error-hint">
                  💡 Tentamos Zoro, AniList e AnimePahe sem sucesso.<br/>
                  Verifique se o Consumet API no Render está online.
                </p>
                <div className="error-btns">
                  <button className="btn btn-primary" onClick={retry}>🔄 Tentar novamente</button>
                  <a href={externalUrl} target="_blank" rel="noreferrer" className="btn btn-ghost">🌐 GogoAnime</a>
                </div>
              </div>
            ) : currentSrc ? (
              <video
                key={currentSrc}
                src={currentSrc}
                controls autoPlay playsInline
                className="video-player"
                onError={() => { setError(true); setErrorMsg('Erro ao reproduzir. O link pode ter expirado.') }}
              />
            ) : null}
          </div>

          {/* Badge do provedor */}
          {provider && !loadingVideo && !error && (
            <div className="provider-tag">✅ Streaming via {provider}</div>
          )}

          {/* Qualidade */}
          {sources?.sources?.length > 1 && (
            <div className="audio-track-bar">
              <span className="audio-label">📺 Qualidade:</span>
              <select className="quality-select" value={currentSrc} onChange={e => setCurrentSrc(e.target.value)}>
                {sources.sources.map(s => (
                  <option key={s.url} value={s.url}>{s.quality || 'Auto'}</option>
                ))}
              </select>
            </div>
          )}

          {/* Ações */}
          <div className="ext-actions">
            {currentSrc && (
              <>
                <button className="ext-btn" onClick={() => openWebVideoCast(currentSrc)}>📡<span>Cast TV</span></button>
                <button className="ext-btn" onClick={() => openADM(currentSrc, filename)}>⬇️<span>Baixar</span></button>
                <button className="ext-btn" onClick={() => openMXPlayer(currentSrc, `${anime?.title_english || anime?.title} EP${epNum}`)}>🎬<span>MX Player</span></button>
              </>
            )}
            <div className="share-container">
              <button className="ext-btn" onClick={() => setShowShare(o => !o)}>🔗<span>Share</span></button>
              {showShare && (
                <div className="share-dropdown">
                  <button onClick={copyLink}>{copied ? '✅ Copiado!' : '📋 Copiar link'}</button>
                  <a href={`https://wa.me/?text=${waText}`} target="_blank" rel="noreferrer">💬 WhatsApp</a>
                  <a href={externalUrl} target="_blank" rel="noreferrer">🌐 GogoAnime</a>
                </div>
              )}
            </div>
          </div>

          {/* Navegação */}
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
              <Link to={`/anime/${id}`} className="back-link">← {anime.title_english || anime.title}</Link>
              <h1 className="watch-anime-title">{anime.title_english || anime.title}</h1>
              <div className="watch-badges">
                {anime.score && <span className="wbadge">⭐ {anime.score.toFixed(1)}</span>}
                {anime.status === 'Currently Airing' && <span className="wbadge live">🔴 Em Exibição</span>}
                {anime.type && <span className="wbadge">{anime.type}</span>}
                {anime.episodes && <span className="wbadge">📺 {anime.episodes} eps</span>}
              </div>
              {anime.synopsis && (
                <p className="watch-synopsis">{anime.synopsis.slice(0, 300)}{anime.synopsis.length > 300 ? '...' : ''}</p>
              )}
            </div>
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
              <button
                key={ep.mal_id}
                className={`ep-row ${ep.mal_id === epNum ? 'playing' : ''}`}
                onClick={() => goEp(ep.mal_id)}
              >
                <span className="ep-row-num">{ep.mal_id}</span>
                <div className="ep-row-info">
                  <span className="ep-row-title">{ep.title || `Episódio ${ep.mal_id}`}</span>
                  {ep.aired && <span className="ep-row-date">{new Date(ep.aired).toLocaleDateString('pt-BR')}</span>}
                </div>
                {ep.mal_id === epNum && <span className="now-playing">▶</span>}
              </button>
            ))}
            {hasMoreEps && (
              <button className="load-more-btn" onClick={loadMoreEps}>⬇ Carregar mais</button>
            )}
          </div>
        </aside>
      </div>
    </div>
  )
                  }
  
