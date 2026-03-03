import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import Hero from '../components/Hero'
import AnimeCard from '../components/AnimeCard'
import { getSeasonNow, getTopAnime, getSeasonUpcoming } from '../services/api'
import './Home.css'

function AnimeRow({ title, link, animes, loading }) {
  return (
    <section className="section">
      <div className="section-header">
        <h2 className="section-title">{title}</h2>
        {link && <Link to={link} className="see-all">Ver todos →</Link>}
      </div>
      {loading ? (
        <div className="anime-grid">
          {Array(10).fill(0).map((_, i) => (
            <div key={i} className="skeleton" style={{ aspectRatio: '2/3', borderRadius: 'var(--radius)' }} />
          ))}
        </div>
      ) : (
        <div className="anime-grid">
          {animes?.map((a, i) => <AnimeCard key={a.mal_id} anime={a} index={i} />)}
        </div>
      )}
    </section>
  )
}

export default function Home() {
  const [seasonal, setSeasonal] = useState([])
  const [top, setTop] = useState([])
  const [popular, setPopular] = useState([])
  const [upcoming, setUpcoming] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        const [s, t, p, u] = await Promise.allSettled([
          getSeasonNow(1),
          getTopAnime('airing'),
          getTopAnime('bypopularity'),
          getSeasonUpcoming(),
        ])
        if (s.status === 'fulfilled') setSeasonal(s.value.data || [])
        if (t.status === 'fulfilled') setTop(t.value.data || [])
        if (p.status === 'fulfilled') setPopular(p.value.data || [])
        if (u.status === 'fulfilled') setUpcoming(u.value.data || [])
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const heroAnimes = top.length > 0 ? top : seasonal

  return (
    <div className="home">

      {/* H1 principal para SEO */}
      <h1 style={{ display: "none" }}>
        Up Anime+ - Assistir Animes Online Grátis em HD
      </h1>

      <Hero animes={heroAnimes} />

      <div className="container">
        <AnimeRow
          title={<>Temporada <span>Atual</span></>}
          link="/category/airing"
          animes={seasonal.slice(0, 12)}
          loading={loading}
        />
        <AnimeRow
          title={<>Top <span>Airing</span></>}
          link="/category/airing"
          animes={top.slice(0, 12)}
          loading={loading}
        />
        <AnimeRow
          title={<>Mais <span>Populares</span></>}
          link="/category/bypopularity"
          animes={popular.slice(0, 12)}
          loading={loading}
        />
        <AnimeRow
          title={<>Em <span>Breve</span></>}
          link="/category/upcoming"
          animes={upcoming.slice(0, 12)}
          loading={loading}
        />
      </div>
    </div>
  )
}
