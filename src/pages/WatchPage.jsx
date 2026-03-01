import { useState, useEffect, useRef } from 'react'
import { useParams, useSearchParams, Link } from 'react-router-dom'
import { FiChevronLeft, FiChevronRight } from 'react-icons/fi'
import { getAnimeById, getAnimeEpisodes, smartSearchConsumet, searchConsumetDub, getEpisodeSources } from '../services/api'
import './WatchPage.css'

const openMXPlayer = (url, title) => {
  window.location.href = `intent:${url}#Intent;package=com.mxtech.videoplayer.ad;S.title=${encodeURIComponent(title)};end`
  setTimeout(() => window.open(url, '_blank'), 900)
}

const openADM = (url, filename) => {
  window.location.href = `adm://add?url=${encodeURIComponent(url)}&filename=${encodeURIComponent(filename)}`
  setTimeout(() => window.open(url, '_blank'), 900)
}

const openWebVideoCast = (url) => {
  window.open(`https://www.webvideocast.com/play?url=${encodeURIComponent(url)}`, '_blank')
}

const buildSlug = (anime) =>
  (anime.title_english || anime.title)
    .toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, '-')

export default function WatchPage() {
  const { id } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const epNum = parseInt(searchParams.get('ep') || '1')
  const isDub = searchParams.get('dub') === '1'

  const [anime, setAnime] = useState(null)
  const [episodes, setEpisodes] = useState([])
  const [sources, setSources] = useState(null)
  const [currentSrc, setCurrentSrc] = useState('')
  const [loadingVideo, setLoadingVideo] = useState(true)
  const [loadingStatus, setLoadingStatus] = useState('🔍 Buscando anime...')
  const [error, setError] = useState(false)
  const [consumetId, setConsumetId] = useState(null)
  const [hasDub, setHasDub] = useState(false)
  const [showShare, setShowShare] = useState(false)
  const [hasMoreEps, setHasMoreEps] = useState(false)
  const [epPage, setEpPage] = useState(1)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    setAnime(null); setEpisodes([]); setConsumetId(null)
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
    const run = async () => {
      setLoadingVideo(true); setError(false); setSources(null); setCurrentSrc('')
      try {
        let mid = consumetId
        if (!mid) {
          setLoadingStatus(isDub ? '🎙️ Buscando versão dublada...' : '🔍 Buscando anime...')
          const sr = isDub ? await searchConsumetDub(anime) : await smartSearchConsumet(anime)
          const match = sr.results?.[0]
          if (!match) throw new Error('Anime não encontrado nas fontes de streaming')
          mid = match.id
          if (!cancelled) setConsumetId(mid)

          // Verifica dublagem em paralelo
          if (!isDub) {
            searchConsumetDub(anime).then(r => { if (!cancelled) setHasDub(r.results.length > 0) })
          }
        }

        setLoadingStatus('📡 Carregando fontes...')
        const data = await getEpisodeSources(`${mid}-episode-${epNum}`)
        if (cancelled) return
        setSources(data)
        const best = ['1080p','720p','480p','360p'].reduce((found, q) =>
          found || data.sources?.find(s => s.quality === q), null
        ) || data.sources?.[0]
        if (best) setCurrentSrc(best.url)
        else throw new Error('Nenhuma fonte de vídeo encontrada')
      } catch(e) {
        if (!cancelled) { setError(true); setLoadingStatus('❌ ' + e.message) }
      } finally {
        if (!cancelled) setLoadingVideo(false)
      }
    }
    run()
    return () => { cancelled = true }
  }, [anime, epNum, isDub])

  const goEp = (n, dub = isDub) => {
    setConsumetId(null)
    setSearchParams({ ep: n, ...(dub ? { dub: '1' } : {}) })
  }

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href)
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }

  const prevEp = epNum > 1 ? epNum - 1 : null
  const nextEp = (anime?.episodes && epNum < anime.episodes) ? epNum + 1 : null
  const epTitle = episodes.find(e => e.mal_id === epNum)?.title || `Episódio ${epNum}`
  const filename = `${anime?.title_english || anime?.title || 'anime'} - EP${String(epNum).padStart(2,'0')}.mp4`
  const externalUrl = anime ? `https://gogoanime3.cc/${buildSlug(anime)}-episode-${epNum}` : '#'
  const waText = encodeURIComponent(`🔥 ${anime?.title_english || anime?.title} - EP${epNum}\n${window.location.href}`)

  const loadMoreEps = async () => {
    const next = epPage + 1
    const data = await getAnimeEpisodes(id, next)
    setEpisodes(p => [...p, ...(data.data || [])])
    setHasMoreEps(data.pagination?.has_next_page || false)
    setEpPage(next)
  }

  return (
    <div className="watch-page">
      <div className="watch-layout">

        {/* ══ PLAYER + CONTROLES ══ */}
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
                <p className="error-msg">{loadingStatus}</p>
                <p className="error-hint">💡 Dica: O Render gratuito pode estar hibernando. Aguarde 30s e tente novamente.</p>
                <div className="error-btns">
                  <button className="btn btn-primary" onClick={() => { setError(false); setLoadingVideo(true); setConsumetId(null) }}>
                    🔄 Tentar novamente
                  </button>
                  <a href={externalUrl} target="_blank" rel="noreferrer" className="btn btn-ghost">
                    🌐 Assistir no GogoAnime
                  </a>
                </div>
              </div>
            ) : currentSrc ? (
              <video
                key={currentSrc}
                src={currentSrc}
                controls autoPlay playsInline
                className="video-player"
                onError={() => setError(true)}
              />
            ) : null}
          </div>

          {/* Dub / Legendado */}
          <div className="audio-track-bar">
            <span className="audio-label">🎧 Áudio:</span>
            <div className="audio-toggle">
              <button className={`track-btn ${!isDub ? 'active' : ''}`} onClick={() => isDub && goEp(epNum, false)}>
                🇧🇷 Legendado
              </button>
              <button
                className={`track-btn ${isDub ? 'active' : ''}`}
                onClick={() => !isDub && goEp(epNum, true)}
              >
                🎙️ Dublado{!hasDub && !isDub ? ' ⚠️' : ''}
              </button>
            </div>

            {/* Qualidade */}
            {sources?.sources?.length > 1 && (
              <div className="quality-wrap">
                <span>📺</span>
                <select className="quality-select" value={currentSrc} onChange={e => setCurrentSrc(e.target.value)}>
                  {sources.sources.map(s => (
                    <option key={s.url} value={s.url}>{s.quality || 'Auto'}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Botões externos */}
          <div className="ext-actions">
            {currentSrc && (
              <>
                <button className="ext-btn" onClick={() => openWebVideoCast(currentSrc)} title="Transmitir para TV">
                  📡<span>Cast TV</span>
                </button>
                <button className="ext-btn" onClick={() => openADM(currentSrc, filename)} title="Baixar com ADM">
                  ⬇️<span>Baixar</span>
                </button>
                <button className="ext-btn" onClick={() => openMXPlayer(currentSrc, `${anime?.title_english || anime?.title} EP${epNum}`)} title="Abrir no MX Player">
                  🎬<span>MX Player</span>
                </button>
              </>
            )}
            <div className="share-container">
              <button className="ext-btn" onClick={() => setShowShare(o => !o)}>
                🔗<span>Compartilhar</span>
              </button>
              {showShare && (
                <div className="share-dropdown">
                  <button onClick={copyLink}>{copied ? '✅ Copiado!' : '📋 Copiar link'}</button>
                  <a href={`https://wa.me/?text=${waText}`} target="_blank" rel="noreferrer">💬 WhatsApp</a>
                  <a href={externalUrl} target="_blank" rel="noreferrer">🌐 GogoAnime</a>
                </div>
              )}
            </div>
          </div>

          {/* Navegação episódios */}
          <div className="ep-navigator">
            <button className="ep-nav-btn prev" disabled={!prevEp} onClick={() => prevEp && goEp(prevEp)}>
              <FiChevronLeft /> {prevEp ? `EP ${prevEp}` : '—'}
            </button>
            <div className="ep-nav-center">
              <span className="ep-nav-num">Episódio {epNum}</span>
              <span className="ep-nav-title">{epTitle}</span>
            </div>
            <button className="ep-nav-btn next" disabled={!nextEp} onClick={() => nextEp && goEp(nextEp)}>
              {nextEp ? `EP ${nextEp}` : '—'} <FiChevronRight />
            </button>
          </div>

          {/* Info abaixo do player */}
          {anime && (
            <div className="watch-info-bar">
              <Link to={`/anime/${id}`} className="back-link">← {anime.title_english || anime.title}</Link>
              <div className="watch-info-content">
                <h1 className="watch-anime-title">{anime.title_english || anime.title}</h1>
                <div className="watch-badges">
                  {isDub ? <span className="wbadge dub">🎙️ Dublado</span> : <span className="wbadge sub">🇧🇷 Legendado</span>}
                  {anime.score && <span className="wbadge">⭐ {anime.score.toFixed(1)}</span>}
                  {anime.status === 'Currently Airing' && <span className="wbadge live">🔴 Em Exibição</span>}
                  {anime.type && <span className="wbadge">{anime.type}</span>}
                </div>
                {anime.synopsis && (
                  <p className="watch-synopsis">{anime.synopsis.slice(0, 300)}{anime.synopsis.length > 300 ? '...' : ''}</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ══ SIDEBAR EPISÓDIOS ══ */}
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
