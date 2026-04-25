import { useState, useEffect } from 'react'
import { useParams, useSearchParams, Link } from 'react-router-dom'
import { FiChevronLeft, FiChevronRight } from 'react-icons/fi'
import { getAnimeById, getAnimeEpisodes } from '../services/api'
import { useTranslatedSynopsis } from '../services/translate'
import { saveHistory } from '../services/history'
import { recordWatched } from '../services/achievements'
import VideoPlayer from '../components/VideoPlayer'
import Comments from '../components/Comments'
import FeedbackModal from '../components/FeedbackModal'
import './WatchPage.css'

const AF = 'https://animefire-proxy.masterotaku487.workers.dev'

/* ✅ FETCH CORRIGIDO */
const afFetch = async (params) => {
  const qs = new URLSearchParams({ ...params, _t: Date.now() }).toString()

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 30000)

  try {
    const r = await fetch(`${AF}?${qs}`, {
      signal: controller.signal
    })

    if (!r.ok) throw new Error(`Proxy ${r.status}`)

    return await r.json()
  } finally {
    clearTimeout(timeout)
  }
}

/* 🔥 qualidade */
const bestQuality = (sources = []) => {
  const order = ['1080', '720', '480', '360']
  return [...sources].sort((a, b) => {
    const ai = order.findIndex(o => (a.label || '').includes(o))
    const bi = order.findIndex(o => (b.label || '').includes(o))
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
  })[0] || sources[0]
}

/* 📱 proteção mobile */
const isAndroid = typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent)

export default function WatchPage() {
  const { id } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const epNum = parseInt(searchParams.get('ep') || '1')

  const [anime, setAnime] = useState(null)
  const [episodes, setEpisodes] = useState([])

  const [sources, setSources] = useState([])
  const [currentSrc, setCurrentSrc] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  /* ✅ MODAL CONTROLADO (CORRIGIDO) */
  const [showBugReport, setShowBugReport] = useState(false)

  /* carregar anime */
  useEffect(() => {
    Promise.all([
      getAnimeById(id),
      getAnimeEpisodes(id)
    ]).then(([a, e]) => {
      setAnime(a.data)
      setEpisodes(e.data || [])
    })
  }, [id])

  /* carregar vídeo */
  const loadVideo = async () => {
    if (!anime) return

    setLoading(true)
    setError(false)

    try {
      const slug = anime.title.toLowerCase().replace(/\s+/g, '-')

      const data = await afFetch({
        action: 'video',
        slug,
        ep: epNum
      })

      if (!data.sources?.length) throw new Error()

      const srcs = data.sources.map(s => ({
        ...s,
        url: s.url
      }))

      setSources(srcs)
      setCurrentSrc(bestQuality(srcs)?.url)

    } catch {
      setError(true)
    }

    setLoading(false)
  }

  useEffect(() => {
    loadVideo()
    if (anime) saveHistory(anime, epNum)
  }, [anime, epNum])

  const goEp = (n) => setSearchParams({ ep: n })

  const title = anime?.title || ''
  const synopsis = useTranslatedSynopsis(anime?.synopsis)

  return (
    <div className="watch-page">

      {/* PLAYER */}
      <div className="player-wrap">
        {loading ? (
          <p>🔄 Carregando...</p>
        ) : error ? (
          <div>
            <p>❌ Erro ao carregar</p>
            <button onClick={loadVideo}>Tentar novamente</button>
          </div>
        ) : (
          <VideoPlayer
            src={currentSrc}
            title={`${title} EP${epNum}`}
            sources={sources}
            onQualityChange={(url) => setCurrentSrc(url)}
            onEpisodeWatched={() => {
              recordWatched({
                malId: parseInt(id),
                ep: epNum
              })
            }}
          />
        )}
      </div>

      {/* CONTROLES */}
      <div>
        <button disabled={epNum <= 1} onClick={() => goEp(epNum - 1)}>
          <FiChevronLeft /> Anterior
        </button>

        <span> Episódio {epNum} </span>

        <button onClick={() => goEp(epNum + 1)}>
          Próximo <FiChevronRight />
        </button>
      </div>

      {/* INFO */}
      {anime && (
        <div>
          <Link to={`/anime/${id}`}>← Voltar</Link>
          <h1>{title}</h1>
          <p>{synopsis}</p>
        </div>
      )}

      {/* EP LIST */}
      <div>
        {episodes.map(ep => (
          <button key={ep.mal_id} onClick={() => goEp(ep.mal_id)}>
            EP {ep.mal_id}
          </button>
        ))}
      </div>

      {/* BOTÃO DO MODAL */}
      <div style={{ textAlign: 'center', marginTop: 20 }}>
        <button onClick={() => setShowBugReport(true)}>
          🐛 Relatar problema nesse episódio
        </button>
      </div>

      {/* ✅ MODAL NÃO ABRE SOZINHO */}
      {showBugReport && (
        <FeedbackModal
          animeId={id}
          ep={epNum}
          animeTitle={title}
          onClose={() => setShowBugReport(false)}
        />
      )}

      <Comments animeId={id} ep={epNum} />
    </div>
  )
            }
