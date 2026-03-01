import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { FiPlay, FiInfo, FiChevronLeft, FiChevronRight, FiStar } from 'react-icons/fi'
import './Hero.css'

export default function Hero({ animes }) {
  const [current, setCurrent] = useState(0)
  const [animating, setAnimating] = useState(false)

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
    setTimeout(() => setAnimating(false), 600)
  }

  if (!items.length) return <div className="hero-skeleton skeleton" />

  const anime = items[current]
  const image = anime.images?.jpg?.large_image_url || anime.images?.jpg?.image_url
  const synopsis = anime.synopsis?.slice(0, 220)

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
        <div className="hero-grad" />
      </div>

      <div className={`hero-content container ${animating ? 'animating' : ''}`}>
        <div className="hero-meta">
          <span className="hero-badge">🔥 EM DESTAQUE</span>
          {anime.score && (
            <span className="hero-score"><FiStar /> {anime.score.toFixed(1)}</span>
          )}
        </div>
        <h1 className="hero-title">
          {anime.title_english || anime.title}
        </h1>
        {anime.title_english && anime.title !== anime.title_english && (
          <p className="hero-jp">{anime.title}</p>
        )}
        <div className="hero-tags">
          {anime.genres?.slice(0, 4).map(g => (
            <span key={g.mal_id} className="hero-tag">{g.name}</span>
          ))}
          {anime.episodes && <span className="hero-tag">{anime.episodes} eps</span>}
          {anime.status && <span className="hero-tag">{anime.status}</span>}
        </div>
        {synopsis && <p className="hero-synopsis">{synopsis}{anime.synopsis?.length > 220 ? '...' : ''}</p>}
        <div className="hero-actions">
          <Link to={`/anime/${anime.mal_id}`} className="btn btn-primary">
            <FiPlay /> Assistir Agora
          </Link>
          <Link to={`/anime/${anime.mal_id}`} className="btn btn-ghost">
            <FiInfo /> Detalhes
          </Link>
        </div>
      </div>

      {items.length > 1 && (
        <>
          <button className="hero-nav prev" onClick={() => goTo((current - 1 + items.length) % items.length)}>
            <FiChevronLeft />
          </button>
          <button className="hero-nav next" onClick={() => goTo((current + 1) % items.length)}>
            <FiChevronRight />
          </button>
          <div className="hero-dots">
            {items.map((_, i) => (
              <button key={i} className={`dot ${i === current ? 'active' : ''}`} onClick={() => goTo(i)} />
            ))}
          </div>
        </>
      )}
    </section>
  )
}
