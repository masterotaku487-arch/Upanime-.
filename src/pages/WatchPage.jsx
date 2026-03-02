import { useState, useEffect, useRef } from 'react'
import { useParams, useSearchParams, Link } from 'react-router-dom'
import { FiChevronLeft, FiChevronRight, FiRefreshCw, FiExternalLink } from 'react-icons/fi'
import { getAnimeById, getAnimeEpisodes } from '../services/api'
import './WatchPage.css'

const CONSUMET = import.meta.env.VITE_CONSUMET_URL || 'https://api.consumet.org'

// ── Busca via /meta/anilist (mais estável que gogoanime direto) ──
const fetchViaAnilist = async (anime, epNum, setStatus) => {
  const titles = [
    anime.title_english,
    anime.title,
    ...(anime.titles || []).map(t => t.title),
  ].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i)

  // Tenta cada título até achar no AniList
  let anilistId = null
  for (const title of titles) {
    try {
      setStatus(`🔍 Buscando "${title}"...`)
      const r = await fetch(`${CONSUMET}/meta/anilist/${encodeURIComponent(title)}`, {
        signal: AbortSignal.timeout(12000)
      })
      if (!r.ok) continue
      const j = await r.json()
      if (j.results?.length > 0) {
        anilistId = j.results[0].id
        console.log(`[AniList] ID: ${anilistId} via "${title}"`)
        break
      }
    } catch(e) { console.warn('[AniList search]', e.message) }
  }

  if (!anilistId) throw new Error('Anime não encontrado no AniList')

  // Tenta provedores em ordem
  const providers = ['gogoanime', 'zoro', 'animepahe']
  for (const provider of providers) {
    try {
      setStatus(`📡 Buscando episódios via ${provider}...`)
      const infoR = await fetch(
        `${CONSUMET}/meta/anilist/info/${anilistId}?provider=${provider}`,
        { signal: AbortSignal.timeout(15000) }
      )
      if (!infoR.ok) continue
      const info = await infoR.json()
      const eps = info.episodes || []
      if (eps.length === 0) continue

      const ep = eps.find(e => e.number === epNum) || eps[epNum - 1]
      if (!ep) continue

      setStatus(`🎬 Carregando vídeo (${provider})...`)
      const srcR = await fetch(
        `${CONSUMET}/meta/anilist/watch/${encodeURIComponent(ep.id)}?provider=${provider}`,
        { signal: AbortSignal.timeout(15000) }
      )
      if (!srcR.ok) continue
      const src = await srcR.json()
      if (!src.sources?.length) continue

      console.log(`[Watch] ${provider} OK! ${src.sources.length} fontes`)
      return { ...src, provider }
    } catch(e) { console.warn(`[${provider}]`, e.message) }
  }

  throw new Error('Todos os provedores falharam')
}

// Escolhe melhor qualidade
const bestSource = (sources = []) => {
  for (const q of ['1080p', '720p', '480p', '360p', 'default']) {
    const f = sources.find(s => s.quality === q)
    if (f) return f
  }
  return sources[0]
}

const openMXPlayer = (url, title) => {
  window.location.href = `intent:${url}#Intent;package=com.mxtech.videoplayer.ad;S.title=${encodeURIComponent(title)};end`
  setTimeout(() => window.open(url, '_blank'), 900)
}
const openADM = (url, filename) => {
  window.location.href = `adm://add?url=${encodeURIComponent(url)}&filename=${encodeURIComponent(filename)}`
  setTimeout(() => window.open(url, '_blank'), 900)
}

// ── Componente ────────────────────────────────────────────
export default function WatchPage() {
  const { id } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const epNum = parseInt(searchParams.get('ep') || '1')

  const [anime, setAnime] = useState(null)
  const [episodes, setEpisodes] = useState([])
  const [hasMoreEps, setHasMoreEps] = useState(false)
  const [epPage, setEpPage] = useState(1)

  const [sources, setSources] = useState(null)
  const [currentSrc, setCurrentSrc] = useState('')
  const [provider, setProvider] = useState('')
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState('🔍 Iniciando...')
  const [error, setError] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [showShare, setShowShare] = useState(false)
  const [copied, setCopied] = useState(false)

  // Carrega anime + episódios
  useEffect(() => {
    setAnime(null); setEpisodes([])
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
    setLoading(true); setError(false); setSources(null); setCurrentSrc(''); setProvider('')

    fetchViaAnilist(anime, epNum, (msg) => { if (!cancelled) setStatus(msg) })
      .then(result => {
        if (cancelled) return
        setSources(result)
        setProvider(result.provider)
        const best = bestSource(result.sources)
        if (best) setCurrentSrc(best.url)
      })
      .catch(e => {
        if (cancelled) return
        setError(true)
        setErrorMsg(e.message)
      })
      .finally(() => { if (!cancelled) setLoading(false) })

    return () => { cancelled = true }
  }, [anime, epNum])

  const goEp = (n) => setSearchParams({ ep: n })

  const loadMoreEps = async () => {
    const next = epPage + 1
    const data = await getAnimeEpisodes(id, next)
    setEpisodes(p => [...p, ...(data.data || [])])
    setHasMoreEps(data.pagination?.has_next_page || false)
    setEpPage(next)
  }

  const title = anime?.title_english || anime?.title || ''
  const slug = title.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, '-')
  const externalUrl = `https://anitaku.so/${slug}-episode-${epNum}`
  const prevEp = epNum > 1 ? epNum - 1 : null
  const nextEp = anime?.episodes && epNum < anime.episodes ? epNum + 1 : null
  const epTitle = episodes.find(e => e.mal_id === epNum)?.title || `Episódio ${epNum}`
  const filename = `${title} - EP${String(epNum).padStart(2,'0')}.mp4`

  return (
    <div className="watch-page">
      <div className="watch-layout">
        <div className="watch-main">

          {/* Player */}
          <div className="player-wrap">
            {loading ? (
              <div className="player-loading">
                <div className="loading-ring" />
                <img src="/logo.png" className="loading-logo" alt="" />
                <p className="loading-text">{status}</p>
                <p className="loading-sub">Tentando múltiplos servidores automaticamente...</p>
              </div>
            ) : error ? (
              <div className="player-error">
                <span className="error-emoji">😵</span>
                <h3>Vídeo indisponível</h3>
                <p className="error-msg">{errorMsg}</p>
                <p className="error-hint">
                  💡 Verifique se o Consumet no Render está online e se
                  <code>VITE_CONSUMET_URL</code> está configurado no Vercel.
                </p>
                <div className="error-btns">
                  <button className="btn btn-primary" onClick={() => {
                    setError(false); setLoading(true)
                    fetchViaAnilist(anime, epNum, setStatus)
                      .then(r => { setSources(r); setProvider(r.provider); setCurrentSrc(bestSource(r.sources)?.url || '') })
                      .catch(e => { setError(true); setErrorMsg(e.message) })
                      .finally(() => setLoading(false))
                  }}>🔄 Tentar novamente</button>
                  <a href={externalUrl} target="_blank" rel="noreferrer" className="btn btn-ghost">
                    🌐 Anitaku
                  </a>
                </div>
              </div>
            ) : currentSrc ? (
              <video
                key={currentSrc}
                src={currentSrc}
                controls autoPlay playsInline
                className="video-player"
                onError={() => { setError(true); setErrorMsg('Erro ao reproduzir. Link pode ter expirado.') }}
              />
            ) : null}
          </div>

          {/* Provedor + qualidade */}
          {!loading && !error && (
            <div className="provider-bar">
              {provider && <span className="provider-tag">✅ {provider}</span>}
              {sources?.sources?.length > 1 && (
                <div className="quality-wrap">
                  <span>📺</span>
                  <select
                    className="quality-select"
                    value={currentSrc}
                    onChange={e => setCurrentSrc(e.target.value)}
                  >
                    {sources.sources.map(s => (
                      <option key={s.url} value={s.url}>{s.quality || 'Auto'}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}

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
                  onClick={() => openMXPlayer(currentSrc, `${title} EP${epNum}`)}>
                  🎬<span>MX Player</span>
                </button>
              </>
            )}
            <a href={externalUrl} target="_blank" rel="noreferrer" className="ext-btn">
              🌐<span>Anitaku</span>
            </a>
            <div className="share-container">
              <button className="ext-btn" onClick={() => setShowShare(o => !o)}>
                🔗<span>Share</span>
              </button>
              {showShare && (
                <div className="share-dropdown">
                  <button onClick={() => {
                    navigator.clipboard.writeText(window.location.href)
                    setCopied(true); setTimeout(() => setCopied(false), 2000)
                  }}>{copied ? '✅ Copiado!' : '📋 Copiar link'}</button>
                  <a href={`https://wa.me/?text=${encodeURIComponent(`🔥 ${title} - EP${epNum}\n${window.location.href}`)}`}
                    target="_blank" rel="noreferrer">💬 WhatsApp</a>
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
              <Link to={`/anime/${id}`} className="back-link">← {title}</Link>
              <h1 className="watch-anime-title">{title}</h1>
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
