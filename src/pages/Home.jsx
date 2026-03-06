import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import Hero from '../components/Hero'
import AnimeCard from '../components/AnimeCard'
import { getSeasonNow, getTopAnime, getSeasonUpcoming } from '../services/api'
import './Home.css'

// Injeta schema JSON-LD no <head> e remove ao sair da página
function useJsonLd(id, schema) {
  useEffect(() => {
    let el = document.getElementById(id)
    if (!el) {
      el = document.createElement('script')
      el.id = id
      el.type = 'application/ld+json'
      document.head.appendChild(el)
    }
    el.textContent = JSON.stringify(schema)
    return () => document.getElementById(id)?.remove()
  }, []) // eslint-disable-line
}

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
  const [top,      setTop]      = useState([])
  const [popular,  setPopular]  = useState([])
  const [upcoming, setUpcoming] = useState([])
  const [loading,  setLoading]  = useState(true)

  useEffect(() => {
    // Título da home
    document.title = 'Up Anime+ | Assistir Animes Online Grátis em HD'

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

  // FAQ Schema — aparece como caixa expansível no Google
  useJsonLd('faq-schema', {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: 'O que é o Up Anime+?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Up Anime+ é um site gratuito para assistir animes online em HD, com episódios legendados em português e dublados. Tem filmes, OVAs e lançamentos da temporada atualizados diariamente.',
        },
      },
      {
        '@type': 'Question',
        name: 'Up Anime+ é grátis?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Sim! O Up Anime+ é completamente gratuito. Não é necessário criar conta ou pagar nada para assistir animes.',
        },
      },
      {
        '@type': 'Question',
        name: 'Tem anime dublado no Up Anime+?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Sim! O Up Anime+ oferece animes tanto legendados em português quanto dublados em português BR.',
        },
      },
      {
        '@type': 'Question',
        name: 'Precisa de cadastro para assistir?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Não é necessário cadastro para assistir. O login com Google é opcional e serve apenas para salvar favoritos.',
        },
      },
      {
        '@type': 'Question',
        name: 'Quais animes estão disponíveis?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'O Up Anime+ tem milhares de animes incluindo os lançamentos mais recentes, clássicos, filmes e OVAs. O catálogo é atualizado diariamente.',
        },
      },
    ],
  })

  const heroAnimes = top.length > 0 ? top : seasonal

  return (
    <div className="home">

      {/* H1 principal para SEO */}
      <h1 style={{ display: 'none' }}>
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
    
