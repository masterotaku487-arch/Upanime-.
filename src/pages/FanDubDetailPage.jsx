import { useState, useEffect } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import Comments from '../components/Comments'
import '@vidstack/react/player/styles/default/theme.css'
import '@vidstack/react/player/styles/default/layouts/video.css'
import { MediaPlayer, MediaProvider } from '@vidstack/react'
import { defaultLayoutIcons, DefaultVideoLayout } from '@vidstack/react/player/layouts/default'
import './FanDubDetailPage.css'

const API = 'https://studio-proxy.masterotaku487.workers.dev'

const FAN_PROXY = 'https://fan-proxy.masterotaku487.workers.dev'

function driveToSrc(url) {
  if (!url) return null
  const m = url.match(/drive\.google\.com\/file\/d\/([^/?]+)/)
  if (m) return `${FAN_PROXY}/stream?id=${m[1]}`
  const m2 = url.match(/[?&]id=([^&]+)/)
  if (m2) return `${FAN_PROXY}/stream?id=${m2[1]}`
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
  const [fullscreen, setFullscreen] = useState(false)

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

  const openCastTV = () => {
    const url = window.location.href
    window.location.href = `intent:${url}#Intent;package=com.instantbits.cast.webvideo;end`
    setTimeout(() => {
      if (!document.hidden) window.open('https://play.google.com/store/apps/details?id=com.instantbits.cast.webvideo', '_blank')
    }, 2000)
  }

  const toggleFS = () => {
    const el = document.getElementById('fandub-iframe')
    if (!document.fullscreenElement) {
      el?.requestFullscreen?.()
      setFullscreen(true)
    } else {
      document.exitFullscreen?.()
      setFullscreen(false)
    }
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
          <div className="fddetail-anime-tag">🎌 {fanDub.animeTitulo}</div>
          <h1 className="fddetail-titulo">{fanDub.titulo}</h1>
          <div className="fddetail-meta">
            <span className="fddetail-badge">🇧🇷 {fanDub.idioma}</span>
            <span className="fddetail-badge">{fanDub.qualidade}</span>
            <span className="fddetail-badge">📺 {totalEps} EP{totalEps > 1 ? 'S' : ''}</span>
          </div>
        </div>
      </div>

      {/* Estúdio */}
      <div className="fddetail-studio-bar" onClick={() => nav(`/fandubs?studio=${fanDub.studioId}`)}>
        {fanDub.studioLogo
          ? <img src={fanDub.studioLogo} alt={fanDub.studioNome} className="fddetail-studio-logo" />
          : <div className="fddetail-studio-avatar">🎙️</div>
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
            {t === 'assistir'  ? '▶ Assistir'
           : t === 'episodios' ? '📋 EPs'
           : t === 'elenco'    ? '🎙️ Elenco'
           : 'ℹ️ Info'}
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

          {/* Vidstack Player via fan-proxy */}
          <div className="fddetail-iframe-wrap">
            {videoSrc ? (
              <MediaPlayer
                src={videoSrc}
                title={epData?.titulo || fanDub.titulo}
                className="fddetail-iframe"
                playsInline
                crossOrigin
              >
                <MediaProvider />
                <DefaultVideoLayout icons={defaultLayoutIcons} />
              </MediaPlayer>
            ) : (
              <div className="fddetail-video-loading">⏳ Carregando...</div>
            )}
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
              🔗 <span>Compartilhar</span>
            </button>
            <button className="fddetail-acao-btn" onClick={openCastTV}>
              📡 <span>Cast TV</span>
            </button>
            <button className="fddetail-acao-btn" onClick={toggleFS}>
              ⛶ <span>Tela cheia</span>
            </button>
          </div>

          {/* Comentários — mesmo sistema dos animes */}
          <Comments animeId={`fandub-${id}`} ep={epAtual} />

          {/* Discord do estúdio */}
          {discord && (
            <a href={discord} target="_blank" rel="noopener noreferrer"
              className="fddetail-discord">
              <span className="fddetail-discord-icon">💬</span>
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
              <span className="fddetail-ep-num">EP {e.ep}</span>
              <span className="fddetail-ep-name">{e.titulo || `Episódio ${e.ep}`}</span>
              {epAtual === e.ep && <span className="fddetail-ep-playing">▶</span>}
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
                <div className="elenco-dublador">🎙️ {e.dublador}</div>
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
              <div className="fddetail-section-title">📝 Descrição</div>
              <p className="fddetail-descricao">{fanDub.descricao}</p>
            </div>
          )}
          {fanDub.tags?.length > 0 && (
            <div className="fddetail-section">
              <div className="fddetail-section-title">🏷️ Tags</div>
              <div className="fddetail-tags">
                {fanDub.tags.map((t, i) => <span key={i} className="fddetail-tag">{t}</span>)}
              </div>
            </div>
          )}
          <div className="fddetail-section">
            <div className="fddetail-section-title">⚖️ Direitos Autorais</div>
            <div className="fddetail-direitos">
              <p>{fanDub.direitos}</p>
              <p style={{ marginTop: 8, fontSize: '.78rem', opacity: .6 }}>
                Este é um fan-dub não oficial criado por fãs. Não possui vínculo com os detentores originais dos direitos do anime.
              </p>
            </div>
          </div>
          <div className="fddetail-section">
            <div className="fddetail-section-title">📊 Informações</div>
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
              <span className="fddetail-discord-icon">💬</span>
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
