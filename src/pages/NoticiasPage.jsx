import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import './NoticiasPage.css'

// Busca animes em exibição e agrupa por data de último episódio
async function fetchRecentEpisodes() {
  const res = await fetch('https://api.jikan.moe/v4/seasons/now?limit=25')
  const d = await res.json()
  return (d.data || [])
    .filter(a => a.type === 'TV' && a.score)
    .sort((a, b) => (b.score || 0) - (a.score || 0))
    .slice(0, 30)
}

// Agrupa animes por semana
function groupByDate(animes) {
  const groups = {}
  animes.forEach(a => {
    const day = a.broadcast?.day || 'Sem data'
    if (!groups[day]) groups[day] = []
    groups[day].push(a)
  })
  return groups
}

const DAY_PT = {
  Mondays:'Segunda', Tuesdays:'Terça', Wednesdays:'Quarta',
  Thursdays:'Quinta', Fridays:'Sexta', Saturdays:'Sábado', Sundays:'Domingo',
}

export default function NoticiasPage() {
  const [animes, setAnimes]   = useState([])
  const [loading, setLoading] = useState(true)
  const [sel, setSel]         = useState(null)

  useEffect(() => {
    fetchRecentEpisodes()
      .then(data => {
        setAnimes(data)
        // Seleciona o dia atual por padrão
        const days = ['Sundays','Mondays','Tuesdays','Wednesdays','Thursdays','Fridays','Saturdays']
        const today = days[new Date().getDay()]
        const hasToday = data.some(a => a.broadcast?.day === today)
        setSel(hasToday ? today : null)
      })
      .finally(() => setLoading(false))
  }, [])

  const groups = groupByDate(animes)
  const days = Object.keys(groups)
  const list = sel ? (groups[sel] || []) : animes

  return (
    <div className="noticias-page container">
      <h1 className="noticias-title">📅 Novidades</h1>

      {/* Seletor de dia */}
      <div className="noticias-days">
        <button className={`day-chip ${!sel ? 'active' : ''}`} onClick={() => setSel(null)}>
          Todos
        </button>
        {days.filter(d => d !== 'Sem data').map(d => (
          <button
            key={d}
            className={`day-chip ${sel === d ? 'active' : ''}`}
            onClick={() => setSel(d)}
          >
            {DAY_PT[d] || d}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="noticias-list">
          {Array(8).fill(0).map((_, i) => (
            <div key={i} className="skeleton" style={{ height: 120, borderRadius: 12 }} />
          ))}
        </div>
      ) : (
        <div className="noticias-list">
          {list.map(a => (
            <Link key={a.mal_id} to={`/anime/${a.mal_id}`} className="noticia-card">
              <img
                src={a.images?.jpg?.image_url}
                alt={a.title}
                className="noticia-img"
              />
              <div className="noticia-info">
                <h3>{a.title_english || a.title} {a.episodes ? `- EP ${a.episodes}` : ''}</h3>
                <p className="noticia-synopsis">{a.synopsis?.slice(0, 120)}... <span>Ver mais</span></p>
                <div className="noticia-meta">
                  ⭐ {a.score?.toFixed(1) || '?'}
                  {a.broadcast?.day && <span>· {DAY_PT[a.broadcast.day] || a.broadcast.day}</span>}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
