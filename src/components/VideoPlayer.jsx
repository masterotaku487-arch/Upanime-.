import { useRef, useState, useEffect, useCallback } from 'react'
import {
  FiPlay, FiPause, FiVolume2, FiVolume1, FiVolumeX,
  FiMaximize, FiMinimize, FiSkipForward,
} from 'react-icons/fi'
import { MdReplay10, MdForward10 } from 'react-icons/md'
import Hls from 'hls.js'
import './VideoPlayer.css'

const isM3u8 = (url = '') => /\.m3u8($|\?)/i.test(url)

const fmt = (s) => {
  if (!s || isNaN(s)) return '0:00'
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
}

const INTRO_END = 85

// Salva progresso no localStorage
const saveProgress = (animeId, ep, current, duration) => {
  if (!animeId || !ep || !duration) return
  const key = `progress_${animeId}_${ep}`
  localStorage.setItem(key, JSON.stringify({ current, duration, ts: Date.now() }))
}

const loadProgress = (animeId, ep) => {
  try {
    const d = localStorage.getItem(`progress_${animeId}_${ep}`)
    return d ? JSON.parse(d) : null
  } catch { return null }
}

export const getAnimeProgress = (animeId, totalEps) => {
  // Retorna % do episódio mais recente assistido
  for (let ep = totalEps; ep >= 1; ep--) {
    try {
      const d = localStorage.getItem(`progress_${animeId}_${ep}`)
      if (d) {
        const { current, duration } = JSON.parse(d)
        if (duration > 0) return { ep, pct: current / duration }
      }
    } catch { }
  }
  return null
}

export default function VideoPlayer({ src, title, animeId, epNum, onError, sources = [], onQualityChange, onEpisodeWatched }) {
  const videoRef     = useRef(null)
  const containerRef = useRef(null)
  const seekRef      = useRef(null)
  const hideTimer    = useRef(null)
  const wasVisibleRef = useRef(true)

  const [playing, setPlaying]           = useState(false)
  const [currentTime, setCurrentTime]   = useState(0)
  const [duration, setDuration]         = useState(0)
  const [buffered, setBuffered]         = useState(0)
  const [volume, setVolume]             = useState(1)
  const [muted, setMuted]               = useState(false)
  const [fullscreen, setFullscreen]     = useState(false)
  const [showControls, setShowControls] = useState(true)
  const [showSkip, setShowSkip]         = useState(false)
  const [showVolume, setShowVolume]     = useState(false)
  const [showWatermark, setShowWatermark] = useState(false)
  const wmTimer = useRef(null)
  const [showFallback, setShowFallback] = useState(false)
  const [debugInfo, setDebugInfo] = useState('')

  // Detecta erro de reprodução (ex.: HLS não suportado no navegador do
  // celular) e mostra a opção de abrir no MX Player em vez de travar.
  const handleVideoError = useCallback((e) => {
    setShowFallback(true)
    // Guarda o motivo exato do erro pra mostrar na tela (facilita diagnosticar
    // sem precisar abrir o DevTools).
    try {
      if (e?.type && e?.details) {
        setDebugInfo(`hls: ${e.type} / ${e.details}${e.response?.code ? ` (HTTP ${e.response.code})` : ''}`)
      } else if (videoRef.current?.error) {
        const codes = { 1: 'ABORTED', 2: 'NETWORK', 3: 'DECODE', 4: 'SRC_NOT_SUPPORTED' }
        setDebugInfo(`video: ${codes[videoRef.current.error.code] || videoRef.current.error.code}`)
      } else {
        setDebugInfo('erro desconhecido')
      }
    } catch { setDebugInfo('erro ao capturar detalhes') }
    onError?.(e)
  }, [onError])

  const openInMxPlayer = () => {
    if (!src) return
    const isAndroid = /android/i.test(navigator.userAgent)
    if (isAndroid) {
      // Formato correto do Android: "intent://" (com barra dupla) + link
      // SEM o "https://" + "scheme=https;" como campo separado. Sem isso
      // o Chrome não reconhece como intent e dá ERR_UNKNOWN_URL_SCHEME.
      const noScheme = src.replace(/^https?:\/\//, '')
      const intentUrl =
        `intent://${noScheme}#Intent;` +
        `scheme=https;` +
        `package=com.mxtech.videoplayer.ad;` +
        `S.title=${encodeURIComponent(title || 'Episódio')};` +
        `S.browser_fallback_url=${encodeURIComponent('https://play.google.com/store/apps/details?id=com.mxtech.videoplayer.ad')};` +
        `end`
      window.location.href = intentUrl
    } else {
      window.open(src, '_blank')
    }
  }

  // Restaurar progresso ao carregar
  useEffect(() => {
    const saved = loadProgress(animeId, epNum)
    if (saved && saved.current > 10 && saved.current < saved.duration - 10) {
      const restore = () => {
        if (videoRef.current) videoRef.current.currentTime = saved.current
      }
      videoRef.current?.addEventListener('loadedmetadata', restore, { once: true })
    }
  }, [src, animeId, epNum])

  // Carrega a fonte de vídeo. Se for .m3u8 (HLS), usa hls.js — necessário
  // pra tocar em Chrome/Firefox/Android, que não suportam HLS nativamente.
  // Safari/iOS tocam .m3u8 nativamente e não passam por aqui.
  useEffect(() => {
    const video = videoRef.current
    if (!video || !src) return

    setShowFallback(false)
    let hls

    if (isM3u8(src)) {
      const nativeHls = video.canPlayType('application/vnd.apple.mpegurl')

      if (nativeHls) {
        // Safari/iOS: suporte nativo
        video.src = src
        video.addEventListener('loadedmetadata', () => {
          video.play().catch(() => {})
        }, { once: true })
      } else if (Hls.isSupported()) {
        hls = new Hls()
        hls.loadSource(src)
        hls.attachMedia(video)
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          console.log('M3U8 carregado!')
          video.play().catch(() => {})
        })
        hls.on(Hls.Events.ERROR, (_evt, data) => {
          console.error('Erro HLS:', data)
        })
      } else {
        console.error('[VideoPlayer] navegador sem suporte a HLS')
      }
    } else {
      // MP4 e outros formatos diretos
      video.src = src
    }

    return () => {
      if (hls) {
        hls.destroy()
      }
    }
  }, [src])

  const resetHideTimer = useCallback(() => {
    setShowControls(true)
    clearTimeout(hideTimer.current)
    if (playing) hideTimer.current = setTimeout(() => setShowControls(false), 3500)
  }, [playing])

  useEffect(() => { resetHideTimer() }, [playing])

  useEffect(() => {
    setShowSkip(currentTime > 5 && currentTime < INTRO_END && playing)
  }, [currentTime, playing])

  // Marca d'água — aparece aos 2min, depois a cada 5min, some após 6s
  useEffect(() => {
    if (!playing) return
    const FIRST  = 120  // 2 minutos
    const REPEAT = 300  // a cada 5 minutos
    const SHOW   = 6000 // fica 6 segundos

    if (currentTime >= FIRST) {
      const cycle = Math.floor((currentTime - FIRST) / REPEAT)
      const inWindow = (currentTime - FIRST) % REPEAT < (SHOW / 1000)
      if (inWindow && !showWatermark) {
        setShowWatermark(true)
        clearTimeout(wmTimer.current)
        wmTimer.current = setTimeout(() => setShowWatermark(false), SHOW)
      }
    }
  }, [currentTime, playing])


  useEffect(() => {
    const handler = () => setFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', handler)
    return () => document.removeEventListener('fullscreenchange', handler)
  }, [])

  // Atalhos de teclado
  useEffect(() => {
    const onKey = (e) => {
      if (['INPUT','SELECT','TEXTAREA'].includes(e.target.tagName)) return
      if (e.code === 'Space')      { e.preventDefault(); togglePlay() }
      if (e.code === 'ArrowRight') skip(10)
      if (e.code === 'ArrowLeft')  skip(-10)
      if (e.code === 'ArrowUp')    { e.preventDefault(); changeVol(0.1) }
      if (e.code === 'ArrowDown')  { e.preventDefault(); changeVol(-0.1) }
      if (e.code === 'KeyF')       toggleFullscreen()
      if (e.code === 'KeyM')       toggleMute()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [playing, volume])

  const togglePlay = () => {
    const v = videoRef.current; if (!v) return
    if (v.paused) {
      v.play().catch(err => console.warn('[VideoPlayer] play() bloqueado:', err.message))
    } else {
      v.pause()
    }
  }

  const skip = (s) => { if (videoRef.current) videoRef.current.currentTime += s }

  const skipIntro = () => { if (videoRef.current) videoRef.current.currentTime = INTRO_END }

  const toggleMute = () => {
    const v = videoRef.current; if (!v) return
    v.muted = !v.muted; setMuted(v.muted)
  }

  const changeVol = (delta) => {
    const v = videoRef.current; if (!v) return
    const nv = Math.min(1, Math.max(0, volume + delta))
    v.volume = nv; setVolume(nv)
  }

  const handleVolumeChange = (e) => {
    const val = parseFloat(e.target.value)
    setVolume(val)
    if (videoRef.current) { videoRef.current.volume = val; videoRef.current.muted = val === 0 }
    setMuted(val === 0)
  }

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) containerRef.current?.requestFullscreen()
    else document.exitFullscreen()
  }

  // Seek ao clicar na barra
  const seekTo = (e) => {
    const rect = seekRef.current.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    if (videoRef.current) videoRef.current.currentTime = ratio * duration
  }

  // Seek touch (mobile)
  const seekTouch = (e) => {
    const rect = seekRef.current.getBoundingClientRect()
    const touch = e.touches[0]
    const ratio = Math.max(0, Math.min(1, (touch.clientX - rect.left) / rect.width))
    if (videoRef.current) videoRef.current.currentTime = ratio * duration
  }

  const watchedTriggered = useRef(false)

  const onTimeUpdate = () => {
    const v = videoRef.current; if (!v) return
    setCurrentTime(v.currentTime)
    if (v.buffered.length) setBuffered(v.buffered.end(v.buffered.length - 1))
    // Salva progresso a cada 5s
    if (Math.round(v.currentTime) % 5 === 0) saveProgress(animeId, epNum, v.currentTime, v.duration)
    // Dispara conquista ao assistir ≥75% do ep
    if (!watchedTriggered.current && v.duration > 0 && (v.currentTime / v.duration) >= 0.75) {
      watchedTriggered.current = true
      onEpisodeWatched?.()
    }
  }

  const progress    = duration ? (currentTime / duration) * 100 : 0
  const bufferedPct = duration ? (buffered  / duration) * 100 : 0
  const VolumeIcon  = muted || volume === 0 ? FiVolumeX : volume < 0.5 ? FiVolume1 : FiVolume2

  return (
    <div
      ref={containerRef}
      className={`vp-wrap ${showControls ? 'show-ctrl' : ''} ${fullscreen ? 'vp-fs' : ''}`}
      onMouseMove={resetHideTimer}
      onTouchStart={() => { wasVisibleRef.current = showControls; resetHideTimer() }}
    >
      <video
        ref={videoRef}
        className="vp-video"
        autoPlay playsInline
        onPlay={() => { setPlaying(true); setShowFallback(false) }}
        onPause={() => setPlaying(false)}
        onTimeUpdate={onTimeUpdate}
        onLoadedMetadata={() => { setDuration(videoRef.current?.duration || 0); setShowFallback(false) }}
        onEnded={() => saveProgress(animeId, epNum, duration, duration)}
        onError={handleVideoError}
      />

      {/* Fallback do MX Player DESLIGADO por enquanto — focando em fazer o
          player normal funcionar primeiro, igual ao teste HTML que funcionou. */}
      {false && showFallback && (
        <div className="vp-mx-fallback">
          <img src="/mxplayer-fallback.png" alt="Abrir no MX Player" onClick={openInMxPlayer} />
        </div>
      )}

      {/* Toque na área do vídeo: primeiro toque só revela os controles,
          só alterna play/pause quando os controles já estão visíveis
          (evita pausar sem querer ao tocar pra ver a barra) */}
      <div
        className="vp-click"
        onClick={() => {
          if (!wasVisibleRef.current) { wasVisibleRef.current = true; return }
          togglePlay()
        }}
      />

      {/* Ícone central */}
      {!playing && (
        <div className="vp-center-icon" onClick={(e) => { e.stopPropagation(); togglePlay() }}><FiPlay /></div>
      )}

      {/* Skip intro */}
      {showWatermark && (
        <div className="vp-watermark" style={(() => {
          const positions = [
            { top:'18px',  right:'18px',  left:'auto',  bottom:'auto' },
            { top:'18px',  left:'18px',   right:'auto', bottom:'auto' },
            { bottom:'80px', right:'18px', left:'auto',  top:'auto'   },
            { bottom:'80px', left:'18px',  right:'auto', top:'auto'   },
          ]
          return positions[Math.floor(Date.now()/1000) % 4]
        })()}>
          upanime-nine.vercel.app
        </div>
      )}

      {showSkip && (
        <button className="vp-skip" onClick={skipIntro}>
          <FiSkipForward /> Pular Abertura
        </button>
      )}

      {/* Gradiente */}
      <div className="vp-grad" />

      {/* Controles */}
      <div className="vp-controls">

        {/* ── SEEKBAR ── */}
        <div
          className="vp-seekbar"
          ref={seekRef}
          onClick={seekTo}
          onTouchMove={seekTouch}
        >
          <div className="vp-track">
            <div className="vp-buf" style={{ width: `${bufferedPct}%` }} />
            <div className="vp-prog" style={{ width: `${progress}%` }}>
              <div className="vp-thumb" />
            </div>
          </div>
          {/* Tempo */}
          <div className="vp-time">
            {fmt(currentTime)} / {fmt(duration)}
          </div>
        </div>

        {/* ── BOTÕES ── */}
        <div className="vp-bar">
          <div className="vp-left">
            <button className="vp-btn" onClick={togglePlay} aria-label={playing ? 'Pausar' : 'Reproduzir'}>
              {playing ? <FiPause /> : <FiPlay />}
            </button>
            <button className="vp-btn" onClick={() => skip(-10)} aria-label="Voltar 10 segundos"><MdReplay10 /></button>
            <button className="vp-btn" onClick={() => skip(10)} aria-label="Avançar 10 segundos"><MdForward10 /></button>

            <div
              className="vp-vol-wrap"
              onMouseEnter={() => setShowVolume(true)}
              onMouseLeave={() => setShowVolume(false)}
            >
              <button className="vp-btn" onClick={toggleMute} aria-label="Volume"><VolumeIcon /></button>
              {showVolume && (
                <input
                  type="range" min={0} max={1} step={0.05}
                  value={muted ? 0 : volume}
                  onChange={handleVolumeChange}
                  className="vp-vol-slider"
                />
              )}
            </div>
          </div>

          <div className="vp-right">
            {sources.length > 1 && (
              <select
                className="vp-quality"
                value={src}
                onChange={e => onQualityChange?.(e.target.value)}
              >
                {sources.map(s => (
                  <option key={s.url} value={s.url}>{s.label || 'Auto'}</option>
                ))}
              </select>
            )}
            <button className="vp-btn" onClick={toggleFullscreen} aria-label="Tela cheia">
              {fullscreen ? <FiMinimize /> : <FiMaximize />}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
                                  }
