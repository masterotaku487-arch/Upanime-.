import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import AnimeCard from '../components/AnimeCard'
import { getTopAnime, getAnimeByGenre, searchAnimeFilter } from '../services/api'
import './ExplorarPage.css'

export default function ExplorarPage() {
  const [searchParams] = useSearchParams()
  const [animes, setAnimes]   = useState([])
  const [loading, setLoading] = useState(true)
  const [page, setPage]       = useState(1)
  const [hasMore, setHasMore] = useState(false)

  const genres = searchParams.get('genres')?.split(',').filter(Boolean) || []
  const type   = searchParams.get('type') || ''
  const year   = searchParams.get('year') || ''
  const sort   = searchParams.get('sort') || 'bypopularity'

  useEffect(() => {
    setLoading(true); setAnimes([]); setPage(1)
    searchAnimeFilter({ genres, type, year, sort, page: 1 })
      .then(d => { setAnimes(d.data || []); setHasMore(d.pagination?.has_next_page || false) })
      .finally(() => setLoading(false))
  }, [searchParams.toString()])

  const loadMore = async () => {
    const next = page + 1
    const d = await searchAnimeFilter({ genres, type, year, sort, page: next })
    setAnimes(p => [...p, ...(d.data || [])])
    setHasMore(d.pagination?.has_next_page || false)
    setPage(next)
  }

  return (
    <div className="container explorar-page">
      <h1 className="explorar-title">
        Resultados
        {animes.length > 0 && <span>{animes.length} animes</span>}
      </h1>

      {loading ? (
        <div className="anime-grid">
          {Array(20).fill(0).map((_, i) => (
            <div key={i} className="skeleton" style={{ aspectRatio: '2/3', borderRadius: 10 }} />
          ))}
        </div>
      ) : animes.length === 0 ? (
        <div className="explorar-empty">
          <span>😶</span>
          <p>Nenhum anime encontrado com esses filtros.</p>
        </div>
      ) : (
        <>
          <div className="anime-grid">
            {animes.map((a, i) => <AnimeCard key={a.mal_id} anime={a} index={i} />)}
          </div>
          {hasMore && (
            <div style={{ textAlign: 'center', marginTop: 32 }}>
              <button className="btn btn-ghost" onClick={loadMore}>Carregar mais</button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
