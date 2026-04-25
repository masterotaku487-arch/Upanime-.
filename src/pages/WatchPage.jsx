import { useState, useEffect, useCallback } from 'react'
import { useParams, useSearchParams, Link } from 'react-router-dom'
import { FiChevronLeft, FiChevronRight } from 'react-icons/fi'
import { getAnimeById, getAnimeEpisodes } from '../services/api'
import { useTranslatedSynopsis } from '../services/translate'
import { saveHistory } from '../services/history'
import { recordWatched, ACHIEVEMENTS } from '../services/achievements'
import VideoPlayer from '../components/VideoPlayer'
import Comments from '../components/Comments'
import FeedbackModal from '../components/FeedbackModal'
import './WatchPage.css'

// ─────────────────────────────────────────────────────────
// PROXIES ATUALIZADOS 2026 (AnimeFire + mirrors ativos)
// ─────────────────────────────────────────────────────────
const AF = 'https://animefire-proxy.vynx.workers.dev' || 'https://hianime-proxy.ekaonin.workers.dev'
const CC_PROXY = 'https://media-proxy.vynx.workers.dev/hianime' // animesonlinecc fallback

// Polyfill AbortSignal.timeout para browsers antigos
const timeoutSignal = (ms) => {
  if ('timeout' in AbortSignal) return AbortSignal.timeout(ms)
  const controller = new AbortController()
  setTimeout(() => controller.abort(), ms)
  return controller.signal
}

const proxyUrl = (url) => `/api/proxy?url=${encodeURIComponent(url)}`

const afFetch = async (params) => {
  const qs = new URLSearchParams({ ...params, _t: Date.now() }).toString()
  const r = await fetch(`${AF}?${qs}`, { signal: timeoutSignal(30000) })
  if (!r.ok) throw new Error(`Proxy ${r.status}: ${AF}`)
  return r.json()
}

// ... (slugify, stripSeason, stripSubtitle iguais ao seu código)

const SLUG_MAP = { // ADICIONADO DE VOLTA
  32995: 'yuri-on-ice',
  31758: 'mob-psycho-100',
  35790: 'black-clover',
  38000: 'given',
  38474: 'vinland-saga',
  40748: 'kimetsu-no-yaiba-mugen-ressha-hen',
}

// ... (buildSlugCandidates, probeSlug, resolveSlug, bestQuality iguais)

const getDirectUrl = (url) => { /* igual */ }

// ─── FUNÇÕES DE PLAYER FORA DO COMPONENTE (FIX SCOPE) ───
const openVLC = (url, title) => {
  const directUrl = getDirectUrl(url)
  window.location.href = `vlc://${directUrl}`
  setTimeout(() => window.open(directUrl, '_blank'), 1500)
}

const openMXPlayer = (url, title) => {
  const directUrl = getDirectUrl(url)
  const titleEnc = encodeURIComponent(title)
  const referer = encodeURIComponent('https://animefire.plus')
  const ua = encodeURIComponent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36')
  const intent = `intent:${directUrl}#Intent;action=android.intent.action.VIEW;type=video/*;package=com.mxtech.videoplayer.ad;S.title=${titleEnc};S.headers_Referer=${referer};S.headers_User-Agent=${ua};end`
  window.location.href = intent
}

export default function WatchPage() {
  const { id } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const epNum = parseInt(searchParams.get('ep') || '1')
  const isDub = searchParams.get('dub') === '1'

  // ... states iguais, + MANUAL URL ADICIONADO
  const [manualUrl, setManualUrl] = useState('')
  const [showManual, setShowManual] = useState(false)

  // ... useEffects iguais

  const doLoad = async (animeObj, ep, dub, cachedSlug) => {
    // ... seu código igual, mas fallbacks atualizados:
    } catch (e) {
      // Fallback 1: Novo proxy CC 2026
      try {
        setStatus('🔄 animesonlinecc.to...')
        const ccRes = await fetch(`${CC_PROXY}/extract?title=${encodeURIComponent(animeObj.title_english || animeObj.title)}&episode=${ep}`)
        const ccData = await ccRes.json()
        if (ccData.sources?.length) {
          setSources(ccData.sources.map(s => ({...s, url: proxyUrl(s.url)})))
          setCurrentSrc(ccData.sources[0].url)
          setStatus('✅ animesonlinecc')
          setLoading(false)
          return
        }
      } catch {}

      setError(true)
      setErrorMsg(e.message)
      setShowManual(true) // MOSTRA CAMPO MANUAL
    } finally {
      setLoading(false)
    }
  }

  // NOVA: Carrega URL manual
  const loadManualUrl = async () => {
    if (manualUrl.includes('animefire')) {
      const slug = manualUrl.split('/').pop()
      const data = await afFetch({ action: 'video', slug, ep: epNum })
      if (data.sources?.length) {
        setSources(data.sources.map(s => ({...s, url: proxyUrl(s.url)})))
        setCurrentSrc(data.sources[0].url)
        setError(false)
        setShowManual(false)
      }
    }
  }

  // ... resto igual

  return (
    <div className="watch-page">
      {/* ... toasts iguais */}

      <div className="watch-layout">
        <div className="watch-main">
          <div className="player-wrap">
            {loading ? (
              // ... loading igual
            ) : error ? (
              <div className="player-error">
                <span>😕</span>
                <h3>Anime não encontrado</h3>
                <p>Cole link do AnimeFire:</p>
                {/* CAMPO MANUAL ADICIONADO */}
                <div className="manual-input-wrap">
                  <input 
                    value={manualUrl} 
                    onChange={e => setManualUrl(e.target.value)}
                    placeholder="https://animefire.plus/animes/naruto-shippuden"
                  />
                  <button onClick={loadManualUrl} className="btn">▶ Carregar</button>
                </div>
                <div className="error-btns">
                  <button onClick={() => doLoad(anime, epNum, isDub)}>🔄 Retry</button>
                  <a href="https://animefire.plus" target="_blank" className="btn">Abrir Site</a>
                </div>
              </div>
            ) : currentSrc ? (
              <VideoPlayer src={currentSrc} /* ... props iguais */ />
            ) : null}
          </div>

          {/* FIX: Audio + Quality completo */}
          <div className="controls-bar">
            <div className="audio-toggle">
              <button className={!isDub ? 'active' : ''} onClick={() => toggleDub()}>
                🇧🇷 Leg
              </button>
              <button className={isDub ? 'active' : ''} onClick={() => toggleDub()}>
                🎙️ Dub
              </button>
            </div>
            
            {sources.length > 1 && (
              <select onChange={e => setCurrentSrc(e.target.value)} value={currentSrc}>
                {sources.map((s, i) => (
                  <option key={i} value={s.url}>{s.label || 'Auto'}</option>
                ))}
              </select>
            )}
            
            <div className="player-actions">
              <button onClick={() => openMXPlayer(currentSrc, title)}>📱 MX Player</button>
              <button onClick={() => openVLC(currentSrc, title)}>🖥️ VLC</button>
            </div>
          </div>

          {/* ... resto JSX: episodes list, synopsis, comments */}
        </div>
      </div>
    </div>
  )
}
