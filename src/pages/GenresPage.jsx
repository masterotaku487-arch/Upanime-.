import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getGenres, getTopAnime } from '../services/api'
import AnimeCard from '../components/AnimeCard'
import './GenresPage.css'

const GENRE_LABELS = {
  'Action':'Ação','Adventure':'Aventura','Comedy':'Comédia','Drama':'Drama',
  'Fantasy':'Fantasia','Horror':'Terror','Mystery':'Mistério','Romance':'Romance',
  'Sci-Fi':'Sci-Fi','Slice of Life':'Slice of Life','Sports':'Esportes',
  'Supernatural':'Sobrenatural','Thriller':'Suspense','Mecha':'Mecha',
  'Music':'Musical','Psychological':'Psicológico','Ecchi':'Ecchi','Isekai':'Isekai',
  'Shounen':'Shounen','Shoujo':'Shoujo','Seinen':'Seinen','Josei':'Josei',
  'Historical':'Histórico','Military':'Militar','Harem':'Harem',
  'School':'Vida Escolar','Magic':'Magia','Demons':'Demônios','Vampire':'Vampiro',
  'Samurai':'Samurai','Space':'Espaço','Game':'Jogos','Cars':'Carros',
  'Parody':'Paródia','Martial Arts':'Artes Marciais','Super Power':'Super Poderes',
  'Kids':'Infantil','Josei':'Josei','Girls Love':'Girls Love','Boys Love':'Boys Love',
  'Avant Garde':'Avant Garde','Award Winning':'Premiado','Gourmet':'Gastronomia',
  'Suspense':'Suspense','Gore':'Gore','Erotica':'Adulto',
}

const SORTS = [
  { label: 'Mais populares', value: 'bypopularity' },
  { label: 'Melhor avaliados', value: 'favorite' },
  { label: 'Em exibição', value: 'airing' },
  { label: 'Recém lançados', value: 'upcoming' },
]

const TYPES = [
  { label: 'Todos', value: '' },
  { label: 'Animes', value: 'tv' },
  { label: 'Filmes', value: 'movie' },
  { label: 'OVAs', value: 'ova' },
  { label: 'Especiais', value: 'special' },
]

const YEARS = [new Date().getFullYear(), new Date().getFullYear()-1, new Date().getFullYear()-2,
  2022, 2021, 2020, 2019, 2018, 2015, 2010, 2005, 2000]

export default function GenresPage() {
  const navigate = useNavigate()
  const [genres, setGenres] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAll, setShowAll] = useState(true)

  // Filtros
  const [selGenres, setSelGenres] = useState([])
  const [selType, setSelType]   = useState('')
  const [selYear, setSelYear]   = useState('')
  const [selSort, setSelSort]   = useState('bypopularity')

  useEffect(() => {
    getGenres().then(d => setGenres(d.data || [])).finally(() => setLoading(false))
  }, [])

  const toggleGenre = (id) =>
    setSelGenres(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id])

  const apply = () => {
    const params = new URLSearchParams()
    if (selGenres.length) params.set('genres', selGenres.join(','))
    if (selType)  params.set('type', selType)
    if (selYear)  params.set('year', selYear)
    params.set('sort', selSort)
    navigate(`/explorar?${params.toString()}`)
  }

  const visibleGenres = showAll ? genres : genres.slice(0, 18)

  return (
    <div className="genres-page container">
      <h1 className="genres-title">Filtrar</h1>

      {/* Tipo */}
      <section className="filter-section">
        <h2>Categoria</h2>
        <div className="filter-chips">
          {TYPES.map(t => (
            <button
              key={t.value}
              className={`chip ${selType === t.value ? 'active' : ''}`}
              onClick={() => setSelType(t.value)}
            >{t.label}</button>
          ))}
        </div>
      </section>

      {/* Gêneros */}
      <section className="filter-section">
        <h2>Gênero</h2>
        <div className="filter-chips">
          {loading
            ? Array(18).fill(0).map((_, i) => <div key={i} className="chip skeleton" style={{width:90,height:36}}/>)
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
          {genres.length > 18 && (
            <button className="chip chip-more" onClick={() => setShowAll(p => !p)}>
              {showAll ? 'Ver menos' : `Ver mais (${genres.length - 18})`}
            </button>
          )}
        </div>
      </section>

      {/* Ano */}
      <section className="filter-section">
        <h2>Data de lançamento</h2>
        <div className="filter-chips">
          <button className={`chip ${selYear==='' ? 'active' : ''}`} onClick={() => setSelYear('')}>
            Todo período
          </button>
          {YEARS.map(y => (
            <button
              key={y}
              className={`chip ${selYear===String(y) ? 'active' : ''}`}
              onClick={() => setSelYear(String(y))}
            >{y}</button>
          ))}
        </div>
      </section>

      {/* Ordenar */}
      <section className="filter-section">
        <h2>Organizar por</h2>
        <div className="filter-chips">
          {SORTS.map(s => (
            <button
              key={s.value}
              className={`chip ${selSort === s.value ? 'active' : ''}`}
              onClick={() => setSelSort(s.value)}
            >{s.label}</button>
          ))}
        </div>
      </section>

      <button className="apply-btn" onClick={apply}>Aplicar filtro</button>
    </div>
  )
                 }
                                     
