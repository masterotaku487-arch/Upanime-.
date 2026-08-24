import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { FiSearch } from 'react-icons/fi'
import { getAnimeByGenre, getGenres } from '../services/api'
import { getDubbedTitleSet, isDubbed } from '../services/fandubs'
import { GENRE_LABELS } from '../utils/genreLabels'
import AnimeCard from '../components/AnimeCard'
import './GenresPage.css'

// Tiles fixos, na mesma ordem/curadoria do mockup (id vem da GENRE_TABLE do services/api.js)
const TILES = [
  { id: 1,  label: 'Ação',         bg: 'bg1' },
  { id: 6,  label: 'Terror',       bg: 'bg2' },
  { id: 19, label: 'Shounen',      bg: 'bg2' },
  { id: 12, label: 'Sobrenatural', bg: 'bg1' },
  { id: 8,  label: 'Romance',      bg: 'bg1' },
  { id: 4,  label: 'Drama',        bg: 'bg2' },
  { id: 18, label: 'Isekai',       bg: 'bg2' },
  { id: 3,  label: 'Comédia',      bg: 'bg1' },
]

// Gênero em destaque na fileira "Populares em..." — Terror, como no mockup
const FEATURED = { id: 6, label: 'Terror' }

const FILTERS = ['Todos', 'Dublado', 'Legendado']

const TYPES = [
  { label: 'Todos', value: '' },
  { label: 'Animes', value: 'tv' },
  { label: 'Filmes', value: 'movie' },
  { label: 'OVAs', value: 'ova' },
  { label: 'Especiais', value: 'special' },
]

const SORTS = [
  { label: 'Mais populares', value: 'bypopularity' },
  { label: 'Melhor avaliados', value: 'favorite' },
  { label: 'Em exibição', value: 'airing' },
  { label: 'Recém lançados', value: 'upcoming' },
]

const YEARS = [new Date().getFullYear(), new Date().getFullYear()-1, new Date().getFullYear()-2,
  2022, 2021, 2020, 2019, 2018, 2015, 2010, 2005, 2000]

export default function GenresPage() {
  const navigate = useNavigate()

  // Filtro rápido (chips do topo, estilo mockup)
  const [filter, setFilter] = useState('Todos')
  const dublado = filter === 'Dublado'

  // Fileira "Populares em..."
  const [popular, setPopular] = useState([])
  const [loadingPopular, setLoadingPopular] = useState(true)

  // Filtro avançado (formulário completo, como antes)
  const [allGenres, setAllGenres] = useState([])
  const [loadingGenres, setLoadingGenres] = useState(true)
  const [showAllGenres, setShowAllGenres] = useState(false)
  const [selGenres, setSelGenres] = useState([])
  const [selType, setSelType]   = useState('')
  const [selYear, setSelYear]   = useState('')
  const [selSort, setSelSort]   = useState('bypopularity')

  useEffect(() => {
    getGenres().then(d => setAllGenres(d.data || [])).finally(() => setLoadingGenres(false))
  }, [])

  useEffect(() => {
    setLoadingPopular(true)
    getAnimeByGenre(FEATURED.id, 1)
      .then(async d => {
        let list = d.data || []
        if (dublado) {
          const dubbedSet = await getDubbedTitleSet()
          list = list.filter(a => isDubbed(a, dubbedSet))
        }
        setPopular(list.slice(0, 10))
      })
      .finally(() => setLoadingPopular(false))
  }, [dublado])

  // "Dublado" leva pro catálogo real cruzado com a lista de fan-dubs em PT-BR
  const tileLink = (id) =>
    dublado ? `/explorar?genres=${id}&dublado=1` : `/explorar?genres=${id}`

  const toggleGenre = (id) =>
    setSelGenres(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id])

  const applyAdvanced = () => {
    const params = new URLSearchParams()
    if (selGenres.length) params.set('genres', selGenres.join(','))
    if (selType)  params.set('type', selType)
    if (selYear)  params.set('year', selYear)
    params.set('sort', selSort)
    if (dublado) params.set('dublado', '1')
    navigate(`/explorar?${params.toString()}`)
  }

  const visibleGenres = showAllGenres ? allGenres : allGenres.slice(0, 18)

  return (
    <div className="genres-page">
      <div className="cat-header">
        <h1 className="cat-h-title">Categorias</h1>
        <p className="cat-h-sub">Explore por gênero, formato e idioma</p>
      </div>

      <Link to="/search" className="searchbar">
        <FiSearch />
        <span>Buscar animes, personagens...</span>
      </Link>

      <div className="filter-row">
        {FILTERS.map(f => (
          <button
            key={f}
            className={`chip ${filter === f ? 'active' : ''}`}
            onClick={() => setFilter(f)}
          >{f}</button>
        ))}
      </div>

      <div className="genre-grid">
        {TILES.map(t => (
          <Link key={t.id} to={tileLink(t.id)} className={`genre-tile ${t.bg}`}>
            <span className="name">{t.label}</span>
          </Link>
        ))}
      </div>

      <section className="section">
        <div className="section-head">
          <h2 className="section-title">
            {dublado ? `Dublados em ${FEATURED.label}` : `Populares em ${FEATURED.label}`}
          </h2>
        </div>
        {!loadingPopular && popular.length === 0 ? (
          <p className="rail-empty">Nenhum anime dublado nessa categoria ainda.</p>
        ) : (
          <div className="rail">
            {loadingPopular
              ? Array(5).fill(0).map((_, i) => <div key={i} className="skeleton rail-skeleton" />)
              : popular.map((a, i) => <AnimeCard key={a.mal_id} anime={a} index={i} rank={i + 1} />)
            }
          </div>
        )}
      </section>

      {/* ── Filtro avançado ────────────────────────────────── */}
      <section className="adv-filter">
        <h2 className="adv-filter-title">Filtro avançado</h2>

        <div className="filter-section">
          <h3>Formato</h3>
          <div className="filter-chips">
            {TYPES.map(t => (
              <button
                key={t.value}
                className={`chip ${selType === t.value ? 'active' : ''}`}
                onClick={() => setSelType(t.value)}
              >{t.label}</button>
            ))}
          </div>
        </div>

        <div className="filter-section">
          <h3>Gênero</h3>
          <div className="filter-chips">
            {loadingGenres
              ? Array(18).fill(0).map((_, i) => <div key={i} className="chip skeleton" style={{ width: 90, height: 36 }} />)
              : visibleGenres.map(g => (
                <button
                  key={g.mal_id}
                  className={`chip ${selGenres.includes(g.mal_id) ? 'active' : ''}`}
                  onClick={() => toggleGenre(g.mal_id)}
                >
                  {GENRE_LABELS[g.name] || g.name}
                </button>
              ))
            }
            {allGenres.length > 18 && (
              <button className="chip chip-more" onClick={() => setShowAllGenres(p => !p)}>
                {showAllGenres ? 'Ver menos' : `Ver mais (${allGenres.length - 18})`}
              </button>
            )}
          </div>
        </div>

        <div className="filter-section">
          <h3>Data de lançamento</h3>
          <div className="filter-chips">
            <button className={`chip ${selYear === '' ? 'active' : ''}`} onClick={() => setSelYear('')}>
              Todo período
            </button>
            {YEARS.map(y => (
              <button
                key={y}
                className={`chip ${selYear === String(y) ? 'active' : ''}`}
                onClick={() => setSelYear(String(y))}
              >{y}</button>
            ))}
          </div>
        </div>

        <div className="filter-section">
          <h3>Organizar por</h3>
          <div className="filter-chips">
            {SORTS.map(s => (
              <button
                key={s.value}
                className={`chip ${selSort === s.value ? 'active' : ''}`}
                onClick={() => setSelSort(s.value)}
              >{s.label}</button>
            ))}
          </div>
        </div>

        <button className="apply-btn" onClick={applyAdvanced}>
          Aplicar filtro{dublado ? ' (só dublados)' : ''}
        </button>
      </section>
    </div>
  )
}
