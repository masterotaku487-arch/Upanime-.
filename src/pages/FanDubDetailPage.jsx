import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import './FanDubDetailPage.css'

const API = 'https://studio-proxy.masterotaku487.workers.dev'

export default function FanDubDetailPage() {
  const { id } = useParams()
  const nav    = useNavigate()
  const [fanDub, setFanDub] = useState(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('assistir')

  useEffect(() => {
    fetch(`${API}/api/fanDubs/${id}`)
      .then(r => r.json())
      .then(d => { setFanDub(d.fanDub); setLoading(false) })
  }, [id])

  if (loading) return <div className="fddetail-loading"><div className="skeleton" style={{width:'100%',height:280}} /></div>
  if (!fanDub) return <div className="fddetail-error">Fan-dub não encontrado</div>

  return (
    <div className="fddetail-page">
      {/* Hero */}
      <div className="fddetail-hero">
        <img src={fanDub.capa || fanDub.animeCapa} alt={fanDub.titulo} className="fddetail-backdrop" />
        <div className="fddetail-grad" />
        <button className="fddetail-back" onClick={() => nav(-1)}>‹</button>
        <div className="fddetail-hero-info">
          <div className="fddetail-anime-tag">🎌 {fanDub.animeTitulo}</div>
          <h1 className="fddetail-titulo">{fanDub.titulo}</h1>
          <div className="fddetail-meta">
            <span className="fddetail-badge">🇧🇷 {fanDub.idioma}</span>
            <span className="fddetail-badge">{fanDub.qualidade}</span>
            <span className="fddetail-badge">📺 {fanDub.episodios} EP{fanDub.episodios>1?'S':''}</span>
          </div>
        </div>
      </div>

      {/* Estúdio */}
      <div className="fddetail-studio-bar" onClick={() => nav(`/fandubs?studio=${fanDub.studioId}`)}>
        {fanDub.studioLogo && <img src={fanDub.studioLogo} alt={fanDub.studioNome} className="fddetail-studio-logo" />}
        <div>
          <div className="fddetail-studio-label">Estúdio de dublagem</div>
          <div className="fddetail-studio-nome">{fanDub.studioNome}</div>
        </div>
        <div style={{marginLeft:'auto',color:'var(--muted)'}}>›</div>
      </div>

      {/* Tabs */}
      <div className="fddetail-tabs">
        {['assistir','elenco','info'].map(t => (
          <div key={t} className={`fddetail-tab ${tab===t?'active':''}`} onClick={() => setTab(t)}>
            {t==='assistir'?'▶ Assistir':t==='elenco'?'🎙️ Elenco':'ℹ️ Info'}
          </div>
        ))}
      </div>

      {/* Player */}
      {tab === 'assistir' && (
        <div className="fddetail-player-section">
          {fanDub.trailer && (
            <div className="fddetail-trailer-label">🎬 Trailer</div>
          )}
          <iframe
            className="fddetail-iframe"
            src={fanDub.embedUrl}
            allowFullScreen
            allow="autoplay; fullscreen"
            referrerPolicy="origin"
          />
          {fanDub.downloadUrl && (
            <a href={fanDub.downloadUrl} target="_blank" rel="noopener noreferrer" className="fddetail-download">
              ⬇️ Download do Fan-Dub
            </a>
          )}
        </div>
      )}

      {/* Elenco */}
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
            <p style={{color:'var(--muted)',padding:'20px 0'}}>Elenco não informado.</p>
          )}
        </div>
      )}

      {/* Info */}
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
                {fanDub.tags.map((t,i) => <span key={i} className="fddetail-tag">{t}</span>)}
              </div>
            </div>
          )}
          <div className="fddetail-section">
            <div className="fddetail-section-title">⚖️ Direitos Autorais</div>
            <div className="fddetail-direitos">
              <p>{fanDub.direitos}</p>
              <p style={{marginTop:8,fontSize:'.78rem',opacity:.6}}>
                Este é um fan-dub não oficial criado por fãs. Não possui vínculo com os detentores originais dos direitos do anime.
              </p>
            </div>
          </div>
          <div className="fddetail-section">
            <div className="fddetail-section-title">📊 Informações</div>
            <div className="fddetail-meta-grid">
              <div className="fddetail-meta-item"><span>Anime</span><strong>{fanDub.animeTitulo}</strong></div>
              <div className="fddetail-meta-item"><span>Episódios</span><strong>{fanDub.episodios}</strong></div>
              <div className="fddetail-meta-item"><span>Qualidade</span><strong>{fanDub.qualidade}</strong></div>
              <div className="fddetail-meta-item"><span>Idioma</span><strong>{fanDub.idioma}</strong></div>
              <div className="fddetail-meta-item"><span>Estúdio</span><strong>{fanDub.studioNome}</strong></div>
              <div className="fddetail-meta-item"><span>Publicado</span><strong>{new Date(fanDub.criadoEm).toLocaleDateString('pt-BR')}</strong></div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
