import { useState, useEffect } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import {
  FiShare2, FiCast, FiSmartphone, FiHeart, FiPlay, FiList, FiMic, FiInfo,
  FiTv, FiMessageCircle, FiFileText, FiTag, FiShield, FiBarChart2, FiStar,
} from 'react-icons/fi'
import Comments from '../components/Comments'
import VideoPlayer from '../components/VideoPlayer'
import { useFavorites } from '../context/FavoritesContext'
import { useAuth } from '../context/AuthContext'
import { getFanDubRankedScore } from '../services/supabase'
import { saveHistory } from '../services/history'
import './FanDubDetailPage.css'

const API = 'https://studio-proxy.masterotaku487.workers.dev'

const STUDIO_PROXY = 'https://studio-proxy.masterotaku487.workers.dev'

function driveToSrc(url) {
  if (!url) return null
  const m = url.match(/drive\.google\.com\/file\/d\/([^/?]+)/)
  if (m) return `${STUDIO_PROXY}/api/stream?id=${m[1]}`
  const m2 = url.match(/[?&]id=([^&]+)/)
  if (m2) return `${STUDIO_PROXY}/api/stream?id=${m2[1]}`
  return url
}

function discordUrl(raw) {
  if (!raw) return null
  if (raw.startsWith('http')) return raw
  return `https://${raw}`
}

export default function FanDubDetailPage() {
  const { id }  = useParams()
  const nav     = useNavigate()
  const [sp, setSp] = useSearchParams()
  const epAtual = parseInt(sp.get('ep') || '1')

  const [fanDub,    setFanDub]    = useState(null)
  const [studioData, setStudioData] = useState(null)
  const [loading,   setLoading]   = useState(true)
  const [tab,       setTab]       = useState('assistir')
  const [rating, setRating] = useState(null) // { score, totalLikes, totalFanDubs }
  const { toggle, isFav } = useFavorites()
  const { user, openLogin } = useAuth()

  // Carrega o fan-dub
  useEffect(() => {
    fetch(`${API}/api/fanDubs/${id}`)
      .then(r => r.json())
      .then(d => {
        setFanDub(d.fanDub)
        setLoading(false)
      })
  }, [id])

  // Carrega dados do estúdio (para pegar o Discord)
  useEffect(() => {
    if (!fanDub?.studioId) return
    fetch(`${API}/api/studios/${fanDub.studioId}`)
      .then(r => r.json())
      .then(d => setStudioData(d.studio))
      .catch(() => {})
  }, [fanDub?.studioId])

  // Nota (estrela) calculada a partir das curtidas, comparadas com os
  // outros fandubs
  useEffect(() => {
    if (!id) return
    getFanDubRankedScore(id).then(setRating)
  }, [id])

  // Salva no histórico (Continuar Assistindo)
  useEffect(() => {
    if (!fanDub) return
    const eps = Array.isArray(fanDub.listaEpisodios) && fanDub.listaEpisodios.length > 0
      ? fanDub.listaEpisodios
      : [{ ep: 1 }]
    saveHistory({
      mal_id: `fandub-${id}`,
      title: fanDub.titulo,
      title_english: fanDub.titulo,
      images: {
        jpg: {
          large_image_url: fanDub.capa || fanDub.animeCapa,
          image_url: fanDub.capa || fanDub.animeCapa,
        },
      },
      episodes: eps.length,
    }, epAtual)
  }, [fanDub, epAtual, id])

  if (loading) return (
    <div className="fddetail-loading">
      <div className="skeleton" style={{ width: '100%', height: 280, borderRadius: 0 }} />
      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div className="skeleton" style={{ height: 28, borderRadius: 8 }} />
        <div className="skeleton" style={{ height: 20, width: '60%', borderRadius: 8 }} />
      </div>
    </div>
  )
  if (!fanDub) return <div className="fddetail-error">Fan-dub não encontrado</div>

  const episodios = Array.isArray(fanDub.listaEpisodios) && fanDub.listaEpisodios.length > 0
    ? fanDub.listaEpisodios
    : [{ ep: 1, titulo: fanDub.titulo, url: fanDub.embedUrl }]

  const epData   = episodios.find(e => e.ep === epAtual) || episodios[0]
  const videoSrc = driveToSrc(epData?.url || fanDub.embedUrl)
  const totalEps = episodios.length

  const fanDubAsAnime = {
    mal_id: `fandub-${id}`,
    title: fanDub.titulo,
    title_english: fanDub.titulo,
    images: {
      jpg: {
        large_image_url: fanDub.capa || fanDub.animeCapa,
        image_url: fanDub.capa || fanDub.animeCapa,
      },
    },
    score: null,
    type: 'Fan-Dub',
    episodes: totalEps,
    status: null,
  }
  const favorited = isFav(`fandub-${id}`)
  const handleFav = () => {
    if (!user) { openLogin(); return }
    toggle(fanDubAsAnime)
  }

  const goEp = (n) => setSp({ ep: n })

  const compartilhar = () => {
    const url = window.location.href
    if (navigator.share) {
      navigator.share({ title: fanDub?.titulo, url })
    } else {
      navigator.clipboard?.writeText(url)
      alert('Link copiado!')
    }
  }

  const openNativePlayer = () => {
    const rawUrl = epData?.url || fanDub.embedUrl || ''
    const m = rawUrl.match(/drive\.google\.com\/file\/d\/([^/?]+)/)
    const fileId = m ? m[1] : null
    if (!fileId) return

    const videoUrl = `https://drive.usercontent.google.com/download?id=${fileId}&export=download&confirm=t`
    // Formato correto: "intent://" (barra dupla) + link SEM "https://" + "scheme=https;"
    const noScheme = videoUrl.replace(/^https?:\/\//, '')
    window.location.href = `intent://${noScheme}#Intent;scheme=https;action=android.intent.action.VIEW;type=video/mp4;end`
    setTimeout(() => {
      if (!document.hidden) window.open(`https://drive.google.com/file/d/${fileId}/view`, '_blank')
    }, 2000)
  }

  const openCastTV = () => {
    const url = window.location.href
    const noScheme = url.replace(/^https?:\/\//, '')
    window.location.href = `intent://${noScheme}#Intent;scheme=https;package=com.instantbits.cast.webvideo;end`
    setTimeout(() => {
      if (!document.hidden) window.open('https://play.google.com/store/apps/details?id=com.instantbits.cast.webvideo', '_blank')
    }, 2000)
  }

  const discord = discordUrl(studioData?.discord)

  return (
    <div className="fddetail-page">
      {/* Hero */}
      <div className="fddetail-hero">
        <img src={fanDub.capa || fanDub.animeCapa} alt={fanDub.titulo}
          className="fddetail-backdrop"
          onError={e => e.target.style.display = 'none'} />
        <div className="fddetail-grad" />
        <button className="fddetail-back" onClick={() => nav(-1)}>‹</button>
        <div className="fddetail-hero-info">
          <div className="fddetail-anime-tag">{fanDub.animeTitulo}</div>
          <h1 className="fddetail-titulo">{fanDub.titulo}</h1>
          <div className="fddetail-meta">
            {rating && (
              <span className="fddetail-badge fddetail-badge-score">
                <FiStar size={11} /> {rating.score.toFixed(1)}
              </span>
            )}
            <span className="fddetail-badge">🇧🇷 {fanDub.idioma}</span>
            <span className="fddetail-badge">{fanDub.qualidade}</span>
            <span className="fddetail-badge"><FiTv /> {totalEps} EP{totalEps > 1 ? 'S' : ''}</span>
            <button
              className={`fddetail-badge fddetail-fav-btn ${favorited ? 'active' : ''}`}
              onClick={handleFav}
              title={favorited ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
            >
              <FiHeart fill={favorited ? 'currentColor' : 'none'} /> {favorited ? 'Favoritado' : 'Favoritar'}
            </button>
          </div>
        </div>
      </div>

      {/* Estúdio */}
      <div className="fddetail-studio-bar" onClick={() => nav(`/fandubs?studio=${fanDub.studioId}`)}>
        {fanDub.studioLogo
          ? <img src={fanDub.studioLogo} alt={fanDub.studioNome} className="fddetail-studio-logo" />
          : <div className="fddetail-studio-avatar"><FiMic /></div>
        }
        <div>
          <div className="fddetail-studio-label">Estúdio de dublagem</div>
          <div className="fddetail-studio-nome">{fanDub.studioNome}</div>
        </div>
        <div style={{ marginLeft: 'auto', color: 'var(--muted)' }}>›</div>
      </div>

      {/* Tabs */}
      <div className="fddetail-tabs">
        {['assistir', 'episodios', 'elenco', 'info'].map(t => (
          <div key={t} className={`fddetail-tab ${tab === t ? 'active' : ''}`}
            onClick={() => setTab(t)}>
            {t === 'assistir'  ? <><FiPlay /> Assistir</>
           : t === 'episodios' ? <><FiList /> EPs</>
           : t === 'elenco'    ? <><FiMic /> Elenco</>
           : <><FiInfo /> Info</>}
          </div>
        ))}
      </div>

      {/* ── PLAYER ── */}
      {tab === 'assistir' && (
        <div className="fddetail-player-section">
          {/* Info do EP atual */}
          <div className="fddetail-ep-info">
            <span className="fddetail-ep-label">EP {epAtual}</span>
            {epData?.titulo && epData.titulo !== fanDub.titulo && (
              <span className="fddetail-ep-titulo">{epData.titulo}</span>
            )}
          </div>

          {/* Player nativo via studio-proxy */}
          <div className="fddetail-iframe-wrap">
            <VideoPlayer
              key={videoSrc}
              src={videoSrc}
              title={fanDub.titulo}
              animeId={`fandub-${id}`}
              epNum={epAtual}
            />
          </div>

          {/* Navegação de episódios */}
          {totalEps > 1 && (
            <div className="fddetail-ep-nav">
              <button className="fddetail-ep-btn"
                disabled={epAtual <= 1}
                onClick={() => epAtual > 1 && goEp(epAtual - 1)}>
                ‹ EP {epAtual - 1}
              </button>
              <span className="fddetail-ep-cur">EP {epAtual} / {totalEps}</span>
              <button className="fddetail-ep-btn"
                disabled={epAtual >= totalEps}
                onClick={() => epAtual < totalEps && goEp(epAtual + 1)}>
                EP {epAtual + 1} ›
              </button>
            </div>
          )}

          {/* Ações */}
          <div className="fddetail-acoes">
            <button className="fddetail-acao-btn" onClick={compartilhar}>
              <FiShare2 /> <span>Compartilhar</span>
            </button>
            <button className="fddetail-acao-btn" onClick={openCastTV}>
              <FiCast /> <span>Cast TV</span>
            </button>
            <button className="fddetail-acao-btn" onClick={openNativePlayer}>
              <FiSmartphone /> <span>Player</span>
            </button>
          </div>

          {/* Comentários — mesmo sistema dos animes */}
          <Comments animeId={`fandub-${id}`} ep={epAtual} />

          {/* Discord do estúdio */}
          {discord && (
            <a href={discord} target="_blank" rel="noopener noreferrer"
              className="fddetail-discord">
              <span className="fddetail-discord-icon"><FiMessageCircle /></span>
              <div className="fddetail-discord-text">
                <span className="fddetail-discord-label">Comunidade oficial</span>
                <span className="fddetail-discord-nome">Servidor do {fanDub.studioNome}</span>
              </div>
              <span className="fddetail-discord-arrow">›</span>
            </a>
          )}
        </div>
      )}

      {/* ── LISTA DE EPISÓDIOS ── */}
      {tab === 'episodios' && (
        <div className="fddetail-eps-list">
          {episodios.map(e => (
            <div key={e.ep}
              className={`fddetail-ep-item ${epAtual === e.ep ? 'active' : ''}`}
              onClick={() => { setTab('assistir'); goEp(e.ep) }}>
              <div className="fddetail-ep-thumb">
                {(fanDub.capa || fanDub.animeCapa) && (
                  <img src={fanDub.capa || fanDub.animeCapa} alt="" loading="lazy" />
                )}
                <div className="fddetail-ep-playmini">{epAtual === e.ep ? <FiPlay /> : null}</div>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="fddetail-ep-num">EP {e.ep} — {e.titulo || `Episódio ${e.ep}`}</div>
                {epAtual === e.ep && <span className="fddetail-ep-playing">Assistindo agora</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── ELENCO ── */}
      {tab === 'elenco' && (
        <div className="fddetail-elenco">
          {fanDub.elenco?.length > 0 ? (
            fanDub.elenco.map((e, i) => (
              <div key={i} className="fddetail-elenco-item">
                <div className="elenco-personagem">{e.personagem}</div>
                <div className="elenco-sep">→</div>
                <div className="elenco-dublador"><FiMic /> {e.dublador}</div>
              </div>
            ))
          ) : (
            <p style={{ color: 'var(--muted)', padding: '20px 16px' }}>Elenco não informado.</p>
          )}
        </div>
      )}

      {/* ── INFO ── */}
      {tab === 'info' && (
        <div className="fddetail-info-section">
          {fanDub.descricao && (
            <div className="fddetail-section">
              <div className="fddetail-section-title"><FiFileText /> Descrição</div>
              <p className="fddetail-descricao">{fanDub.descricao}</p>
            </div>
          )}
          {fanDub.tags?.length > 0 && (
            <div className="fddetail-section">
              <div className="fddetail-section-title"><FiTag /> Tags</div>
              <div className="fddetail-tags">
                {fanDub.tags.map((t, i) => <span key={i} className="fddetail-tag">{t}</span>)}
              </div>
            </div>
          )}
          <div className="fddetail-section">
            <div className="fddetail-section-title"><FiShield /> Direitos Autorais</div>
            <div className="fddetail-direitos">
              <p>{fanDub.direitos}</p>
              <p style={{ marginTop: 8, fontSize: '.78rem', opacity: .6 }}>
                Este é um fan-dub não oficial criado por fãs. Não possui vínculo com os detentores originais dos direitos do anime.
              </p>
            </div>
          </div>
          <div className="fddetail-section">
            <div className="fddetail-section-title"><FiBarChart2 /> Informações</div>
            <div className="fddetail-meta-grid">
              <div className="fddetail-meta-item"><span>Anime</span><strong>{fanDub.animeTitulo}</strong></div>
              <div className="fddetail-meta-item"><span>Episódios</span><strong>{totalEps}</strong></div>
              <div className="fddetail-meta-item"><span>Qualidade</span><strong>{fanDub.qualidade}</strong></div>
              <div className="fddetail-meta-item"><span>Idioma</span><strong>{fanDub.idioma}</strong></div>
              <div className="fddetail-meta-item"><span>Estúdio</span><strong>{fanDub.studioNome}</strong></div>
              <div className="fddetail-meta-item"><span>Publicado</span><strong>{new Date(fanDub.criadoEm).toLocaleDateString('pt-BR')}</strong></div>
            </div>
          </div>

          {/* Discord também na aba info */}
          {discord && (
            <a href={discord} target="_blank" rel="noopener noreferrer"
              className="fddetail-discord">
              <span className="fddetail-discord-icon"><FiMessageCircle /></span>
              <div className="fddetail-discord-text">
                <span className="fddetail-discord-label">Comunidade oficial</span>
                <span className="fddetail-discord-nome">Servidor do {fanDub.studioNome}</span>
              </div>
              <span className="fddetail-discord-arrow">›</span>
            </a>
          )}
        </div>
      )}
    </div>
  )
}
