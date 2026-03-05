import { useAuth } from '../context/AuthContext'
import { useFavorites } from '../context/FavoritesContext'
import { Link } from 'react-router-dom'
import { FiHeart, FiStar, FiTrash2 } from 'react-icons/fi'
import './FavoritesPage.css'

export default function FavoritesPage() {
  const { user, openLogin } = useAuth()
  const { favorites, toggle } = useFavorites()

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

  // Ordenar por mais recente
  const sorted = [...favorites].sort((a, b) => b.addedAt - a.addedAt)

  return (
    <div className="favs-page container">
      <div className="favs-header">
        <h1 className="favs-title"><FiHeart /> Meus Favoritos</h1>
        <span className="favs-count">{favorites.length} anime{favorites.length !== 1 ? 's' : ''}</span>
      </div>

      <div className="favs-grid">
        {sorted.map(anime => (
          <div key={anime.mal_id} className="fav-card">
            <Link to={`/anime/${anime.mal_id}`} className="fav-poster">
              {anime.image
                ? <img src={anime.image} alt={anime.title} loading="lazy" />
                : <div className="fav-no-img">?</div>
              }
              <div className="fav-badges">
                {anime.score && <span className="badge badge-score"><FiStar size={10}/> {anime.score.toFixed(1)}</span>}
                {anime.type  && <span className="badge badge-type">{anime.type}</span>}
              </div>
            </Link>
            <div className="fav-info">
              <Link to={`/anime/${anime.mal_id}`} className="fav-title">{anime.title}</Link>
              <div className="fav-meta">
                {anime.episodes && <span>{anime.episodes} eps</span>}
                {anime.status   && <span>{anime.status === 'Currently Airing' ? '🔴 Em exibição' : anime.status === 'Finished Airing' ? 'Completo' : anime.status}</span>}
              </div>
              <button
                className="fav-remove"
                onClick={() => toggle(anime)}
                title="Remover dos favoritos"
              >
                <FiTrash2 size={14} /> Remover
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
