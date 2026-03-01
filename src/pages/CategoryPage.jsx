import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import AnimeCard from '../components/AnimeCard'
import { getTopAnime, getAnimeByGenre } from '../services/api'

const labels = {
  airing: '📺 Em Exibição',
  bypopularity: '🔥 Mais Populares',
  movie: '🎬 Filmes',
  tv: '📡 Séries TV',
  ova: '💿 OVAs',
  special: '⭐ Especiais',
  upcoming: '🚀 Em Breve',
  favorite: '❤️ Favoritos',
}

export default function CategoryPage() {
  const { type, genreId } = useParams()
  const [animes, setAnimes] = useState([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)

  const isGenre = !!genreId

  useEffect(() => {
    setLoading(true); setAnimes([]); setPage(1)
    const fetch = isGenre
      ? getAnimeByGenre(genreId, 1)
      : getTopAnime(type, 1)
    fetch.then(data => {
      setAnimes(data.data || [])
      setHasMore(data.pagination?.has_next_page || false)
    }).finally(() => setLoading(false))
  }, [type, genreId])

  const loadMore = async () => {
    const next = page + 1
    const data = isGenre ? await getAnimeByGenre(genreId, next) : await getTopAnime(type, next)
    setAnimes(p => [...p, ...(data.data || [])])
    setHasMore(data.pagination?.has_next_page || false)
    setPage(next)
  }

  const label = isGenre ? `🎭 Gênero #${genreId}` : (labels[type] || `📋 ${type}`)
  const [emoji, ...rest] = label.split(' ')

  return (
    <div className="container" style={{ paddingTop: 100, paddingBottom: 80 }}>
      <div className="section-header" style={{ marginBottom: 32 }}>
        <h1 className="section-title" style={{ fontSize: '2.2rem' }}>
          {emoji} <span>{rest.join(' ')}</span>
        </h1>
        {animes.length > 0 && <span style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>{animes.length} animes</span>}
      </div>
      {loading ? (
        <div className="anime-grid">
          {Array(20).fill(0).map((_, i) => (
            <div key={i} className="skeleton" style={{ aspectRatio: '2/3' }} />
          ))}
        </div>
      ) : (
        <>
          <div className="anime-grid">
            {animes.map((a, i) => <AnimeCard key={a.mal_id} anime={a} index={i % 20} />)}
          </div>
          {hasMore && (
            <div style={{ textAlign: 'center', marginTop: 32 }}>
              <button className="btn btn-ghost" onClick={loadMore}>⬇ Carregar mais</button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
