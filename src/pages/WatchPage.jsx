import { useState, useEffect, useCallback } from 'react'
import { useParams, useSearchParams, Link } from 'react-router-dom'
import { FiChevronLeft, FiChevronRight } from 'react-icons/fi'
import { getAnimeById, getAnimeEpisodes } from '../services/api'
import { useTranslatedSynopsis } from '../services/translate'
import { saveHistory } from '../services/history'
import { recordWatched, ACHIEVEMENTS } from '../services/achievements'
import VideoPlayer from '../components/VideoPlayer'
import Comments from '../components/Comments'
import FeedbackModal from '../components/FeedbackModal'
import './WatchPage.css'

const loadPrefs = () => { try { return JSON.parse(localStorage.getItem('upanime_prefs')||'{}') } catch { return {} } }

// ─────────────────────────────────────────────────────────
// STREAMING via AnimeFire (Cloudflare Worker → animefire.plus)
// ─────────────────────────────────────────────────────────

const AF = 'https://animefire-proxy.masterotaku487.workers.dev'

// Redireciona vídeo pelo Vercel proxy (adiciona Referer correto)
const proxyUrl = (url) =>
  `/api/proxy?url=${encodeURIComponent(url)}`

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
// Padrão AnimeFire: {slug}-todos-os-episodios (leg) | {slug}-dublado-todos-os-episodios (dub)
const buildSlugCandidates = (anime, dub = false) => {
  const titles = [
    anime.title,
    anime.title_english,
    anime.title_portuguese,
    ...(anime.titles || []).map(t => t.title),
  ].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i)

  const bases = new Set()
  for (const t of titles) {
    const noSeason   = stripSeason(t)
    const noSubtitle = stripSubtitle(noSeason)
    for (const v of [noSeason, noSubtitle, t]) {
      const s = slugify(v)
      if (s && s.length > 1) bases.add(s)
    }
  }

  // Prioridade: título com season > título sem season
  // Ex: sousou-no-frieren-2nd-season antes de sousou-no-frieren
  // Isso evita que a T1 seja usada no lugar da T2
  const withSeason = []
  const withoutSeason = []

  for (const base of bases) {
    const isFull = [...bases].some(b => b !== base && base.startsWith(b))
    const target = isFull ? withSeason : withoutSeason

    if (dub) {
      target.push(base + '-dublado-todos-os-episodios')
      target.push(base + '-dublado')
    } else {
      target.push(base + '-todos-os-episodios')
    }
    target.push(base)
  }

  return [...new Set([...withSeason, ...withoutSeason])]
}

// Testa se slug existe E tem episódios no AnimeFire
const probeSlug = async (slug, isMovie = false) => {
  try {
    const data = await afFetch({ action: 'info', slug })
    // Filmes/OVAs podem ter 0 episódios listados mas ainda assim ter vídeo
    if (data.episodes?.length > 0) return slug
    if (isMovie && data.slug) return slug  // aceita para filmes mesmo sem eps listados
  } catch { /* não existe */ }
  return null
}

// Resolve slug correto testando candidatos
const resolveSlug = async (anime, dub = false) => {
  const isMovie = ['Movie', 'OVA', 'Special', 'TV Special', 'Music'].includes(anime.type)
  const candidates = buildSlugCandidates(anime, dub)
  console.log('[AnimeFire] testando slugs:', candidates.join(', '))

  // Para filmes, tenta direto action=video ep=1 em vez de info
  if (isMovie) {
    for (const slug of candidates) {
      try {
        const data = await afFetch({ action: 'video', slug, ep: 1 })
        if (data.sources?.length > 0) {
          console.log('[AnimeFire] ✅ (movie/ova direct)', slug)
          return slug
        }
      } catch { /* tenta próximo */ }
    }
  }

  for (const slug of candidates) {
    const found = await probeSlug(slug, isMovie)
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

const getDirectUrl = (url) =>
  url.includes('/api/proxy?url=') ? decodeURIComponent(url.split('url=')[1]) : url

const openMXPlayer = (url, title) => {
  const direct = getDirectUrl(url)
  window.location.href = `intent:${direct}#Intent;package=com.mxtech.videoplayer.ad;S.title=${encodeURIComponent(title)};end`
  setTimeout(() => {
    if (!document.hidden)
      window.location.href = 'https://play.google.com/store/apps/details?id=com.mxtech.videoplayer.ad'
  }, 2000)
}

const openCastTV = (url) => {
  const direct = getDirectUrl(url)
  window.location.href = `intent:${direct}#Intent;package=com.instantbits.cast.webvideo;S.title=Up+Anime%2B;end`
  setTimeout(() => {
    if (!document.hidden)
      window.location.href = 'https://play.google.com/store/apps/details?id=com.instantbits.cast.webvideo'
  }, 2000)
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
  const isDub = searchParams.get('dub') === '1' || 
    (searchParams.get('dub') === null && loadPrefs().audioMode === 'dub')

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
  const [newAchievements, setNewAchievements] = useState([]) // toast de conquistas
  const [showBugReport,   setShowBugReport]   = useState(false)

  useEffect(() => {
    setAnime(null); setEpisodes([]); setAfSlug(null)
    Promise.allSettled([getAnimeById(id), getAnimeEpisodes(id, 1)]).then(([d, e]) => {
      if (d.status === 'fulfilled') {
        const a = d.value.data
        setAnime(a)
        // Título dinâmico com ep: "Naruto EP 1 - Assistir | Up Anime+"
        const t = a.title_english || a.title || 'Anime'
        const epNum = searchParams.get('ep') || '1'
        document.title = `${t} EP ${epNum} - Assistir | Up Anime+`
      }
      if (e.status === 'fulfilled') {
        setEpisodes(e.value.data || [])
        setHasMoreEps(e.value.pagination?.has_next_page || false)
      }
    })
    window.scrollTo(0, 0)
    return () => {
      document.title = 'Up Anime+ | Assistir Animes Online Grátis em HD'
    }
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

      // Usa URL proxiada para garantir Referer correto
      const proxiedSrcs = srcs.map(s => ({ ...s, url: proxyUrl(s.url), directUrl: s.url }))
      setSources(proxiedSrcs)
      const best = bestQuality(proxiedSrcs)
      setCurrentSrc(best?.url || '')
      setStatus(`✅ ${dub ? '🎙️ Dublado' : '🇧🇷 Legendado'} — ${best?.label || 'Auto'}`)

    } catch (e) {
      console.warn('[AnimeFire] falhou, tentando animesonlinecc...', e.message)

      // ── Fallback 1: animesonlinecc.to via Worker ──
      try {
        const titleQuery = animeObj.title_english || animeObj.title
        setStatus('🔄 Tentando animesonlinecc.to...')

        const ccRes = await fetch(
          `https://animeonline-proxy.masterotaku487.workers.dev/?action=episode` +
          `&title=${encodeURIComponent(titleQuery)}&ep=${ep}&dub=${dub ? '1' : '0'}`
        )
        const ccData = await ccRes.json()

        if (ccData.sources?.length) {
          const mp4s = ccData.sources.filter(s => !s.isM3U8)
          const best = bestQuality(mp4s.length ? mp4s : ccData.sources)
          setSources(ccData.sources)
          setCurrentSrc(best?.url || ccData.sources[0].url)
          setStatus(`✅ animesonlinecc — ${best?.label || 'Auto'}`)
          setLoading(false)
          return
        }

        if (ccData.iframe) {
          setCurrentSrc('__embed__')
          setErrorMsg(ccData.iframe)
          setStatus('✅ animesonlinecc (embed)')
          setLoading(false)
          return
        }

        if (ccData.pageUrl) {
          setCurrentSrc('__embed__')
          setErrorMsg(ccData.pageUrl)
          setStatus('✅ animesonlinecc (página)')
          setLoading(false)
          return
        }
      } catch (ccErr) {
        console.warn('[animesonlinecc]', ccErr.message)
      }

      // ── Fallback 2: título em japonês ──
      if (animeObj.title !== animeObj.title_english) {
        try {
          setStatus('🔄 Tentando título original...')
          const ccRes2 = await fetch(
            `https://animeonline-proxy.masterotaku487.workers.dev/?action=episode` +
            `&title=${encodeURIComponent(animeObj.title)}&ep=${ep}&dub=${dub ? '1' : '0'}`
          )
          const ccData2 = await ccRes2.json()
          if (ccData2.sources?.length || ccData2.iframe || ccData2.pageUrl) {
            const src = ccData2.sources?.[0]?.url || ccData2.iframe || ccData2.pageUrl
            const isEmbed = !ccData2.sources?.length
            setSources(ccData2.sources || [])
            setCurrentSrc(isEmbed ? '__embed__' : src)
            if (isEmbed) setErrorMsg(ccData2.iframe || ccData2.pageUrl)
            setStatus(`✅ animesonlinecc (JP) — Auto`)
            setLoading(false)
            return
          }
        } catch {}
      }

      // ── Fallback 3: animesonline.cloud via Worker ─────────────
      try {
        const titleQuery = animeObj.title_english || animeObj.title
        setStatus('🔄 Tentando animesonline.cloud...')

        const hdRes = await fetch(
          `https://animesonlinecloud-proxy.masterotaku487.workers.dev/?action=episode` +
          `&title=${encodeURIComponent(titleQuery)}&ep=${ep}`
        )
        const hdData = await hdRes.json()

        if (hdData.sources?.length) {
          const mp4s = hdData.sources.filter(s => !s.isM3U8)
          const best = bestQuality(mp4s.length ? mp4s : hdData.sources)
          setSources(hdData.sources)
          setCurrentSrc(best?.url || hdData.sources[0].url)
          setStatus(`✅ animesonline.cloud — ${best?.label || 'Auto'}`)
          setLoading(false)
          return
        }
        if (hdData.iframe) {
          setCurrentSrc('__embed__')
          setErrorMsg(hdData.iframe)
          setStatus('✅ animesonline.cloud (embed)')
          setLoading(false)
          return
        }
        if (hdData.pageUrl) {
          setCurrentSrc('__embed__')
          setErrorMsg(hdData.pageUrl)
          setStatus('✅ animesonline.cloud (página)')
          setLoading(false)
          return
        }
      } catch (hdErr) {
        console.warn('[animesonlinecloud]', hdErr.message)
      }

      setError(true)
      setErrorMsg(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (anime) {
      doLoad(anime, epNum, isDub, afSlug)
      // Atualiza título com número do episódio atual
      const t = anime.title_english || anime.title || 'Anime'
      document.title = `${t} EP ${epNum} - Assistir | Up Anime+`
      // Salva no histórico
      saveHistory(anime, epNum)
    }
  }, [anime, epNum, isDub])

  // Abre MX Player automaticamente se configurado nas preferências
  useEffect(() => {
    if (!currentSrc || !anime) return
    const prefs = loadPrefs()
    if (prefs.playerMode === 'mx') {
      const t = anime.title_english || anime.title || ''
      openMXPlayer(currentSrc, `${t} EP${epNum}`)
    }
  }, [currentSrc])

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
  const synopsis = useTranslatedSynopsis(anime?.synopsis)
  const afExternal = afSlug
    ? `https://animefire.plus/animes/${afSlug}`
    : `https://animefire.plus`
  const prevEp = epNum > 1 ? epNum - 1 : null
  const nextEp = anime?.episodes && epNum < anime.episodes ? epNum + 1 : null
  const epTitle = episodes.find(e => e.mal_id === epNum)?.title || `Episódio ${epNum}`
  const filename = `${title} - EP${String(epNum).padStart(2, '0')}.mp4`

  return (
    <div className="watch-page">

      {/* Toast de conquistas desbloqueadas */}
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
                <p className="loading-sub">
                  {status.includes('animesonlinecc') ? 'Fonte: 🌐 animesonlinecc.to'
                   : status.includes('animesonlinecloud') ? 'Fonte: ☁️ animesonline.cloud'
                   : status.includes('Tentando')     ? '🔄 Buscando fontes...'
                   : 'Fonte: 🇧🇷 AnimeFire via Cloudflare'}
                </p>
              </div>
            ) : error ? (
              <div className="player-error">
                <span className="error-emoji">🎬</span>
                <h3>Abra no MX Player</h3>
                <p className="error-hint">O vídeo está disponível! Use o botão abaixo para assistir.</p>
                <div className="error-btns">
                  {currentSrc && (
                    <button className="btn btn-primary" onClick={() => openMXPlayer(currentSrc, `${title} EP${epNum}`)}>
                      🎬 Abrir MX Player
                    </button>
                  )}
                  <button className="btn btn-ghost" onClick={() => doLoad(anime, epNum, isDub, null)}>
                    🔄 Tentar novamente
                  </button>
                  <a href={afExternal} target="_blank" rel="noreferrer" className="btn btn-ghost">
                    🇧🇷 AnimeFire
                  </a>
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
                onError={() => {
                  const directUrl = sources.find(s => s.url === currentSrc)?.directUrl
                  if (directUrl && currentSrc !== directUrl) {
                    setCurrentSrc(directUrl)
                  } else {
                    setError(true)
                  }
                }}
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
              <span className="provider-tag" style={{ marginLeft: 'auto' }}>
                {status.includes('animesonlinecc') ? '🌐 animesonlinecc' : '✅ AnimeFire'}
              </span>
            )}
          </div>

          {/* Ações */}
          <div className="ext-actions">
            {currentSrc && (
              <>
                <button className="ext-btn"
                  onClick={() => openCastTV(currentSrc)}>
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
              {synopsis && (
                <p className="watch-synopsis">{synopsis.slice(0, 300)}{synopsis.length > 300 ? '...' : ''}</p>
              )}
            </div>
          )}

          {/* Comentários */}
          <Comments animeId={id} ep={epNum} />

          {/* Botão relatar bug do episódio */}
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