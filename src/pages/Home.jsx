import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import Hero from '../components/Hero'
import AnimeCard from '../components/AnimeCard'
import FanDubsHomeSection from '../components/FanDubsHomeSection'
import PartnerModal from '../components/PartnerModal'
import { getSeasonNow, getTopAnime, getSeasonUpcoming } from '../services/api'
import { getHistory, getEpProgress, removeHistory } from '../services/history'
import './Home.css'

const FANDUB_API = 'https://studio-proxy.masterotaku487.workers.dev'

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

function ContinueCard({ entry, onRemove }) {
  const pct = getEpProgress(entry.mal_id, entry.lastEp) ?? 0
  const isFanDub = String(entry.mal_id).startsWith('fandub-')
  const realId = isFanDub ? String(entry.mal_id).replace('fandub-', '') : entry.mal_id
  const watchLink = isFanDub ? `/fandub/${realId}?ep=${entry.lastEp}` : `/watch/${entry.mal_id}?ep=${entry.lastEp}`
  const infoLink  = isFanDub ? `/fandub/${realId}` : `/anime/${entry.mal_id}`
  return (
    <div className="continue-card">
      <Link to={watchLink} className="continue-thumb">
        <img src={entry.image} alt={entry.title} loading="lazy" />
        <div className="continue-overlay">▶</div>
        <div className="continue-bar">
          <div className="continue-fill" style={{ width: `${pct}%` }} />
        </div>
      </Link>
      <div className="continue-info">
        <Link to={infoLink} className="continue-title">{entry.title}</Link>
        <span className="continue-ep">EP {entry.lastEp}</span>
      </div>
      <button className="continue-remove" onClick={() => onRemove(entry.mal_id)} title="Remover">✕</button>
    </div>
  )
}

function AnimeRow({ title, link, animes, loading, ranked }) {
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
          {animes?.map((a, i) => <AnimeCard key={a.mal_id} anime={a} index={i} rank={ranked ? i + 1 : null} />)}
        </div>
      )}
    </section>
  )
}

const CHIPS = [
  { label: 'Em Alta',     link: '/category/airing' },
  { label: 'Lançamentos', link: '/category/upcoming' },
  { label: 'Ação',        link: '/explorar?genres=1' },
  { label: 'Shounen',     link: '/explorar?genres=27' },
  { label: 'Terror',      link: '/explorar?genres=14' },
  { label: 'Dublado',     link: '/fandubs' },
]

function CategoryChips() {
  return (
    <div className="chips-row">
      {CHIPS.map((c, i) => (
        <Link key={c.label} to={c.link} className={`chip${i === 0 ? ' chip-active' : ''}`}>
          {c.label}
        </Link>
      ))}
    </div>
  )
}

export default function Home() {
  const [featuredFanDubs, setFeaturedFanDubs] = useState([])
  const [seasonal, setSeasonal] = useState([])
  const [top,      setTop]      = useState([])
  const [popular,  setPopular]  = useState([])
  const [upcoming, setUpcoming] = useState([])
  const [loading,  setLoading]  = useState(true)
  const [history,  setHistory]  = useState([])

  useEffect(() => {
    document.title = 'Up Anime+ | Assistir Animes Online Grátis em HD'
    setHistory(getHistory())

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

  const handleRemove = (malId) => {
    removeHistory(malId)
    setHistory(h => h.filter(e => e.mal_id !== malId))
  }

  useJsonLd('faq-schema', {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      { '@type': 'Question', name: 'O que é o Up Anime+?', acceptedAnswer: { '@type': 'Answer', text: 'Up Anime+ é um site gratuito para assistir animes online em HD, com episódios legendados em português e dublados. Tem filmes, OVAs e lançamentos da temporada atualizados diariamente.' } },
      { '@type': 'Question', name: 'Up Anime+ é grátis?', acceptedAnswer: { '@type': 'Answer', text: 'Sim! O Up Anime+ é completamente gratuito. Não é necessário criar conta ou pagar nada para assistir animes.' } },
      { '@type': 'Question', name: 'Tem anime dublado no Up Anime+?', acceptedAnswer: { '@type': 'Answer', text: 'Sim! O Up Anime+ oferece animes tanto legendados em português quanto dublados em português BR.' } },
      { '@type': 'Question', name: 'Precisa de cadastro para assistir?', acceptedAnswer: { '@type': 'Answer', text: 'Não é necessário cadastro para assistir. O login com Google é opcional e serve apenas para salvar favoritos.' } },
      { '@type': 'Question', name: 'Quais animes estão disponíveis?', acceptedAnswer: { '@type': 'Answer', text: 'O Up Anime+ tem milhares de animes incluindo os lançamentos mais recentes, clássicos, filmes e OVAs. O catálogo é atualizado diariamente.' } },
    ],
  })

  // Fan-dubs marcados como destaque (aceita alguns nomes de campo possíveis,
  // já que não temos o código-fonte do studio-proxy pra confirmar o exato)
  useEffect(() => {
    fetch(`${FANDUB_API}/api/fanDubs`)
      .then(r => r.json())
      .then(d => {
        const list = (d.fanDubs || []).filter(f =>
          f.destaque === true || f.emDestaque === true || f.featured === true || f.destaque_home === true
        )
        setFeaturedFanDubs(list)
      })
      .catch(() => {})
  }, [])

  // Fonte primária: API (top em exibição, com fallback pra temporada atual)
  const apiFeatured = top.length > 0 ? top : seasonal

  const fanDubFeatured = featuredFanDubs.map(d => ({
    mal_id: d.id,
    title: d.animeTitulo,
    title_english: d.animeTitulo,
    images: { jpg: { large_image_url: d.capa || d.animeCapa, image_url: d.capa || d.animeCapa } },
    genres: d.genero ? [{ mal_id: 0, name: d.genero }] : [],
    _isFanDub: true,
  }))

  // Intercala fandubs em destaque com o topo da API (fandub sempre em segundo, se existir)
  const heroAnimes = fanDubFeatured.length
    ? [apiFeatured[0], ...fanDubFeatured, ...apiFeatured.slice(1)].filter(Boolean)
    : apiFeatured

  return (
    <div className="home">
      <h1 style={{ display: 'none' }}>Up Anime+ - Assistir Animes Online Grátis em HD</h1>

      <PartnerModal />

      <CategoryChips />

      <Hero animes={heroAnimes} />

      <div className="container">

        {/* ── Continuar Assistindo ── */}
        {history.length > 0 && (
          <section className="section continue-section">
            <div className="section-header">
              <h2 className="section-title">▶ Continuar <span>Assistindo</span></h2>
            </div>
            <div className="continue-grid">
              {history.slice(0, 10).map(entry => (
                <ContinueCard key={entry.mal_id} entry={entry} onRemove={handleRemove} />
              ))}
            </div>
          </section>
        )}

        <AnimeRow title={<>Temporada <span>Atual</span></>}    link="/category/airing"       animes={seasonal.slice(0, 12)} loading={loading} />
        <AnimeRow title={<>Top 10 <span>Hoje</span></>}        link="/category/airing"       animes={top.slice(0, 10)}      loading={loading} ranked />

        {/* ── Fan-Dubs Brasileiros ── */}
        <FanDubsHomeSection />

        <AnimeRow title={<>Mais <span>Populares</span></>}     link="/category/bypopularity" animes={popular.slice(0, 12)}  loading={loading} />
        <AnimeRow title={<>Em <span>Breve</span></>}           link="/category/upcoming"     animes={upcoming.slice(0, 12)} loading={loading} />
      </div>
    </div>
  )
          }
