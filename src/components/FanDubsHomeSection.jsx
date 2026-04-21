// Componente para usar na Home.jsx
// Import: import FanDubsHomeSection from '../components/FanDubsHomeSection'
// Uso: <FanDubsHomeSection />

import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

const API = 'https://studio-proxy.masterotaku487.workers.dev'

export default function FanDubsHomeSection() {
  const nav = useNavigate()
  const [fanDubs, setFanDubs] = useState([])

  useEffect(() => {
    fetch(`${API}/api/fanDubs`)
      .then(r => r.json())
      .then(d => setFanDubs((d.fanDubs || []).slice(0, 10)))
      .catch(() => {})
  }, [])

  if (!fanDubs.length) return null

  return (
    <section className="section">
      <div className="section-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 4, height: 18, background: 'var(--accent,#E53935)', borderRadius: 2, display: 'block' }} />
          <h2 className="section-title">🎙️ Fan-Dubs da <span>Comunidade</span></h2>
        </div>
        <Link to="/fandubs" className="see-all">Ver tudo →</Link>
      </div>

      <div className="anime-grid">
        {fanDubs.map((d, i) => (
          <div
            key={d.id}
            className="anime-card"
            onClick={() => nav(`/fandub/${d.id}`)}
            style={{ cursor: 'pointer' }}
          >
            <div className="anime-thumb">
              <img
                src={d.capa || d.animeCapa}
                alt={d.animeTitulo}
                loading="lazy"
                onError={e => { e.target.src = 'https://via.placeholder.com/130x185/111/E53935?text=DUB' }}
              />

              {/* Badge DUB (substitui o badge de rating) */}
              <div className="anime-badges">
                <span className="badge-score" style={{ background: '#E53935' }}>🇧🇷 DUB</span>
                {d.genero && <span className="badge-type">{d.genero}</span>}
              </div>

              {/* Nome do estúdio no canto inferior direito (como "N eps") */}
              {d.studioNome && (
                <span className="ep-count">{d.studioNome}</span>
              )}
            </div>

            <div className="anime-info">
              <h3 className="anime-title">{d.animeTitulo}</h3>
              {d.titulo && d.titulo !== d.animeTitulo && (
                <span className="anime-year">{d.titulo}</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
