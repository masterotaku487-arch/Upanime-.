import { useRef, useState, useEffect, useCallback } from 'react'
import './VideoPlayer.css'

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

  const resetHideTimer = useCallback(() => {
    setShowControls(true)
    clearTimeout(hideTimer.current)
    if (playing) hideTimer.current = setTimeout(() => setShowControls(false), 3500)
  }, [playing])

  useEffect(() => { resetHideTimer() }, [playing])

  useEffect(() => {
    setShowSkip(currentTime > 5 && currentTime < INTRO_END && playing)
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
    v.paused ? v.play() : v.pause()
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
  const VolumeEmoji = muted || volume === 0 ? '🔇' : volume < 0.5 ? '🔉' : '🔊'

  return (
    <div
      ref={containerRef}
      className={`vp-wrap ${showControls ? 'show-ctrl' : ''} ${fullscreen ? 'vp-fs' : ''}`}
      onMouseMove={resetHideTimer}
      onTouchStart={resetHideTimer}
    >
      <video
        ref={videoRef}
        src={src}
        className="vp-video"
        autoPlay playsInline
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onTimeUpdate={onTimeUpdate}
        onLoadedMetadata={() => setDuration(videoRef.current?.duration || 0)}
        onEnded={() => saveProgress(animeId, epNum, duration, duration)}
        onError={onError}
      />

      {/* Clique central */}
      <div className="vp-click" onClick={togglePlay} />

      {/* Ícone central */}
      {!playing && (
        <div className="vp-center-icon" onClick={togglePlay}>▶</div>
      )}

      {/* Skip intro */}
      {showSkip && (
        <button className="vp-skip" onClick={skipIntro}>
          ⏭ Pular Abertura
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
            <button className="vp-btn" onClick={togglePlay}>
              {playing ? '⏸' : '▶'}
            </button>
            <button className="vp-btn" onClick={() => skip(-10)}>⏪</button>
            <button className="vp-btn" onClick={() => skip(10)}>⏩</button>

            <div
              className="vp-vol-wrap"
              onMouseEnter={() => setShowVolume(true)}
              onMouseLeave={() => setShowVolume(false)}
            >
              <button className="vp-btn" onClick={toggleMute}>{VolumeEmoji}</button>
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
            <button className="vp-btn" onClick={toggleFullscreen}>
              {fullscreen ? '🗗' : '⛶'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
      }

    
