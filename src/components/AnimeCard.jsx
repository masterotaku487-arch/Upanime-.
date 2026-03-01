import { Link } from 'react-router-dom'
import { FiStar, FiPlay } from 'react-icons/fi'
import './AnimeCard.css'

export default function AnimeCard({ anime, index = 0 }) {
  if (!anime) return null

  const score = anime.score?.toFixed(1)
  const type = anime.type
  const episodes = anime.episodes
  const image = anime.images?.jpg?.large_image_url || anime.images?.jpg?.image_url

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
      </div>
      <div className="card-info">
        <h3 className="card-title">{anime.title_english || anime.title}</h3>
        <p className="card-sub">{anime.title !== anime.title_english ? anime.title : anime.aired?.prop?.from?.year || ''}</p>
      </div>
    </Link>
  )
}
