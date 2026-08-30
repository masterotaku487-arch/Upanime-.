// src/components/GuestModal.jsx
import { useState, useRef, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import './GuestModal.css'

export default function GuestModal() {
  const { showGuestModal, closeGuestModal, loginAsGuest } = useAuth()
  const [name, setName]       = useState('')
  const [avatar, setAvatar]   = useState('')
  const [preview, setPreview] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')
  const fileRef = useRef()
  const googleBtnRef = useRef()

  // Renderiza o botão REAL do Google (não o prompt() automático, que os
  // navegadores modernos costumam bloquear silenciosamente).
  useEffect(() => {
    if (!showGuestModal) return
    let tries = 0
    const tryRender = () => {
      if (window.google?.accounts?.id && googleBtnRef.current) {
        googleBtnRef.current.innerHTML = '' // evita duplicar se re-renderizar
        window.google.accounts.id.renderButton(googleBtnRef.current, {
          theme: 'filled_black',
          size: 'large',
          text: 'continue_with',
          shape: 'pill',
          width: 280,
        })
      } else if (tries < 20) {
        // Script do Google pode ainda não ter carregado — tenta de novo por um tempo
        tries++
        setTimeout(tryRender, 250)
      }
    }
    tryRender()
  }, [showGuestModal])

  if (!showGuestModal) return null

  const handleFile = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) { setError('Imagem muito grande (máx 2MB)'); return }
    const reader = new FileReader()
    reader.onload = (ev) => { setPreview(ev.target.result); setAvatar(ev.target.result) }
    reader.readAsDataURL(file)
  }

  const handleSubmit = async () => {
    if (!name.trim()) { setError('Digite seu nome'); return }
    setLoading(true)
    await loginAsGuest(name.trim(), avatar)
    setLoading(false)
  }

  return (
    <div className="guest-modal-overlay" onClick={closeGuestModal}>
      <div className="guest-modal" onClick={e => e.stopPropagation()}>
        <button className="guest-modal-close" onClick={closeGuestModal}>✕</button>
        <h2 className="guest-modal-title">👤 Entrar como Visitante</h2>
        <p className="guest-modal-sub">Escolha um nome e foto para comentar</p>

        {/* Avatar */}
        <div className="guest-avatar-wrap" onClick={() => fileRef.current?.click()}>
          {preview
            ? <img src={preview} alt="avatar" className="guest-avatar-img" />
            : <div className="guest-avatar-placeholder">📷</div>
          }
          <div className="guest-avatar-hint">Clique para adicionar foto</div>
        </div>
        <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFile} />

        {/* Nome */}
        <input
          className="guest-modal-input"
          placeholder="Seu nome..."
          maxLength={50}
          value={name}
          onChange={e => { setName(e.target.value); setError('') }}
          onKeyDown={e => e.key === 'Enter' && handleSubmit()}
        />

        {error && <p className="guest-modal-error">{error}</p>}

        <button className="guest-modal-btn" onClick={handleSubmit} disabled={loading}>
          {loading ? 'Entrando...' : '✅ Entrar'}
        </button>

        <div className="guest-modal-divider"><span>ou</span></div>

        <div className="guest-google-btn-wrap">
          <div ref={googleBtnRef} className="guest-google-btn-real" />
        </div>

        <p className="guest-modal-note">
          Visitantes podem comentar e curtir, mas conquistas e favoritos são salvos apenas com conta Google.
        </p>
      </div>
    </div>
  )
}
