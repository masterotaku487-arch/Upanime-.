import { useState, useMemo } from 'react'
import { useAuth } from '../context/AuthContext'
import { useFavorites } from '../context/FavoritesContext'
import { Link } from 'react-router-dom'
import { FiHeart, FiStar, FiX } from 'react-icons/fi'
import { getAnimeProgress } from '../components/VideoPlayer'
import './FavoritesPage.css'

const FILTERS = [
  { key: 'todos',       label: 'Todos' },
  { key: 'assistindo',  label: 'Assistindo' },
  { key: 'naoiniciado', label: 'Não Iniciados' },
  { key: 'concluido',   label: 'Concluídos' },
]

export default function FavoritesPage() {
  const { user, openLogin } = useAuth()
  const { favorites, toggle } = useFavorites()
  const [filter, setFilter] = useState('todos')

  if (!user) {
    return (
      <div className="favs-login">
        <FiHeart size={56} className="favs-icon" />
        <h2>Seus favoritos ficam aqui</h2>
        <p>Entre com sua conta Google para salvar e acessar seus animes favoritos em qualquer dispositivo.</p>
        <button className="btn btn-primary" onClick={openLogin}>
          Entrar com Google
        </button>
      </div>
    )
  }

  if (!favorites.length) {
    return (
      <div className="favs-login">
        <FiHeart size={56} className="favs-icon" />
        <h2>Nenhum favorito ainda</h2>
        <p>Clique no ❤️ em qualquer anime para adicionar aqui.</p>
        <Link to="/" className="btn btn-primary">Explorar animes</Link>
      </div>
    )
  }

  // Junta cada favorito com o progresso salvo (episódio atual, %)
  const withProgress = useMemo(() => {
    return favorites.map(anime => {
      const prog = anime.episodes ? getAnimeProgress(anime.mal_id, anime.episodes) : null
      const pct = prog?.pct ?? 0
      const status = !prog ? 'naoiniciado' : pct >= 0.9 ? 'concluido' : 'assistindo'
      return { ...anime, prog, status }
    })
  }, [favorites])

  const filtered = filter === 'todos'
    ? withProgress
    : withProgress.filter(a => a.status === filter)

  const sorted = [...filtered].sort((a, b) => b.addedAt - a.addedAt)

  return (
    <div className="favs-page container">
      <div className="favs-header">
        <h1 className="favs-title"><FiHeart /> Minha Lista</h1>
        <span className="favs-count">{favorites.length} título{favorites.length !== 1 ? 's' : ''} salvo{favorites.length !== 1 ? 's' : ''}</span>
      </div>

      <div className="favs-filters">
        {FILTERS.map(f => (
          <button
            key={f.key}
            className={`favs-chip ${filter === f.key ? 'active' : ''}`}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {!sorted.length ? (
        <div className="favs-empty-filter">Nenhum anime nesse filtro.</div>
      ) : (
      <div className="favs-grid">
        {sorted.map(anime => {
          const isFanDub = String(anime.mal_id).startsWith('fandub-')
          const link = isFanDub ? `/fandub/${String(anime.mal_id).replace('fandub-', '')}` : `/anime/${anime.mal_id}`
          return (
          <div key={anime.mal_id} className="fav-card">
            <Link to={link} className="fav-poster">
              {anime.image
                ? <img src={anime.image} alt={anime.title} loading="lazy" />
                : <div className="fav-no-img">?</div>
              }
              <div className="fav-badges">
                {anime.score && <span className="badge badge-score"><FiStar size={10}/> {anime.score.toFixed(1)}</span>}
                {anime.type  && <span className="badge badge-type">{anime.type}</span>}
                {anime.prog?.ep && <span className="badge badge-ep">EP {anime.prog.ep}</span>}
              </div>
              <button
                className="fav-remove-x"
                onClick={(e) => { e.preventDefault(); toggle(anime) }}
                title="Remover dos favoritos"
              >
                <FiX size={14} />
              </button>
            </Link>
            {anime.prog && (
              <div className="fav-progress-track">
                <div className="fav-progress-fill" style={{ width: `${Math.min(100, anime.prog.pct * 100)}%` }} />
              </div>
            )}
            <div className="fav-info">
              <Link to={link} className="fav-title">{anime.title}</Link>
              <div className="fav-meta">
                {anime.episodes && <span>{anime.episodes} eps</span>}
                {anime.status === 'concluido'   && <span className="fav-status-tag done">Concluído</span>}
                {anime.status === 'assistindo'  && <span className="fav-status-tag">Assistindo</span>}
              </div>
            </div>
          </div>
          )
        })}
      </div>
      )}
    </div>
  )
        }
