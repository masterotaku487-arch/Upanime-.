import { useState, useEffect } from 'react'
import { useParams, useSearchParams, Link } from 'react-router-dom'
import { FiChevronLeft, FiChevronRight } from 'react-icons/fi'
import {
  getAnimeById,
  getAnimeEpisodes,
  fetchSourcesWithFallback,
  pickBestSource,
} from '../services/api'
import './WatchPage.css'

// ── Helpers externos ──────────────────────────────────────
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
  (anime.title_english || anime.title)
    .toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, '-')

// ─────────────────────────────────────────────────────────
export default function WatchPage() {
  const { id } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const epNum = parseInt(searchParams.get('ep') || '1')
  const isDub = searchParams.get('dub') === '1'

  const [anime, setAnime] = useState(null)
  const [episodes, setEpisodes] = useState([])
  const [sources, setSources] = useState(null)
  const [currentSrc, setCurrentSrc] = useState('')
  const [provider, setProvider] = useState('')
  const [idsCache, setIdsCache] = useState({})   // cache de IDs por provedor
  const [loadingVideo, setLoadingVideo] = useState(true)
  const [loadingStatus, setLoadingStatus] = useState('🔍 Carregando...')
  const [error, setError] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [hasDub, setHasDub] = useState(false)
  const [showShare, setShowShare] = useState(false)
  const [hasMoreEps, setHasMoreEps] = useState(false)
  const [epPage, setEpPage] = useState(1)
  const [copied, setCopied] = useState(false)

  // Carrega info + episódios
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

  // Carrega vídeo
  useEffect(() => {
    if (!anime) return
    let cancelled = false

    const run = async () => {
      setLoadingVideo(true); setError(false); setSources(null); setCurrentSrc(''); setProvider('')

      // Mensagens de progresso animadas
      const statusSteps = [
        '🔍 Buscando anime...',
        '📡 Conectando ao servidor...',
        '🎬 Carregando episódio...',
      ]
      let step = 0
      const stepTimer = setInterval(() => {
        step = (step + 1) % statusSteps.length
        if (!cancelled) setLoadingStatus(statusSteps[step])
      }, 2500)

      try {
        setLoadingStatus(isDub ? '🎙️ Buscando versão dublada...' : '🔍 Buscando anime...')

        // ── CHAMADA PRINCIPAL: tenta Gogoanime → Zoro → AnimePahe ──
        const result = await fetchSourcesWithFallback(anime, epNum, isDub, idsCache)

        if (cancelled) return
        clearInterval(stepTimer)

        // Salva IDs em cache para não ter que re-buscar ao mudar episódio
        setIdsCache(result.ids || {})
        setProvider(result.provider || '')
        setSources(result)

        const best = pickBestSource(result.sources || [])
        if (best) {
          setCurrentSrc(best.url)
          setLoadingStatus(`▶️ ${result.provider} — ${best.quality || 'Auto'}`)
        } else {
          throw new Error('Nenhuma fonte encontrada nos provedores.')
        }

        // Verifica dublagem em background
        if (!isDub) {
          fetchSourcesWithFallback(anime, 1, true, {})
            .then(() => { if (!cancelled) setHasDub(true) })
            .catch(() => {})
        }

      } catch (e) {
        clearInterval(stepTimer)
        console.error('[WatchPage]', e.message)
        if (!cancelled) {
          setError(true)
          setErrorMsg(e.message)
        }
      } finally {
        if (!cancelled) setLoadingVideo(false)
      }
    }

    run()
    return () => { cancelled = true }
  }, [anime, epNum, isDub])

  const goEp = (n, dub = isDub) => {
    // Mantém o cache de IDs para não re-buscar o slug
    setSearchParams({ ep: n, ...(dub ? { dub: '1' } : {}) })
  }

  const toggleDub = () => {
    setIdsCache({}) // limpa cache de dub/sub
    setSearchParams({ ep: epNum, ...(!isDub ? { dub: '1' } : {}) })
  }

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

  const prevEp = epNum > 1 ? epNum - 1 : null
  const nextEp = anime?.episodes && epNum < anime.episodes ? epNum + 1 : null
  const epTitle = episodes.find(e => e.mal_id === epNum)?.title || `Episódio ${epNum}`
  const filename = `${anime?.title_english || anime?.title || 'anime'} - EP${String(epNum).padStart(2,'0')}.mp4`
  const externalUrl = anime ? `https://gogoanime3.cc/${buildSlug(anime)}-episode-${epNum}` : '#'
  const waText = encodeURIComponent(`🔥 ${anime?.title_english || anime?.title} - EP${epNum}\n${window.location.href}`)

  return (
    <div className="watch-page">
      <div className="watch-layout">

        {/* ══ PLAYER ══ */}
        <div className="watch-main">
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
                  💡 Tentamos Gogoanime, Zoro e AnimePahe — todos falharam.<br/>
                  O Render gratuito hiberna após 15min. Aguarde 30s e tente novamente.
                </p>
                <div className="error-btns">
                  <button className="btn btn-primary" onClick={() => { setError(false); setLoadingVideo(true); setIdsCache({}) }}>
                    🔄 Tentar novamente
                  </button>
                  <a href={externalUrl} target="_blank" rel="noreferrer" className="btn btn-ghost">
                    🌐 GogoAnime
                  </a>
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

          {/* Provedor ativo */}
          {provider && !loadingVideo && !error && (
            <div className="provider-tag">✅ Via {provider}</div>
          )}

          {/* Dub / Leg */}
          <div className="audio-track-bar">
            <span className="audio-label">🎧 Áudio:</span>
            <div className="audio-toggle">
              <button className={`track-btn ${!isDub ? 'active' : ''}`} onClick={() => isDub && toggleDub()}>
                🇧🇷 Legendado
              </button>
              <button className={`track-btn ${isDub ? 'active' : ''}`} onClick={() => !isDub && toggleDub()}>
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

          {/* Nav episódios */}
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
                {isDub ? <span className="wbadge dub">🎙️ Dublado</span> : <span className="wbadge sub">🇧🇷 Legendado</span>}
                {anime.score && <span className="wbadge">⭐ {anime.score.toFixed(1)}</span>}
                {anime.status === 'Currently Airing' && <span className="wbadge live">🔴 Em Exibição</span>}
                {anime.type && <span className="wbadge">{anime.type}</span>}
              </div>
              {anime.synopsis && (
                <p className="watch-synopsis">{anime.synopsis.slice(0, 300)}{anime.synopsis.length > 300 ? '...' : ''}</p>
              )}
            </div>
          )}
        </div>

        {/* ══ SIDEBAR ══ */}
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
        
