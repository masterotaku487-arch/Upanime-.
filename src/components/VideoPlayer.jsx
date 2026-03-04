import { useRef, useState, useEffect, useCallback } from 'react'
import {
  Play, Pause, Volume2, VolumeX, Volume1,
  SkipBack, SkipForward, Maximize, Minimize,
  Settings
} from 'lucide-react'
import './VideoPlayer.css'

const fmt = (s) => {
  if (!s || isNaN(s)) return '0:00'
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
}

const INTRO_END = 85 // segundos — duração típica de abertura

export default function VideoPlayer({ src, title, onError, sources = [], onQualityChange }) {
  const videoRef    = useRef(null)
  const containerRef = useRef(null)
  const progressRef = useRef(null)
  const hideTimer   = useRef(null)

  const [playing, setPlaying]           = useState(false)
  const [currentTime, setCurrentTime]   = useState(0)
  const [duration, setDuration]         = useState(0)
  const [volume, setVolume]             = useState(1)
  const [muted, setMuted]               = useState(false)
  const [fullscreen, setFullscreen]     = useState(false)
  const [showControls, setShowControls] = useState(true)
  const [showSkip, setShowSkip]         = useState(false)
  const [buffered, setBuffered]         = useState(0)
  const [showVolume, setShowVolume]     = useState(false)
  const [showQuality, setShowQuality]   = useState(false)
  const [seeking, setSeeking]           = useState(false)

  const resetHideTimer = useCallback(() => {
    setShowControls(true)
    clearTimeout(hideTimer.current)
    if (playing && !seeking) {
      hideTimer.current = setTimeout(() => setShowControls(false), 3500)
    }
  }, [playing, seeking])

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
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return
      if (e.code === 'Space') { e.preventDefault(); togglePlay() }
      if (e.code === 'ArrowRight') skip(10)
      if (e.code === 'ArrowLeft')  skip(-10)
      if (e.code === 'ArrowUp')    changeVolumeBy(0.1)
      if (e.code === 'ArrowDown')  changeVolumeBy(-0.1)
      if (e.code === 'KeyF')       toggleFullscreen()
      if (e.code === 'KeyM')       toggleMute()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [playing, volume])

  const togglePlay = () => {
    const v = videoRef.current
    if (!v) return
    v.paused ? v.play() : v.pause()
  }

  const skip = (sec) => {
    if (videoRef.current) videoRef.current.currentTime += sec
  }

  const skipIntro = () => {
    if (videoRef.current) videoRef.current.currentTime = INTRO_END
  }

  const toggleMute = () => {
    const v = videoRef.current
    if (!v) return
    v.muted = !v.muted
    setMuted(v.muted)
  }

  const changeVolumeBy = (delta) => {
    const newVol = Math.min(1, Math.max(0, volume + delta))
    setVolume(newVol)
    if (videoRef.current) { videoRef.current.volume = newVol; videoRef.current.muted = false }
    setMuted(false)
  }

  const handleVolumeChange = (e) => {
    const v = parseFloat(e.target.value)
    setVolume(v)
    if (videoRef.current) { videoRef.current.volume = v; videoRef.current.muted = v === 0 }
    setMuted(v === 0)
  }

  const toggleFullscreen = () => {
    const el = containerRef.current
    if (!document.fullscreenElement) el.requestFullscreen?.()
    else document.exitFullscreen?.()
  }

  const seekTo = (e) => {
    const rect = progressRef.current.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    if (videoRef.current) videoRef.current.currentTime = ratio * duration
  }

  const progress    = duration ? (currentTime / duration) * 100 : 0
  const bufferedPct = duration ? (buffered  / duration) * 100 : 0

  const VolumeIcon = muted || volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2

  return (
    <div
      ref={containerRef}
      className={`vp-container ${showControls ? 'controls-visible' : ''} ${fullscreen ? 'vp-fullscreen' : ''}`}
      onMouseMove={resetHideTimer}
      onTouchStart={resetHideTimer}
    >
      {/* Vídeo */}
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
        autoPlay
      />

      {/* Clique central play/pause */}
      <div className="vp-clickzone" onClick={togglePlay} />

      {/* Ícone central ao pausar */}
      {!playing && (
        <div className="vp-center-icon" onClick={togglePlay}>
          <Play size={52} fill="white" strokeWidth={0} />
        </div>
      )}

      {/* Botão Skip Intro */}
      {showSkip && (
        <button className="vp-skip-intro" onClick={skipIntro}>
          <SkipForward size={14} strokeWidth={2.5} />
          Pular Abertura
        </button>
      )}

      {/* Gradiente inferior */}
      <div className="vp-gradient" />

      {/* Controles */}
      <div className="vp-controls">

        {/* Barra de progresso */}
        <div
          className="vp-seekbar"
          ref={progressRef}
          onClick={seekTo}
          onMouseDown={() => setSeeking(true)}
          onMouseUp={() => setSeeking(false)}
        >
          <div className="vp-track">
            <div className="vp-buffered" style={{ width: `${bufferedPct}%` }} />
            <div className="vp-progress" style={{ width: `${progress}%` }}>
              <div className="vp-handle" />
            </div>
          </div>
        </div>

        {/* Barra de botões */}
        <div className="vp-toolbar">

          {/* Esquerda */}
          <div className="vp-group">
            <button className="vp-btn" onClick={togglePlay} title={playing ? 'Pausar (Space)' : 'Reproduzir (Space)'}>
              {playing ? <Pause size={20} fill="white" strokeWidth={0} /> : <Play size={20} fill="white" strokeWidth={0} />}
            </button>

            <button className="vp-btn" onClick={() => skip(-10)} title="Voltar 10s (←)">
              <SkipBack size={18} strokeWidth={2} />
            </button>

            <button className="vp-btn" onClick={() => skip(10)} title="Avançar 10s (→)">
              <SkipForward size={18} strokeWidth={2} />
            </button>

            {/* Volume */}
            <div
              className="vp-volume-group"
              onMouseEnter={() => setShowVolume(true)}
              onMouseLeave={() => setShowVolume(false)}
            >
              <button className="vp-btn" onClick={toggleMute} title="Mudo (M)">
                <VolumeIcon size={18} strokeWidth={2} />
              </button>
              <div className={`vp-volume-slider-wrap ${showVolume ? 'visible' : ''}`}>
                <input
                  type="range" min={0} max={1} step={0.02}
                  value={muted ? 0 : volume}
                  onChange={handleVolumeChange}
                  className="vp-volume-range"
                />
              </div>
            </div>

            <span className="vp-time-label">
              {fmt(currentTime)} <span className="vp-time-sep">/</span> {fmt(duration)}
            </span>
          </div>

          {/* Direita */}
          <div className="vp-group">
            {/* Qualidade */}
            {sources.length > 1 && (
              <div className="vp-quality-wrap">
                <button className="vp-btn vp-quality-btn" onClick={() => setShowQuality(o => !o)}>
                  <Settings size={16} strokeWidth={2} />
                  <span className="vp-quality-label">
                    {sources.find(s => s.url === src)?.label || 'Auto'}
                  </span>
                </button>
                {showQuality && (
                  <div className="vp-quality-menu">
                    {sources.map(s => (
                      <button
                        key={s.url}
                        className={`vp-quality-item ${s.url === src ? 'active' : ''}`}
                        onClick={() => { onQualityChange?.(s.url); setShowQuality(false) }}
                      >
                        {s.label || 'Auto'}
                        {s.url === src && <span className="vp-quality-check">✓</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <button className="vp-btn" onClick={toggleFullscreen} title="Tela cheia (F)">
              {fullscreen
                ? <Minimize size={18} strokeWidth={2} />
                : <Maximize size={18} strokeWidth={2} />
              }
            </button>
          </div>
        </div>
      </div>
    </div>
  )
          }
