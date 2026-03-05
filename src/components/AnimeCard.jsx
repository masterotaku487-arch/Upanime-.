import { Link } from 'react-router-dom'
import { FiStar, FiPlay } from 'react-icons/fi'
import { useEffect, useState } from 'react'
import './AnimeCard.css'

// Lê o progresso salvo pelo VideoPlayer
const getProgress = (animeId, totalEps) => {
  try {
    for (let ep = (totalEps || 99); ep >= 1; ep--) {
      const d = localStorage.getItem(`progress_${animeId}_${ep}`)
      if (d) {
        const { current, duration } = JSON.parse(d)
        if (duration > 0) return { ep, pct: Math.min(1, current / duration) }
      }
    }
  } catch { }
  return null
}

export default function AnimeCard({ anime, index = 0 }) {
  if (!anime) return null

  const [progress, setProgress] = useState(null)

  useEffect(() => {
    const p = getProgress(anime.mal_id, anime.episodes)
    setProgress(p)
  }, [anime.mal_id])

  const score    = anime.score?.toFixed(1)
  const type     = anime.type
  const episodes = anime.episodes
  const image    = anime.images?.jpg?.large_image_url || anime.images?.jpg?.image_url

  return (
    <Link
      to={`/anime/${anime.mal_id}`}
      className="anime-card"
      style={{ animationDelay: `${index * 0.05}s` }}
    >
      <div className="card-poster">
        {image ? (
          <img src={image} alt={anime.title} loading="lazy" />
        ) : (
          <div className="card-no-img">?</div>
        )}

        <div className="card-overlay">
          <button className="play-btn"><FiPlay /></button>
        </div>

        <div className="card-badges">
          {score && (
            <span className="badge badge-score">
              <FiStar size={10} /> {score}
            </span>
          )}
          {type && <span className="badge badge-type">{type}</span>}
        </div>

        {episodes && (
          <span className="card-ep">{episodes} eps</span>
        )}

        {/* ── Barra de progresso "Continue Assistindo" ── */}
        {progress && (
          <div className="card-progress-wrap">
            <div
              className="card-progress-bar"
              style={{ width: `${progress.pct * 100}%` }}
            />
          </div>
        )}
      </div>

      <div className="card-info">
        <h3 className="card-title">{anime.title_english || anime.title}</h3>
        <p className="card-sub">
          {progress
            ? `EP ${progress.ep} • ${Math.round(progress.pct * 100)}%`
            : anime.title !== anime.title_english
              ? anime.title
              : anime.aired?.prop?.from?.year || ''
          }
        </p>
      </div>
    </Link>
  )
}
