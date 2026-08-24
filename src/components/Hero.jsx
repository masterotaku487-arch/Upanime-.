import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { FiPlay, FiPlus, FiCheck, FiStar } from 'react-icons/fi'
import { useFavorites } from '../context/FavoritesContext'
import { translateGenre, translateStatus } from '../utils/genreLabels'
import './Hero.css'

export default function Hero({ animes }) {
  const [current, setCurrent] = useState(0)
  const [animating, setAnimating] = useState(false)
  const { toggle, isFav } = useFavorites()

  const items = animes?.slice(0, 6) || []

  useEffect(() => {
    if (items.length === 0) return
    const t = setInterval(() => goTo((current + 1) % items.length), 7000)
    return () => clearInterval(t)
  }, [current, items.length])

  const goTo = (idx) => {
    if (animating || idx === current) return
    setAnimating(true)
    setCurrent(idx)
    setTimeout(() => setAnimating(false), 500)
  }

  if (!items.length) return <div className="hero-skeleton skeleton" />

  const anime = items[current]
  const image = anime.images?.jpg?.large_image_url || anime.images?.jpg?.image_url
  const linkBase = anime._isFanDub ? `/fandub/${anime.mal_id}` : `/anime/${anime.mal_id}`
  const favorited = isFav ? isFav(anime.mal_id) : false

  return (
    <section className="hero">
      <div className="hero-bg">
        {items.map((a, i) => (
          <div
            key={a.mal_id}
            className={`hero-slide ${i === current ? 'active' : ''}`}
            style={{ backgroundImage: `url(${a.images?.jpg?.large_image_url})` }}
          />
        ))}
        <div className="hero-slash" />
        <div className="hero-grad" />
      </div>

      <div className={`hero-content ${animating ? 'animating' : ''}`}>
        <div className="hero-meta">
          <span className="hero-badge">EM DESTAQUE</span>
          {anime._isFanDub && <span className="hero-badge hero-badge-dub">FAN-DUB</span>}
          {anime.score && (
            <span className="hero-score"><FiStar /> {anime.score.toFixed(1)}</span>
          )}
        </div>
        <h1 className="hero-title">
          {anime.title_english || anime.title}
        </h1>
        <div className="hero-sub">
          {anime.genres?.slice(0, 2).map(g => (
            <span key={g.mal_id}>{translateGenre(g.name)}</span>
          ))}
          {anime.episodes && <span>Ep. {anime.episodes}</span>}
          {anime.status && <span>{translateStatus(anime.status)}</span>}
        </div>
        <div className="hero-actions">
          <Link to={linkBase} className="btn-play">
            <FiPlay /> Assistir
          </Link>
          <button
            className={`btn-add ${favorited ? 'added' : ''}`}
            onClick={() => toggle && toggle(anime)}
            title={favorited ? 'Remover da lista' : 'Adicionar à lista'}
          >
            {favorited ? <FiCheck /> : <FiPlus />}
          </button>
        </div>
      </div>

      {items.length > 1 && (
        <div className="hero-dots">
          {items.map((_, i) => (
            <button key={i} className={`dot ${i === current ? 'active' : ''}`} onClick={() => goTo(i)} />
          ))}
        </div>
      )}
    </section>
  )
}
