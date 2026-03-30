import { useState, useEffect } from 'react'
import './WelcomeBanner.css'

const STORAGE_KEY = 'upanime_welcome_seen'

export default function WelcomeBanner() {
  const [visible, setVisible] = useState(false)
  const [closing, setClosing] = useState(false)

  useEffect(() => {
    // Mostra so na primeira visita
    const seen = localStorage.getItem(STORAGE_KEY)
    if (!seen) {
      setTimeout(() => setVisible(true), 300)
    }
  }, [])

  const close = () => {
    setClosing(true)
    setTimeout(() => {
      setVisible(false)
      localStorage.setItem(STORAGE_KEY, '1')
    }, 400)
  }

  if (!visible) return null

  return (
    <div className={`welcome-overlay ${closing ? 'closing' : ''}`} onClick={close}>
      <div className={`welcome-modal ${closing ? 'closing' : ''}`} onClick={e => e.stopPropagation()}>
        <img
          src="/banner-bemvindo.jpg"
          alt="Bem-vindo ao UpAnime+"
          className="welcome-img"
        />
        <div className="welcome-footer">
          <p className="welcome-text">Seu destino de animes grátis 🎌</p>
          <button className="welcome-btn" onClick={close}>
            Explorar agora ✨
          </button>
          <button className="welcome-skip" onClick={close}>
            Não mostrar novamente
          </button>
        </div>
      </div>
    </div>
  )
}
