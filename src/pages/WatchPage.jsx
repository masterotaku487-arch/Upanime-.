import { useState, useEffect } from 'react'
import { useParams, useSearchParams, Link } from 'react-router-dom'
import { FiChevronLeft, FiChevronRight } from 'react-icons/fi'
import { getAnimeById, getAnimeEpisodes } from '../services/api'
import './WatchPage.css'

// ─────────────────────────────────────────────────────────
// STREAMING via AnimeFire (Cloudflare Worker → animefire.plus)
// ─────────────────────────────────────────────────────────

const AF = '/api/animefire'

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
const buildSlugCandidates = (anime, dub = false) => {
  const titles = [
    anime.title,
    anime.title_english,
    anime.title_portuguese,
    ...(anime.titles || []).map(t => t.title),
  ].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i)

  const variants = new Set()
  for (const t of titles) {
    const noSeason   = stripSeason(t)
    const noSubtitle = stripSubtitle(noSeason)
    for (const v of [noSeason, noSubtitle, t]) {
      const s = slugify(v)
      if (s && s.length > 1) variants.add(s)
    }
  }

  const list = [...variants]
  if (!dub) return list
  return [...list.map(s => s + '-dublado'), ...list]
}

// Testa se slug existe no AnimeFire
const probeSlug = async (slug) => {
  try {
    const data = await afFetch({ action: 'info', slug })
    if (data.episodes?.length > 0 || data.title) return slug
  } catch { /* não existe */ }
  return null
}

// Resolve slug correto testando candidatos
const resolveSlug = async (anime, dub = false) => {
  const candidates = buildSlugCandidates(anime, dub)
  console.log('[AnimeFire] testando slugs:', candidates.join(', '))
  for (const slug of candidates) {
    const found = await probeSlug(slug)
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

const openMXPlayer = (url, title) => {
  window.location.href = `intent:${url}#Intent;package=com.mxtech.videoplayer.ad;S.title=${encodeURIComponent(title)};end`
  setTimeout(() => window.open(url, '_blank'), 900)
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
  const [status, setStatus] = useState('🇧🇷 Conectando ao AnimeFire...')
  const [error, setError] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [showShare, setShowShare] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    setAnime(null); setEpisodes([]); setAfSlug(null)
    Promise.allSettled([getAnimeById(id), getAnimeEpisodes(id, 1)]).then(([d, e]) => {
      if (d.status === 'fulfilled') setAnime(d.value.data)
      if (e.status === 'fulfilled') {
        setEpisodes(e.value.data || [])
        setHasMoreEps(e.value.pagination?.has_next_page || false)
      }
    })
    window.scrollTo(0, 0)
  }, [id])

  const doLoad = async (animeObj, ep, dub, cachedSlug) => {
    setLoading(true); setError(false); setSources([]); setCurrentSrc('')

    try {
      let slug = cachedSlug
      if (!slug) {
        setStatus('🔍 Localizando no AnimeFire...')
        slug = await resolveSlug(animeObj, dub)
        setAfSlug(slug)
      }

      setStatus(`📡 Carregando EP${ep}...`)
      const data = await afFetch({ action: 'video', slug, ep })
      const srcs = (data.sources || [])
      if (!srcs.length) throw new Error(`EP${ep} sem fontes (slug: ${slug})`)

      setSources(srcs)
      const best = bestQuality(srcs)
      setCurrentSrc(best?.url || '')
      setStatus(`✅ ${dub ? '🎙️ Dublado' : '🇧🇷 Legendado'} — ${best?.label || 'Auto'}`)

    } catch (e) {
      console.error('[WatchPage]', e)
      setError(true)
      setErrorMsg(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (anime) doLoad(anime, epNum, isDub, afSlug)
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
  const afExternal = afSlug
    ? `https://animefire.plus/animes/${afSlug}`
    : `https://animefire.plus`
  const prevEp = epNum > 1 ? epNum - 1 : null
  const nextEp = anime?.episodes && epNum < anime.episodes ? epNum + 1 : null
  const epTitle = episodes.find(e => e.mal_id === epNum)?.title || `Episódio ${epNum}`
  const filename = `${title} - EP${String(epNum).padStart(2, '0')}.mp4`

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
                <p className="loading-sub">Fonte: 🇧🇷 AnimeFire via Cloudflare</p>
              </div>
            ) : error ? (
              <div className="player-error">
                <span className="error-emoji">😵</span>
                <h3>Episódio indisponível</h3>
                <p className="error-msg">{errorMsg}</p>
                <p className="error-hint">💡 O AnimeFire pode não ter este anime. Tente no site diretamente.</p>
                <div className="error-btns">
                  <button className="btn btn-primary" onClick={() => doLoad(anime, epNum, isDub, null)}>
                    🔄 Tentar novamente
                  </button>
                  <a href={afExternal} target="_blank" rel="noreferrer" className="btn btn-ghost">
                    🇧🇷 AnimeFire
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

          {/* Dub / Leg + Qualidade */}
          <div className="audio-track-bar">
            <span className="audio-label">🎧 Áudio:</span>
            <div className="audio-toggle">
              <button className={`track-btn ${!isDub ? 'active' : ''}`} onClick={() => isDub && toggleDub()}>
                🇧🇷 Legendado
              </button>
              <button className={`track-btn ${isDub ? 'active' : ''}`} onClick={() => !isDub && toggleDub()}>
                🎙️ Dublado
              </button>
            </div>
            {sources.length > 1 && (
              <div className="quality-wrap">
                <span>📺</span>
                <select className="quality-select" value={currentSrc} onChange={e => setCurrentSrc(e.target.value)}>
                  {sources.map(s => (
                    <option key={s.url} value={s.url}>{s.label || 'Auto'}</option>
                  ))}
                </select>
              </div>
            )}
            {afSlug && !loading && !error && (
              <span className="provider-tag" style={{ marginLeft: 'auto' }}>✅ AnimeFire</span>
            )}
          </div>

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
            <a href={afExternal} target="_blank" rel="noreferrer" className="ext-btn">
              🇧🇷<span>AnimeFire</span>
            </a>
            <div className="share-container">
              <button className="ext-btn" onClick={() => setShowShare(o => !o)}>🔗<span>Share</span></button>
              {showShare && (
                <div className="share-dropdown">
                  <button onClick={() => {
                    navigator.clipboard.writeText(window.location.href)
                    setCopied(true); setTimeout(() => setCopied(false), 2000)
                  }}>{copied ? '✅ Copiado!' : '📋 Copiar link'}</button>
                  <a href={`https://wa.me/?text=${encodeURIComponent(`🔥 ${title} EP${epNum}\n${window.location.href}`)}`}
                    target="_blank" rel="noreferrer">💬 WhatsApp</a>
                  <a href={afExternal} target="_blank" rel="noreferrer">🇧🇷 AnimeFire</a>
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
    
