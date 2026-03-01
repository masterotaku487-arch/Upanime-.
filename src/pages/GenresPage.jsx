import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { getGenres } from '../services/api'
import './GenresPage.css'

// Genre emoji mapping
const genreEmoji = {
  'Action': '⚔️', 'Adventure': '🗺️', 'Comedy': '😂', 'Drama': '🎭',
  'Fantasy': '✨', 'Horror': '👻', 'Mystery': '🔍', 'Romance': '💕',
  'Sci-Fi': '🚀', 'Slice of Life': '☀️', 'Sports': '⚽', 'Supernatural': '🌙',
  'Thriller': '😱', 'Mecha': '🤖', 'Music': '🎵', 'Psychological': '🧠',
  'Ecchi': '🌸', 'Isekai': '🌀', 'Shounen': '👊', 'Shoujo': '🌺',
  'Seinen': '🔥', 'Josei': '💎', 'Historical': '📜',
}

export default function GenresPage() {
  const [genres, setGenres] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getGenres().then(data => setGenres(data.data || [])).finally(() => setLoading(false))
  }, [])

  return (
    <div className="container" style={{ paddingTop: 100, paddingBottom: 80 }}>
      <div className="section-header" style={{ marginBottom: 36 }}>
        <h1 className="section-title" style={{ fontSize: '2.5rem' }}>
          Todos os <span>Gêneros</span>
        </h1>
      </div>
      {loading ? (
        <div className="genres-grid">
          {Array(24).fill(0).map((_, i) => (
            <div key={i} className="skeleton" style={{ height: 90, borderRadius: 10 }} />
          ))}
        </div>
      ) : (
        <div className="genres-grid">
          {genres.map((g, i) => (
            <Link
              key={g.mal_id}
              to={`/genres/${g.mal_id}`}
              className="genre-card"
              style={{ animationDelay: `${i * 0.03}s` }}
            >
              <span className="genre-emoji">{genreEmoji[g.name] || '🎬'}</span>
              <span className="genre-name">{g.name}</span>
              <span className="genre-count">{g.count?.toLocaleString()}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
