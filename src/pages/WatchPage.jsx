import { useState, useEffect } from 'react'
import { useParams, useSearchParams, Link } from 'react-router-dom'
import { FiChevronLeft, FiChevronRight } from 'react-icons/fi'
import { getAnimeById, getAnimeEpisodes } from '../services/api'
import './WatchPage.css'

const CONSUMET = import.meta.env.VITE_CONSUMET_URL || 'https://api.consumet.org'

// ─────────────────────────────────────────────────────────
// SISTEMA DE STREAMING — AnimeFire (PT-BR) + Fallbacks
// ─────────────────────────────────────────────────────────

const log = (...a) => console.log('[Watch]', ...a)
const warn = (...a) => console.warn('[Watch]', ...a)

// Gera variações de título para busca
const getTitles = (anime) => [
  anime.title,                          // japonês/romaji
  anime.title_english,                  // inglês
  ...(anime.titles || []).map(t => t.title),
].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i)

// GET com timeout e retorno null em falha
const safeFetch = async (url, timeout = 15000) => {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(timeout) })
    if (!r.ok) { warn(`HTTP ${r.status}`, url); return null }
    return await r.json()
  } catch(e) { warn('fetch error:', e.message, url); return null }
}

// ── PROVEDOR 1: AnimeFire (Consumet) — PT-BR ──────────────
const tryAnimeFire = async (anime, epNum, setStatus) => {
  const titles = getTitles(anime)
  setStatus('🇧🇷 Buscando no AnimeFire...')

  for (const title of titles) {
    const search = await safeFetch(`${CONSUMET}/anime/animefire/${encodeURIComponent(title)}`)
    const match = search?.results?.[0]
    if (!match) continue

    log('AnimeFire match:', match.id, 'via', title)
    setStatus(`📡 AnimeFire: carregando EP${epNum}...`)

    const info = await safeFetch(`${CONSUMET}/anime/animefire/info?id=${encodeURIComponent(match.id)}`)
    const eps = info?.episodes || []
    const ep = eps.find(e => e.number === epNum) || eps[epNum - 1]
    if (!ep) continue

    const src = await safeFetch(`${CONSUMET}/anime/animefire/watch?episodeId=${encodeURIComponent(ep.id)}`)
    if (src?.sources?.length) {
      log('AnimeFire OK!', src.sources.length, 'fontes')
      return { ...src, provider: '🇧🇷 AnimeFire' }
    }
  }
  return null
}

// ── PROVEDOR 2: meta/anilist → gogoanime ──────────────────
const tryAnilistGogo = async (anime, epNum, setStatus) => {
  const titles = getTitles(anime)
  setStatus('🔍 Buscando via AniList+Gogoanime...')

  for (const title of titles) {
    const search = await safeFetch(`${CONSUMET}/meta/anilist/${encodeURIComponent(title)}`)
    const aid = search?.results?.[0]?.id
    if (!aid) continue

    const info = await safeFetch(`${CONSUMET}/meta/anilist/info/${aid}?provider=gogoanime`)
    const ep = (info?.episodes || []).find(e => e.number === epNum) || (info?.episodes || [])[epNum - 1]
    if (!ep) continue

    setStatus('📡 AniList+GogoAnime: carregando...')
    const src = await safeFetch(`${CONSUMET}/meta/anilist/watch/${encodeURIComponent(ep.id)}?provider=gogoanime`)
    if (src?.sources?.length) {
      log('AniList+Gogo OK!')
      return { ...src, provider: '🌐 GogoAnime' }
    }
  }
  return null
}

// ── PROVEDOR 3: meta/anilist → zoro ──────────────────────
const tryAnilistZoro = async (anime, epNum, setStatus) => {
  const titles = getTitles(anime)
  setStatus('🔍 Buscando via AniList+Zoro...')

  for (const title of titles) {
    const search = await safeFetch(`${CONSUMET}/meta/anilist/${encodeURIComponent(title)}`)
    const aid = search?.results?.[0]?.id
    if (!aid) continue

    const info = await safeFetch(`${CONSUMET}/meta/anilist/info/${aid}?provider=zoro`)
    const ep = (info?.episodes || []).find(e => e.number === epNum) || (info?.episodes || [])[epNum - 1]
    if (!ep) continue

    setStatus('📡 AniList+Zoro: carregando...')
    const src = await safeFetch(`${CONSUMET}/meta/anilist/watch/${encodeURIComponent(ep.id)}?provider=zoro`)
    if (src?.sources?.length) {
      log('AniList+Zoro OK!')
      return { ...src, provider: '⚔️ Zoro' }
    }
  }
  return null
}

// ── PROVEDOR 4: AnimePahe ─────────────────────────────────
const tryAnimePahe = async (anime, epNum, setStatus) => {
  const titles = getTitles(anime)
  setStatus('🔍 Buscando no AnimePahe...')

  for (const title of titles) {
    const search = await safeFetch(`${CONSUMET}/anime/animepahe/${encodeURIComponent(title)}`)
    const match = search?.results?.[0]
    if (!match) continue

    const info = await safeFetch(`${CONSUMET}/anime/animepahe/info/${encodeURIComponent(match.id)}`)
    const ep = (info?.episodes || []).find(e => e.number === epNum) || (info?.episodes || [])[epNum - 1]
    if (!ep) continue

    setStatus('📡 AnimePahe: carregando...')
    const src = await safeFetch(`${CONSUMET}/anime/animepahe/watch?episodeId=${encodeURIComponent(ep.id)}`)
    if (src?.sources?.length) {
      log('AnimePahe OK!')
      return { ...src, provider: '🎌 AnimePahe' }
    }
  }
  return null
}

// ── ORQUESTRADOR ──────────────────────────────────────────
const loadSources = async (anime, epNum, setStatus) => {
  // Tenta em ordem de preferência
  const result =
    await tryAnimeFire(anime, epNum, setStatus) ||
    await tryAnilistGogo(anime, epNum, setStatus) ||
    await tryAnilistZoro(anime, epNum, setStatus) ||
    await tryAnimePahe(anime, epNum, setStatus)

  if (!result) throw new Error('Nenhum provedor funcionou. Render pode estar offline.')
  return result
}

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
const openADM = (url, fn) => {
  window.location.href = `adm://add?url=${encodeURIComponent(url)}&filename=${encodeURIComponent(fn)}`
  setTimeout(() => window.open(url, '_blank'), 900)
}

// ─────────────────────────────────────────────────────────
export default function WatchPage() {
  const { id } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const epNum = parseInt(searchParams.get('ep') || '1')

  const [anime, setAnime] = useState(null)
  const [episodes, setEpisodes] = useState([])
  const [hasMoreEps, setHasMoreEps] = useState(false)
  const [epPage, setEpPage] = useState(1)

  const [result, setResult] = useState(null)
  const [currentSrc, setCurrentSrc] = useState('')
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState('🔍 Iniciando...')
  const [error, setError] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [showShare, setShowShare] = useState(false)
  const [copied, setCopied] = useState(false)

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

  const doLoad = (animeObj, ep) => {
    setLoading(true); setError(false); setResult(null); setCurrentSrc('')
    loadSources(animeObj, ep, setStatus)
      .then(r => { setResult(r); setCurrentSrc(bestSource(r.sources)?.url || '') })
      .catch(e => { setError(true); setErrorMsg(e.message) })
      .finally(() => setLoading(false))
  }

  useEffect(() => { if (anime) doLoad(anime, epNum) }, [anime, epNum])

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
  const externalUrl = `https://animefire.plus/pesquisar/${encodeURIComponent(anime?.title || '')}`
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
                <p className="loading-sub">Testando AnimeFire → GogoAnime → Zoro → AnimePahe</p>
              </div>
            ) : error ? (
              <div className="player-error">
                <span className="error-emoji">😵</span>
                <h3>Todos os provedores falharam</h3>
                <p className="error-msg">{errorMsg}</p>
                <p className="error-hint">💡 Verifique se o Render está online e o <code>VITE_CONSUMET_URL</code> está no Vercel.</p>
                <div className="error-btns">
                  <button className="btn btn-primary" onClick={() => doLoad(anime, epNum)}>
                    🔄 Tentar novamente
                  </button>
                  <a href={externalUrl} target="_blank" rel="noreferrer" className="btn btn-ghost">
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
                onError={() => { setError(true); setErrorMsg('Erro ao reproduzir o vídeo.') }}
              />
            ) : null}
          </div>

          {/* Info provedor + qualidade */}
          {!loading && !error && result && (
            <div className="provider-bar">
              <span className="provider-tag">✅ {result.provider}</span>
              {result.sources?.length > 1 && (
                <div className="quality-wrap">
                  <span>📺 Qualidade:</span>
                  <select className="quality-select" value={currentSrc} onChange={e => setCurrentSrc(e.target.value)}>
                    {result.sources.map(s => (
                      <option key={s.url} value={s.url}>{s.quality || 'Auto'}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}

          {/* Botões ação */}
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
                <button className="ext-btn" onClick={() => openMXPlayer(currentSrc, `${title} EP${epNum}`)}>
                  🎬<span>MX Player</span>
                </button>
              </>
            )}
            <a href={externalUrl} target="_blank" rel="noreferrer" className="ext-btn">
              🇧🇷<span>AnimeFire</span>
            </a>
            <div className="share-container">
              <button className="ext-btn" onClick={() => setShowShare(o => !o)}>🔗<span>Share</span></button>
              {showShare && (
                <div className="share-dropdown">
                  <button onClick={() => { navigator.clipboard.writeText(window.location.href); setCopied(true); setTimeout(() => setCopied(false), 2000) }}>
                    {copied ? '✅ Copiado!' : '📋 Copiar link'}
                  </button>
                  <a href={`https://wa.me/?text=${encodeURIComponent(`🔥 ${title} - EP${epNum}\n${window.location.href}`)}`} target="_blank" rel="noreferrer">
                    💬 WhatsApp
                  </a>
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
                                                                        
