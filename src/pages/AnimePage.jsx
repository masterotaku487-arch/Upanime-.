import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { FiStar, FiPlay, FiClock, FiTv, FiCalendar, FiChevronDown, FiChevronUp, FiHeart } from 'react-icons/fi'
import { getAnimeById, getAnimeEpisodes } from '../services/api'
import { useTranslatedSynopsis } from '../services/translate'
import { getAniListByMalId, formatNextEp } from '../services/anilist'
import { useFavorites } from '../context/FavoritesContext'
import { useAuth } from '../context/AuthContext'
import './AnimePage.css'

export default function AnimePage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [anime, setAnime] = useState(null)
  const [episodes, setEpisodes] = useState([])
  const [loading, setLoading] = useState(true)
  const [epPage, setEpPage] = useState(1)
  const [showMore, setShowMore] = useState(false)
  const [alData, setAlData] = useState(null)
  const synopsis = useTranslatedSynopsis(anime?.synopsis)
  const { toggle, isFav } = useFavorites()
  const { user, openLogin } = useAuth()
  const favorited = anime ? isFav(anime.mal_id) : false

  const handleFav = () => {
    if (!user) { openLogin(); return }
    toggle(anime)
  }

  useEffect(() => {
    setLoading(true)
    setAnime(null)
    setEpisodes([])
    const load = async () => {
      try {
        const [data, eps] = await Promise.allSettled([
          getAnimeById(id),
          getAnimeEpisodes(id, 1),
        ])
        if (data.status === 'fulfilled') {
          setAnime(data.value.data)
          // Carrega AniList em paralelo (não bloqueia)
          getAniListByMalId(id).then(al => setAlData(al)).catch(() => {})
        }
        if (eps.status === 'fulfilled') setEpisodes(eps.value.data || [])
      } finally {
        setLoading(false)
      }
    }
    load()
    window.scrollTo(0, 0)
  }, [id])

  const loadMoreEps = async () => {
    const next = epPage + 1
    const data = await getAnimeEpisodes(id, next)
    setEpisodes(p => [...p, ...(data.data || [])])
    setEpPage(next)
  }

  if (loading) return (
    <div className="anime-page container" style={{ paddingTop: 100 }}>
      <div className="skeleton" style={{ height: 400, borderRadius: 12, marginBottom: 24 }} />
      <div className="skeleton" style={{ height: 200, borderRadius: 12 }} />
    </div>
  )

  if (!anime) return (
    <div className="anime-page container" style={{ paddingTop: 100 }}>
      <p>Anime não encontrado.</p>
    </div>
  )

  const banner = anime.images?.jpg?.large_image_url
  const genres = anime.genres || []
  const themes = anime.themes || []
  const studios = anime.studios || []

  return (
    <div className="anime-page">
      {/* Banner */}
      <div className="anime-banner" style={{ backgroundImage: `url(${banner})` }}>
        <div className="anime-banner-grad" />
      </div>

      <div className="container anime-main">
        {/* Poster + Info */}
        <div className="anime-header">
          <img src={banner} alt={anime.title} className="anime-poster" />
          <div className="anime-info">
            <div className="anime-tags-row">
              {anime.type && <span className="badge badge-red">{anime.type}</span>}
              {anime.status === 'Currently Airing' && <span className="badge" style={{background:'rgba(0,200,100,0.15)',color:'#00c864',border:'1px solid rgba(0,200,100,0.3)'}}>● AO VIVO</span>}
            </div>
            <h1 className="anime-title">{anime.title_english || anime.title}</h1>
            {anime.title_english && anime.title !== anime.title_english && (
              <p className="anime-title-jp">{anime.title}</p>
            )}
            <div className="anime-stats">
              {anime.score && (
                <div className="stat">
                  <FiStar className="stat-icon gold" />
                  <span>{anime.score.toFixed(1)}</span>
                  <small>{anime.scored_by?.toLocaleString()} avaliações</small>
                </div>
              )}
              {anime.episodes && (
                <div className="stat">
                  <FiTv className="stat-icon" />
                  <span>{anime.episodes}</span>
                  <small>episódios</small>
                </div>
              )}
              {anime.duration && (
                <div className="stat">
                  <FiClock className="stat-icon" />
                  <span>{anime.duration.replace(' per ep', '')}</span>
                  <small>duração</small>
                </div>
              )}
              {anime.year && (
                <div className="stat">
                  <FiCalendar className="stat-icon" />
                  <span>{anime.year}</span>
                  <small>{anime.season}</small>
                </div>
              )}
            </div>

            <div className="anime-genres">
              {[...genres, ...themes].map(g => (
                <Link key={g.mal_id} to={`/genres`} className="genre-tag">{g.name}</Link>
              ))}
            </div>

            {studios.length > 0 && (
              <p className="anime-studio">Estúdio: {studios.map(s => s.name).join(', ')}</p>
            )}

            {/* Próximo episódio via AniList */}
            {(() => {
              const next = alData ? formatNextEp(alData.nextAiringEpisode) : null
              if (!next) return null
              return (
                <div className="next-ep-badge">
                  📅 EP {next.ep} — {next.label} <span>({next.date})</span>
                </div>
              )
            })()}

            <div className="anime-actions">
              {episodes.length > 0 || ['Movie','OVA','Special','TV Special','Music'].includes(anime.type) ? (
                <Link to={`/watch/${id}?ep=1`} className="btn btn-primary">
                  <FiPlay /> {anime.type === 'Movie' ? 'Assistir Filme' : ['OVA','Special','TV Special'].includes(anime.type) ? 'Assistir' : 'Assistir Episódio 1'}
                </Link>
              ) : (
                <button className="btn btn-primary" disabled style={{ opacity: 0.5 }}>
                  <FiPlay /> Sem episódios
                </button>
              )}
              <button
                className={`btn btn-fav ${favorited ? 'favorited' : ''}`}
                onClick={handleFav}
                title={favorited ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
              >
                <FiHeart fill={favorited ? 'currentColor' : 'none'} />
                {favorited ? 'Favoritado' : 'Favoritar'}
              </button>
            </div>
          </div>
        </div>

        {/* Synopsis */}
        {synopsis && (
          <div className="anime-section">
            <h2 className="section-title">Sinopse</h2>
            <p className={`anime-synopsis ${showMore ? 'full' : ''}`}>{synopsis}</p>
            {synopsis.length > 400 && (
              <button className="show-more" onClick={() => setShowMore(o => !o)}>
                {showMore ? <><FiChevronUp /> Menos</> : <><FiChevronDown /> Mais</>}
              </button>
            )}
          </div>
        )}

        {/* Trailer */}
        {(anime.trailer?.youtube_id || anime.trailer?.embed_url) && (
          <div className="anime-section">
            <h2 className="section-title">Trailer</h2>
            <div className="trailer-wrap">
              <iframe
                src={anime.trailer?.embed_url || `https://www.youtube.com/embed/${anime.trailer?.youtube_id}?rel=0&modestbranding=1`}
                title="Trailer"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="trailer-iframe"
              />
            </div>
          </div>
        )}

        {/* Episodes */}
        {episodes.length > 0 && (
          <div className="anime-section">
            <h2 className="section-title">Episódios <span>({anime.episodes || '?'})</span></h2>
            <div className="ep-grid">
              {episodes.map(ep => (
                <Link
                  key={ep.mal_id}
                  to={`/watch/${id}?ep=${ep.mal_id}`}
                  className="ep-card"
                >
                  <span className="ep-num">{ep.mal_id}</span>
                  <span className="ep-title">{ep.title || `Episódio ${ep.mal_id}`}</span>
                  {ep.aired && <span className="ep-date">{new Date(ep.aired).toLocaleDateString('pt-BR')}</span>}
                </Link>
              ))}
            </div>
            {anime.episodes && episodes.length < anime.episodes && (
              <button className="btn btn-ghost" style={{ marginTop: 16 }} onClick={loadMoreEps}>
                Carregar mais episódios
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
                  }


            
