import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { FiSearch } from 'react-icons/fi'
import AnimeCard from '../components/AnimeCard'
import { searchAnime } from '../services/api'
import './SearchPage.css'

const FANDUBS_API = 'https://studio-proxy.masterotaku487.workers.dev'

// Busca e cacheia fan-dubs localmente para não refazer o fetch a cada pesquisa
let fanDubsCache = null
async function fetchAllFanDubs() {
  if (fanDubsCache) return fanDubsCache
  const r = await fetch(`${FANDUBS_API}/api/fanDubs`)
  const d = await r.json()
  fanDubsCache = d.fanDubs || []
  return fanDubsCache
}

function filterFanDubs(list, q) {
  if (!q) return []
  const term = q.toLowerCase()
  return list.filter(d =>
    (d.animeTitulo || '').toLowerCase().includes(term) ||
    (d.titulo      || '').toLowerCase().includes(term) ||
    (d.studioNome  || '').toLowerCase().includes(term)
  )
}

export default function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const nav = useNavigate()
  const q = searchParams.get('q') || ''
  const [query, setQuery] = useState(q)

  // Resultados animes normais
  const [results, setResults]   = useState([])
  const [loading, setLoading]   = useState(false)
  const [page, setPage]         = useState(1)
  const [hasMore, setHasMore]   = useState(false)

  // Resultados fan-dubs
  const [dubResults, setDubResults] = useState([])

  // Busca animes normais
  useEffect(() => {
    if (!q) { setResults([]); return }
    setLoading(true)
    setPage(1)
    searchAnime(q, 1).then(data => {
      setResults(data.data || [])
      setHasMore(data.pagination?.has_next_page || false)
    }).finally(() => setLoading(false))
  }, [q])

  // Busca fan-dubs (filtra localmente)
  useEffect(() => {
    if (!q) { setDubResults([]); return }
    fetchAllFanDubs()
      .then(all => setDubResults(filterFanDubs(all, q)))
      .catch(() => setDubResults([]))
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

  const totalResults = results.length + dubResults.length

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
          {loading ? 'Buscando...' : `${totalResults} resultados para "${q}"`}
        </div>
      )}

      {/* ── Seção Fan-Dubs ── */}
      {dubResults.length > 0 && (
        <section className="section" style={{ marginBottom: 8 }}>
          <div className="section-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 4, height: 18, background: 'var(--accent,#E53935)', borderRadius: 2, display: 'block' }} />
              <h2 className="section-title">🎙️ Fan-Dubs da <span>Comunidade</span></h2>
            </div>
          </div>
          <div className="anime-grid">
            {dubResults.map(d => (
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
                  <div className="anime-badges">
                    <span className="badge-score" style={{ background: '#E53935' }}>🇧🇷 DUB</span>
                    {d.genero && <span className="badge-type">{d.genero}</span>}
                  </div>
                  {d.studioNome && <span className="ep-count">{d.studioNome}</span>}
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
      )}

      {/* ── Seção Animes normais ── */}
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
          {totalResults === 0 && q && (
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
                    
