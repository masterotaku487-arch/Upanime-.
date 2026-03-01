import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { FiSearch } from 'react-icons/fi'
import AnimeCard from '../components/AnimeCard'
import { searchAnime } from '../services/api'
import './SearchPage.css'

export default function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const q = searchParams.get('q') || ''
  const [query, setQuery] = useState(q)
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)

  useEffect(() => {
    if (!q) return
    setLoading(true)
    setPage(1)
    searchAnime(q, 1).then(data => {
      setResults(data.data || [])
      setHasMore(data.pagination?.has_next_page || false)
    }).finally(() => setLoading(false))
  }, [q])

  const handleSearch = (e) => {
    e.preventDefault()
    if (query.trim()) setSearchParams({ q: query.trim() })
  }

  const loadMore = async () => {
    const next = page + 1
    const data = await searchAnime(q, next)
    setResults(p => [...p, ...(data.data || [])])
    setHasMore(data.pagination?.has_next_page || false)
    setPage(next)
  }

  return (
    <div className="search-page container" style={{ paddingTop: 100 }}>
      <form className="search-form" onSubmit={handleSearch}>
        <div className="search-input-wrap">
          <FiSearch className="search-icon" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Buscar anime..."
            autoFocus
          />
        </div>
        <button type="submit" className="btn btn-primary">Buscar</button>
      </form>

      {q && (
        <div className="search-meta">
          {loading ? 'Buscando...' : `${results.length} resultados para "${q}"`}
        </div>
      )}

      {loading ? (
        <div className="anime-grid">
          {Array(12).fill(0).map((_, i) => (
            <div key={i} className="skeleton" style={{ aspectRatio: '2/3' }} />
          ))}
        </div>
      ) : (
        <>
          <div className="anime-grid">
            {results.map((a, i) => <AnimeCard key={a.mal_id} anime={a} index={i} />)}
          </div>
          {results.length === 0 && q && (
            <div className="empty-state">
              <p>Nenhum resultado encontrado para "<strong>{q}</strong>"</p>
            </div>
          )}
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
