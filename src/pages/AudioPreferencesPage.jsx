import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { FiArrowLeft, FiSave } from 'react-icons/fi'
import { loadPrefs, savePrefs } from './ProfilePage'
import './ProfilePage.css'

export default function AudioPreferencesPage() {
  const [prefs, setPrefs] = useState({ audioMode: 'sub' })
  const [saved, setSaved] = useState(false)

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

  return (
    <div className="profile-page container">
      <div className="profile-header">
        <Link to="/config" className="back-btn"><FiArrowLeft /> Voltar</Link>
        <h1>Áudio e Legenda</h1>
      </div>

      <div className="profile-section">
        <h3 className="profile-section-title">🎧 Áudio Padrão</h3>
        <p className="toggle-desc" style={{ marginBottom: 12 }}>
          Escolha o que o player tenta priorizar ao abrir um episódio. Se o
          anime não tiver a opção escolhida disponível, ele usa a outra
          automaticamente.
        </p>
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

      <button className="profile-save-btn" onClick={handleSave}>
        <FiSave /> {saved ? '✓ Salvo!' : 'Salvar Preferência'}
      </button>
    </div>
  )
}
