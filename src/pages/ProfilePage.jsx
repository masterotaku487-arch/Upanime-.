import { useState, useEffect } from 'react'
import './ProfilePage.css'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { FiArrowLeft, FiUser, FiSave, FiGift, FiCopy, FiCheck, FiAward } from 'react-icons/fi'
import { useAchievements, ACHIEVEMENTS } from '../hooks/useAchievements'
import { useReferral } from '../hooks/useReferral'
import { getProfile } from '../services/supabase'

const REWARDS_API = 'https://rewards-proxy.masterotaku487.workers.dev'


const PREFS_KEY = 'upanime_prefs'

export const loadPrefs = () => {
  try { return JSON.parse(localStorage.getItem(PREFS_KEY) || '{}') } catch { return {} }
}

export const savePrefs = (prefs) => {
  try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)) } catch {}
}

export default function ProfilePage() {
  const { user, login, isVip, isAdmin } = useAuth()
  const nav = useNavigate()
  const [saved, setSaved] = useState(false)
  const [copied, setCopied] = useState(false)
  const [refCount, setRefCount] = useState(0)
  const [dbProfile, setDbProfile] = useState(null)
  const { getUnlocked, checkStats } = useAchievements()
  const { getReferralLink, getMyReferralCount, VIP_THRESHOLD } = useReferral()
  const [rewards, setRewards] = useState(null)
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

  useEffect(() => {
    if (!user) return
    getMyReferralCount().then(setRefCount)
    getProfile(user.id).then(p => { if (p) setDbProfile(p) })
  }, [user?.id])

  useEffect(() => {
    if (!user?.id) return
    const uid = user.id
    fetch(`${REWARDS_API}/verificar/${uid}`)
      .then(r => r.json())
      .then(d => setRewards(d))
      .catch(() => {})
  }, [user])

  const set = (key, val) => setPrefs(p => ({ ...p, [key]: val }))

  const copyRefLink = () => {
    const link = getReferralLink()
    if (!link) return
    navigator.clipboard.writeText(link)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

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
        <div className="profile-avatar-wrap">
          <img src={user.picture} alt={user.name} className="profile-avatar-big" />
          {rewards?.vip && <div className="profile-vip-ring" />}
        </div>
        <div className="profile-user-info">
          <h2 className="profile-name" style={rewards?.cor ? {color: rewards.cor} : {}}>
            {user.name}
          </h2>
          {rewards?.tituloPrincipal && (
            <div className="profile-titulo">✨ {rewards.tituloPrincipal}</div>
          )}
          <p className="profile-email">{user.email}</p>
          <div className="profile-badges-row">
            {rewards?.vip
              ? <span className="profile-badge profile-badge-vip">💎 VIP</span>
              : <span className="profile-badge">🎌 Otaku</span>
            }
            {rewards?.cargos?.map((cargo, i) => (
              <span key={i} className="profile-badge profile-badge-cargo">🏅 {cargo}</span>
            ))}
          </div>
          {rewards?.xp > 0 && (
            <div className="profile-xp-bar-wrap">
              <div className="profile-xp-label">⭐ {rewards.xp} XP</div>
            </div>
          )}
        </div>
      </div>

      {/* VIP / convites */}
      {!isVip && !isAdmin && (
        <div className="profile-vip-card">
          <div className="profile-vip-header">
            <span>💎 Torne-se VIP</span>
            <span className="profile-vip-count">{refCount}/{VIP_THRESHOLD} convidados</span>
          </div>
          <div className="profile-vip-bar">
            <div className="profile-vip-fill" style={{ width: `${Math.min(100,(refCount/VIP_THRESHOLD)*100)}%` }} />
          </div>
          <p className="profile-vip-desc">Convide {VIP_THRESHOLD - refCount} amigos para ganhar VIP por 90 dias!</p>
          <div className="profile-ref-row">
            <input readOnly className="profile-ref-input" value={getReferralLink() || ''} />
            <button className="profile-ref-copy" onClick={copyRefLink}>
              {copied ? <FiCheck /> : <FiCopy />} {copied ? 'Copiado!' : 'Copiar'}
            </button>
          </div>
          <ul className="profile-vip-perks">
            <li>🎭 GIFs nos comentários</li>
            <li>💎 Badge VIP no perfil</li>
            <li>⭐ Destaque no ranking</li>
          </ul>
        </div>
      )}

      {(isVip || isAdmin) && (
        <div className="profile-vip-active">
          {isAdmin ? '⚡ Você é ADM' : '💎 Você é VIP'}
          {dbProfile?.vip_until && !isAdmin && (
            <span>Válido até {new Date(dbProfile.vip_until).toLocaleDateString('pt-BR')}</span>
          )}
        </div>
      )}

      {/* Conquistas */}
      <div className="profile-section">
        <h3 className="profile-section-title"><FiAward /> Conquistas</h3>
        <div className="profile-achievements">
          {Object.entries(ACHIEVEMENTS).map(([id, a]) => {
            const unlocked = getUnlocked().includes(id)
            return (
              <div key={id} className={`profile-ach ${unlocked ? 'unlocked' : 'locked'}`} title={a.desc}>
                <span className="ach-icon">{unlocked ? a.icon : '🔒'}</span>
                <span className="ach-name">{a.name}</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Botão resgatar código */}
      <button className="profile-resgate-btn" onClick={() => nav('/resgatar')}>
        <FiGift size={16} />
        🎁 Resgatar código de recompensa
      </button>

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
