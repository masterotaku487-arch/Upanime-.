import { useState, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { FiSearch } from 'react-icons/fi'
import AnimeCard from '../components/AnimeCard'
import { searchAnime } from '../services/api'
import './SearchPage.css'

const STUDIO_API = 'https://studio-proxy.masterotaku487.workers.dev'

// Card de fan-dub nos resultados de busca
function FanDubCard({ dub }) {
  const eps = dub.listaEpisodios?.length || dub.episodios || 1
  return (
    <Link to={`/fandubs/${dub.id}`} className="fandub-search-card">
      <div className="fandub-search-thumb">
        <img
          src={dub.capa || dub.animeCapa}
          alt={dub.titulo}
          loading="lazy"
          onError={e => { e.target.style.display = 'none' }}
        />
        <span className="fandub-search-badge">🇧🇷 Fan-Dub</span>
      </div>
      <div className="fandub-search-info">
        <div className="fandub-search-anime">{dub.animeTitulo}</div>
        <div className="fandub-search-titulo">{dub.titulo}</div>
        <div className="fandub-search-meta">
          <span>🎙️ {dub.studioNome}</span>
          <span>{eps} EP{eps > 1 ? 'S' : ''}</span>
          {dub.qualidade && <span>{dub.qualidade}</span>}
        </div>
        {dub.genero && <span className="fandub-search-genero">{dub.genero}</span>}
      </div>
    </Link>
  )
}

export default function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const q = searchParams.get('q') || ''
  const [query,      setQuery]      = useState(q)
  const [results,    setResults]    = useState([])
  const [fanDubs,    setFanDubs]    = useState([])
  const [loading,    setLoading]    = useState(false)
  const [loadingDubs, setLoadingDubs] = useState(false)
  const [page,       setPage]       = useState(1)
  const [hasMore,    setHasMore]    = useState(false)

  useEffect(() => {
    if (!q) return

    // Busca animes
    setLoading(true)
    setPage(1)
    searchAnime(q, 1).then(data => {
      setResults(data.data || [])
      setHasMore(data.pagination?.has_next_page || false)
    }).finally(() => setLoading(false))

    // Busca fan-dubs em paralelo
    setLoadingDubs(true)
    setFanDubs([])
    fetch(`${STUDIO_API}/api/fanDubs/search?q=${encodeURIComponent(q)}`)
      .then(r => r.json())
      .then(d => setFanDubs(d.fanDubs || []))
      .catch(() => {})
      .finally(() => setLoadingDubs(false))
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

  const totalResults = results.length + fanDubs.length

  return (
    <div className="search-page container" style={{ paddingTop: 100 }}>
      <form className="search-form" onSubmit={handleSearch}>
        <div className="search-input-wrap">
          <FiSearch className="search-icon" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Buscar anime ou fan-dub..."
            autoFocus
          />
        </div>
        <button type="submit" className="btn btn-primary">Buscar</button>
      </form>

      {q && (
        <div className="search-meta">
          {(loading || loadingDubs)
            ? 'Buscando...'
            : `${totalResults} resultado${totalResults !== 1 ? 's' : ''} para "${q}"`
          }
        </div>
      )}

      {/* ── Fan-Dubs ── */}
      {(loadingDubs || fanDubs.length > 0) && q && (
        <div className="search-section">
          <h3 className="search-section-title">🎙️ Fan-Dubs</h3>
          {loadingDubs ? (
            <div className="fandub-search-grid">
              {Array(4).fill(0).map((_, i) => (
                <div key={i} className="skeleton" style={{ height: 90, borderRadius: 10 }} />
              ))}
            </div>
          ) : (
            <div className="fandub-search-grid">
              {fanDubs.map(d => <FanDubCard key={d.id} dub={d} />)}
            </div>
          )}
        </div>
      )}

      {/* ── Animes ── */}
      {q && (results.length > 0 || loading) && (
        <div className="search-section">
          <h3 className="search-section-title">🎌 Animes</h3>
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
              {hasMore && (
                <div style={{ textAlign: 'center', marginTop: 32 }}>
                  <button className="btn btn-ghost" onClick={loadMore}>Carregar mais</button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Vazio ── */}
      {!loading && !loadingDubs && q && totalResults === 0 && (
        <div className="empty-state">
          <p>Nenhum resultado encontrado para "<strong>{q}</strong>"</p>
        </div>
      )}
    </div>
  )
}
