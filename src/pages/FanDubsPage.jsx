import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import './FanDubsPage.css'

const API = 'https://studio-proxy.masterotaku487.workers.dev'

export default function FanDubsPage() {
  const nav = useNavigate()
  const [sp, setSp] = useSearchParams()
  const [fanDubs, setFanDubs]   = useState([])
  const [studios, setStudios]   = useState([])
  const [loading, setLoading]   = useState(true)
  const [studioFiltro, setStudioFiltro] = useState(sp.get('studio') || '')
  const [busca, setBusca]       = useState('')

  useEffect(() => {
    Promise.all([
      fetch(`${API}/api/fanDubs${studioFiltro ? `?studio=${studioFiltro}` : ''}`).then(r=>r.json()),
      fetch(`${API}/api/studios`).then(r=>r.json()),
    ]).then(([f, s]) => {
      setFanDubs(f.fanDubs || [])
      setStudios(s.studios || [])
      setLoading(false)
    })
  }, [studioFiltro])

  const filtrados = fanDubs.filter(d =>
    !busca || d.animeTitulo.toLowerCase().includes(busca.toLowerCase()) ||
    d.titulo.toLowerCase().includes(busca.toLowerCase())
  )

  return (
    <div className="fandubs-page">
      <div className="fandubs-hero">
        <h1 className="fandubs-title">🎙️ Fan-Dubs</h1>
        <p className="fandubs-sub">Dublagens feitas com amor pela comunidade brasileira</p>
      </div>

      {/* Filtros */}
      <div className="fandubs-filters">
        <input className="fandubs-search" value={busca}
          onChange={e => setBusca(e.target.value)}
          placeholder="🔍 Buscar anime ou fan-dub..." />
        <div className="studio-tabs">
          <div className={`studio-tab ${!studioFiltro ? 'active' : ''}`}
            onClick={() => { setStudioFiltro(''); setSp({}) }}>
            Todos
          </div>
          {studios.map(s => (
            <div key={s.id} className={`studio-tab ${studioFiltro === s.id ? 'active' : ''}`}
              onClick={() => { setStudioFiltro(s.id); setSp({ studio: s.id }) }}>
              {s.logo && <img src={s.logo} alt={s.nome} className="studio-tab-logo" />}
              {s.nome}
            </div>
          ))}
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="fandubs-loading">
          {[...Array(6)].map((_,i) => <div key={i} className="skeleton fandub-sk" />)}
        </div>
      ) : filtrados.length === 0 ? (
        <div className="fandubs-empty">
          <div style={{fontSize:'3rem'}}>🎙️</div>
          <p>Nenhum fan-dub encontrado.</p>
        </div>
      ) : (
        <div className="fandubs-grid">
          {filtrados.map(d => (
            <div key={d.id} className="fandub-card" onClick={() => nav(`/fandub/${d.id}`)}>
              <div className="fandub-capa-wrap">
                <img src={d.capa || d.animeCapa} alt={d.titulo} className="fandub-capa"
                  onError={e => e.target.src='https://via.placeholder.com/200x280/111/fff?text=FD'} />
                <div className="fandub-overlay" />
                <div className="fandub-badges">
                  <span className="fandub-badge-idioma">🇧🇷 {d.idioma}</span>
                  <span className="fandub-badge-qual">{d.qualidade}</span>
                </div>
                <div className="fandub-eps-badge">{d.episodios} EP{d.episodios>1?'S':''}</div>
              </div>
              <div className="fandub-info">
                <div className="fandub-anime">{d.animeTitulo}</div>
                <div className="fandub-nome">{d.titulo}</div>
                <div className="fandub-studio">
                  {d.studioLogo && <img src={d.studioLogo} alt={d.studioNome} className="fandub-studio-logo" />}
                  {d.studioNome}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Banner para estúdios */}
      <div className="studio-cta" onClick={() => nav('/studio')}>
        <div className="studio-cta-icon">🎙️</div>
        <div>
          <div className="studio-cta-title">Você tem um estúdio de fan-dub?</div>
          <div className="studio-cta-sub">Cadastre-se e divulgue seu trabalho no UpAnime+</div>
        </div>
        <div className="studio-cta-arrow">›</div>
      </div>
    </div>
  )
}
