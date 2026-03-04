import { useRef, useState, useEffect, useCallback } from 'react'
import './VideoPlayer.css'

const fmt = (s) => {
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
}

// Duração típica de abertura: 85s (padrão anime)
const INTRO_END = 85

export default function VideoPlayer({ src, title, onError, sources = [], onQualityChange }) {
  const videoRef = useRef(null)
  const containerRef = useRef(null)
  const progressRef = useRef(null)
  const hideTimer = useRef(null)

  const [playing, setPlaying]         = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration]       = useState(0)
  const [volume, setVolume]           = useState(1)
  const [muted, setMuted]             = useState(false)
  const [fullscreen, setFullscreen]   = useState(false)
  const [showControls, setShowControls] = useState(true)
  const [showSkip, setShowSkip]       = useState(false)
  const [buffered, setBuffered]       = useState(0)
  const [showVolume, setShowVolume]   = useState(false)

  // Auto-hide controles
  const resetHideTimer = useCallback(() => {
    setShowControls(true)
    clearTimeout(hideTimer.current)
    if (playing) {
      hideTimer.current = setTimeout(() => setShowControls(false), 3000)
    }
  }, [playing])

  useEffect(() => { resetHideTimer() }, [playing])

  // Mostrar botão skip intro entre 5s e INTRO_END
  useEffect(() => {
    setShowSkip(currentTime > 5 && currentTime < INTRO_END && playing)
  }, [currentTime, playing])

  const togglePlay = () => {
    const v = videoRef.current
    if (!v) return
    if (v.paused) v.play()
    else v.pause()
  }

  const skipIntro = () => {
    if (videoRef.current) videoRef.current.currentTime = INTRO_END
  }

  const seek = (e) => {
    const rect = progressRef.current.getBoundingClientRect()
    const ratio = (e.clientX - rect.left) / rect.width
    if (videoRef.current) videoRef.current.currentTime = ratio * duration
  }

  const changeVolume = (e) => {
    const v = parseFloat(e.target.value)
    setVolume(v)
    if (videoRef.current) { videoRef.current.volume = v; videoRef.current.muted = v === 0 }
    setMuted(v === 0)
  }

  const toggleMute = () => {
    const v = videoRef.current
    if (!v) return
    v.muted = !v.muted
    setMuted(v.muted)
  }

  const toggleFullscreen = () => {
    const el = containerRef.current
    if (!document.fullscreenElement) el.requestFullscreen?.()
    else document.exitFullscreen?.()
  }

  useEffect(() => {
    const handler = () => setFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', handler)
    return () => document.removeEventListener('fullscreenchange', handler)
  }, [])

  const skip = (sec) => {
    if (videoRef.current) videoRef.current.currentTime += sec
  }

  const progress = duration ? (currentTime / duration) * 100 : 0
  const bufferedPct = duration ? (buffered / duration) * 100 : 0

  return (
    <div
      ref={containerRef}
      className={`vp-container ${showControls ? 'controls-visible' : ''} ${fullscreen ? 'vp-fullscreen' : ''}`}
      onMouseMove={resetHideTimer}
      onTouchStart={resetHideTimer}
      onClick={togglePlay}
    >
      <video
        ref={videoRef}
        src={src}
        className="vp-video"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onTimeUpdate={() => {
          const v = videoRef.current
          if (!v) return
          setCurrentTime(v.currentTime)
          if (v.buffered.length) setBuffered(v.buffered.end(v.buffered.length - 1))
        }}
        onLoadedMetadata={() => setDuration(videoRef.current?.duration || 0)}
        onError={onError}
        playsInline
      />

      {/* Overlay clicável para play/pause */}
      <div className="vp-overlay" />

      {/* Botão skip intro */}
      {showSkip && (
        <button
          className="vp-skip-btn"
          onClick={(e) => { e.stopPropagation(); skipIntro() }}
        >
          ⏭ Pular Abertura
        </button>
      )}

      {/* Ícone play central quando pausado */}
      {!playing && (
        <div className="vp-play-icon">▶</div>
      )}

      {/* Controles */}
      <div className="vp-controls" onClick={e => e.stopPropagation()}>

        {/* Barra de progresso */}
        <div className="vp-progress-wrap" ref={progressRef} onClick={seek}>
          <div className="vp-progress-bg">
            <div className="vp-buffered" style={{ width: `${bufferedPct}%` }} />
            <div className="vp-played" style={{ width: `${progress}%` }} />
            <div className="vp-thumb" style={{ left: `${progress}%` }} />
          </div>
        </div>

        <div className="vp-bar">
          {/* Esquerda */}
          <div className="vp-left">
            <button className="vp-btn" onClick={togglePlay} title={playing ? 'Pausar' : 'Reproduzir'}>
              {playing ? '⏸' : '▶'}
            </button>
            <button className="vp-btn" onClick={() => skip(-10)} title="-10s">⏪</button>
            <button className="vp-btn" onClick={() => skip(10)} title="+10s">⏩</button>

            {/* Volume */}
            <div
              className="vp-volume-wrap"
              onMouseEnter={() => setShowVolume(true)}
              onMouseLeave={() => setShowVolume(false)}
            >
              <button className="vp-btn" onClick={toggleMute}>
                {muted || volume === 0 ? '🔇' : volume < 0.5 ? '🔉' : '🔊'}
              </button>
              {showVolume && (
                <input
                  type="range" min={0} max={1} step={0.05}
                  value={muted ? 0 : volume}
                  onChange={changeVolume}
                  className="vp-volume-slider"
                />
              )}
            </div>

            <span className="vp-time">
              {fmt(currentTime)} / {fmt(duration)}
            </span>
          </div>

          {/* Direita */}
          <div className="vp-right">
            {/* Qualidade */}
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

            <button className="vp-btn" onClick={toggleFullscreen} title="Tela cheia">
              {fullscreen ? '🗗' : '⛶'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
