import { useState, useEffect } from 'react'
import { useParams, useSearchParams, Link } from 'react-router-dom'
import { FiChevronLeft, FiChevronRight, FiRefreshCw } from 'react-icons/fi'
import { getAnimeById, getAnimeEpisodes } from '../services/api'
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

const buildSlug = (title = '') =>
  title.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, '-')

// ── Lista de embeds — ordenados por confiabilidade ────────
// Cada um recebe { malId, slug, epNum, isDub }
const buildEmbeds = ({ malId, slug, title, epNum, isDub }) => [
  {
    name: '🌐 2Anime',
    url: `https://2anime.xyz/embed/${slug}-episode-${epNum}`,
  },
  {
    name: '🎬 AniPlay',
    url: `https://aniplay.co/embed/anime/${malId}/${epNum}`,
  },
  {
    name: '📺 AllAnime',
    url: `https://allanime.day/embed/anime/${malId}/ep/${epNum}`,
  },
  {
    name: '🔥 GogoEmbed',
    url: `https://gogoanime3.cc/embed/${slug}-episode-${epNum}`,
  },
  {
    name: '🎌 AniWorld',
    url: `https://aniwave.to/watch/${slug}/ep-${epNum}`,
  },
]

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
  const [embedIdx, setEmbedIdx] = useState(0)
  const [showShare, setShowShare] = useState(false)
  const [copied, setCopied] = useState(false)
  const [iframeKey, setIframeKey] = useState(0)

  useEffect(() => {
    setAnime(null); setEpisodes([]); setEmbedIdx(0)
    Promise.allSettled([getAnimeById(id), getAnimeEpisodes(id, 1)]).then(([d, e]) => {
      if (d.status === 'fulfilled') setAnime(d.value.data)
      if (e.status === 'fulfilled') {
        setEpisodes(e.value.data || [])
        setHasMoreEps(e.value.pagination?.has_next_page || false)
      }
    })
    window.scrollTo(0, 0)
  }, [id])

  // Reset embed ao trocar episódio
  useEffect(() => { setEmbedIdx(0); setIframeKey(k => k + 1) }, [epNum])

  const goEp = (n) => setSearchParams({ ep: n, ...(isDub ? { dub: '1' } : {}) })
  const nextEmbed = () => { setEmbedIdx(i => i + 1); setIframeKey(k => k + 1) }
  const reloadEmbed = () => setIframeKey(k => k + 1)

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

  const title = anime?.title_english || anime?.title || ''
  const slug = buildSlug(title)
  const malId = parseInt(id)
  const embeds = buildEmbeds({ malId, slug, title, epNum, isDub })
  const currentEmbed = embeds[embedIdx]
  const hasMoreEmbeds = embedIdx < embeds.length - 1

  const prevEp = epNum > 1 ? epNum - 1 : null
  const nextEp = anime?.episodes && epNum < anime.episodes ? epNum + 1 : null
  const epTitle = episodes.find(e => e.mal_id === epNum)?.title || `Episódio ${epNum}`
  const externalUrl = `https://gogoanime3.cc/${slug}-episode-${epNum}`
  const waText = encodeURIComponent(`🔥 ${title} - EP${epNum}\n${window.location.href}`)
  const filename = `${title} - EP${String(epNum).padStart(2,'0')}.mp4`

  return (
    <div className="watch-page">
      <div className="watch-layout">
        <div className="watch-main">

          {/* Player iframe */}
          <div className="player-wrap">
            {currentEmbed ? (
              <>
                <iframe
                  key={`${iframeKey}-${embedIdx}-${epNum}`}
                  src={currentEmbed.url}
                  className="video-iframe"
                  allowFullScreen
                  allow="autoplay; fullscreen; picture-in-picture"
                  referrerPolicy="no-referrer"
                  scrolling="no"
                  frameBorder="0"
                />
                {/* Overlay de fallback visível apenas via JS se iframe falhar */}
              </>
            ) : (
              <div className="player-error">
                <span className="error-emoji">😵</span>
                <h3>Todos os servidores tentados</h3>
                <p className="error-hint">Tente assistir diretamente no site do anime.</p>
                <div className="error-btns">
                  <button className="btn btn-primary" onClick={() => { setEmbedIdx(0); setIframeKey(k=>k+1) }}>🔄 Recomeçar</button>
                  <a href={externalUrl} target="_blank" rel="noreferrer" className="btn btn-ghost">🌐 GogoAnime</a>
                </div>
              </div>
            )}
          </div>

          {/* Barra de servidor */}
          <div className="server-bar">
            <span className="server-label">📡 Servidor:</span>
            <div className="server-tabs">
              {embeds.map((e, i) => (
                <button
                  key={i}
                  className={`server-tab ${i === embedIdx ? 'active' : ''}`}
                  onClick={() => { setEmbedIdx(i); setIframeKey(k=>k+1) }}
                >
                  {e.name}
                </button>
              ))}
            </div>
            <button className="reload-btn" onClick={reloadEmbed} title="Recarregar">
              <FiRefreshCw size={14} />
            </button>
          </div>

          {/* Dica se não carregar */}
          <div className="server-hint">
            💡 Se o vídeo não aparecer, troque de servidor acima. Alguns bloqueiam iframes — nesses casos use o botão <strong>🌐 GogoAnime</strong>.
          </div>

          {/* Ações */}
          <div className="ext-actions">
            <a href={externalUrl} target="_blank" rel="noreferrer" className="ext-btn">
              🌐<span>GogoAnime</span>
            </a>
            <button className="ext-btn" onClick={() => openWebVideoCast(currentEmbed?.url || externalUrl)}>
              📡<span>Cast TV</span>
            </button>
            <button className="ext-btn" onClick={() => openADM(externalUrl, filename)}>
              ⬇️<span>Baixar</span>
            </button>
            <button className="ext-btn" onClick={() => openMXPlayer(externalUrl, `${title} EP${epNum}`)}>
              🎬<span>MX Player</span>
            </button>
            <div className="share-container">
              <button className="ext-btn" onClick={() => setShowShare(o=>!o)}>
                🔗<span>Share</span>
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
                <p className="watch-synopsis">{anime.synopsis.slice(0,300)}{anime.synopsis.length>300?'...':''}</p>
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
            
