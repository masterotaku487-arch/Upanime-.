import { useState, useEffect } from 'react'
import './ProfilePage.css'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { FiArrowLeft, FiUser, FiSave } from 'react-icons/fi'


const PREFS_KEY = 'upanime_prefs'

export const loadPrefs = () => {
  try { return JSON.parse(localStorage.getItem(PREFS_KEY) || '{}') } catch { return {} }
}

export const savePrefs = (prefs) => {
  try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)) } catch {}
}

export default function ProfilePage() {
  const { user, login } = useAuth()
  const [saved, setSaved] = useState(false)
  const [prefs, setPrefs] = useState({
    playerMode:  'internal',  // 'internal' | 'mx'
    audioMode:   'sub',       // 'sub' | 'dub'
    autoNext:    true,        // auto próximo ep
    skipIntro:   false,       // skip intro automático
  })

  useEffect(() => {
    const p = loadPrefs()
    if (Object.keys(p).length) setPrefs(p)
  }, [])

  const set = (key, val) => setPrefs(p => ({ ...p, [key]: val }))

  const handleSave = () => {
    savePrefs(prefs)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  if (!user) {
    return (
      <div className="profile-page container">
        <div className="profile-header">
          <Link to="/config" className="back-btn"><FiArrowLeft /> Voltar</Link>
          <h1>Perfil</h1>
        </div>
        <div className="profile-login-prompt">
          <FiUser size={48} />
          <p>Faça login para acessar seu perfil e salvar preferências</p>
          <button className="btn btn-primary" onClick={login}>Entrar com Google</button>
        </div>
      </div>
    )
  }

  return (
    <div className="profile-page container">
      <div className="profile-header">
        <Link to="/config" className="back-btn"><FiArrowLeft /> Voltar</Link>
        <h1>Meu Perfil</h1>
      </div>

      {/* Info da conta */}
      <div className="profile-card">
        <img src={user.picture} alt={user.name} className="profile-avatar-big" />
        <div className="profile-user-info">
          <h2 className="profile-name">{user.name}</h2>
          <p className="profile-email">{user.email}</p>
          <span className="profile-badge">🎌 Otaku</span>
        </div>
      </div>

      {/* Preferências */}
      <div className="profile-section">
        <h3 className="profile-section-title">🎬 Player Preferido</h3>
        <div className="profile-options">
          <button
            className={`profile-option ${prefs.playerMode === 'internal' ? 'active' : ''}`}
            onClick={() => set('playerMode', 'internal')}
          >
            <span className="opt-icon">📱</span>
            <span className="opt-label">Player Interno</span>
            <span className="opt-desc">Assiste dentro do app</span>
          </button>
          <button
            className={`profile-option ${prefs.playerMode === 'mx' ? 'active' : ''}`}
            onClick={() => set('playerMode', 'mx')}
          >
            <span className="opt-icon">🎬</span>
            <span className="opt-label">MX Player</span>
            <span className="opt-desc">Abre automaticamente no MX</span>
          </button>
        </div>
      </div>

      <div className="profile-section">
        <h3 className="profile-section-title">🎧 Áudio Padrão</h3>
        <div className="profile-options">
          <button
            className={`profile-option ${prefs.audioMode === 'sub' ? 'active' : ''}`}
            onClick={() => set('audioMode', 'sub')}
          >
            <span className="opt-icon">🇧🇷</span>
            <span className="opt-label">Legendado</span>
            <span className="opt-desc">Áudio original + legenda PT-BR</span>
          </button>
          <button
            className={`profile-option ${prefs.audioMode === 'dub' ? 'active' : ''}`}
            onClick={() => set('audioMode', 'dub')}
          >
            <span className="opt-icon">🎙️</span>
            <span className="opt-label">Dublado</span>
            <span className="opt-desc">Quando disponível, prefere dublado</span>
          </button>
        </div>
      </div>

      <div className="profile-section">
        <h3 className="profile-section-title">⚙️ Comportamento</h3>
        <div className="profile-toggles">
          <div className="profile-toggle-row">
            <div>
              <span className="toggle-label">▶ Próximo episódio automático</span>
              <span className="toggle-desc">Reproduz o próximo ep ao terminar</span>
            </div>
            <button
              className={`config-toggle ${prefs.autoNext ? 'on' : ''}`}
              onClick={() => set('autoNext', !prefs.autoNext)}
            />
          </div>
          <div className="profile-toggle-row">
            <div>
              <span className="toggle-label">⏩ Pular introdução</span>
              <span className="toggle-desc">Skip automático nos primeiros 90s</span>
            </div>
            <button
              className={`config-toggle ${prefs.skipIntro ? 'on' : ''}`}
              onClick={() => set('skipIntro', !prefs.skipIntro)}
            />
          </div>
        </div>
      </div>

      <button className="profile-save-btn" onClick={handleSave}>
        <FiSave /> {saved ? '✓ Salvo!' : 'Salvar Preferências'}
      </button>

      <p className="profile-note">
        As preferências são salvas localmente neste dispositivo.
      </p>
    </div>
  )
}
