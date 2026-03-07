import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { useFavorites } from '../context/FavoritesContext'
import { Link } from 'react-router-dom'
import {
  FiHeart, FiLogOut, FiUser, FiInfo, FiShield, FiBell,
  FiExternalLink, FiClock, FiTrash2, FiActivity, FiAward,
} from 'react-icons/fi'
import { getHistory, clearHistory, getEpProgress } from '../services/history'
import { loadAchievements, ACHIEVEMENTS } from '../services/achievements'
import { requestNotifPermission } from '../services/notifications'
import './ConfigPage.css'

export default function ConfigPage() {
  const { user, logout, openLogin } = useAuth()
  const { favorites } = useFavorites()
  const [notif,    setNotif]    = useState(() => localStorage.getItem('upanime_notif') === '1')
  const [history,  setHistory]  = useState([])
  const [showHist, setShowHist] = useState(false)
  const [achCount, setAchCount] = useState(0)

  useEffect(() => {
    setHistory(getHistory())
    const ach = loadAchievements()
    setAchCount(ach.unlocked?.length || 0)
  }, [])

  const toggleNotif = async () => {
    if (!notif) {
      const granted = await requestNotifPermission()
      if (!granted) {
        alert('Permissão negada. Ative nas configurações do navegador.')
        return
      }
    }
    const next = !notif
    setNotif(next)
    localStorage.setItem('upanime_notif', next ? '1' : '0')
  }

  const handleClearHistory = () => {
    if (!confirm('Limpar todo o histórico?')) return
    clearHistory()
    setHistory([])
  }

  return (
    <div className="config-page container">

      {/* Perfil */}
      <div className="config-profile">
        {user ? (
          <>
            <img src={user.picture} alt={user.name} className="config-avatar" />
            <div>
              <h2 className="config-name">{user.name}</h2>
              <p className="config-email">{user.email}</p>
            </div>
          </>
        ) : (
          <>
            <div className="config-avatar-placeholder"><FiUser size={32} /></div>
            <div>
              <h2 className="config-name">Visitante</h2>
              <button className="btn btn-primary" style={{ marginTop: 8 }} onClick={openLogin}>
                Entrar com Google
              </button>
            </div>
          </>
        )}
      </div>

      {/* Stats */}
      <div className="config-stats">
        <div className="stat-card">
          <span className="stat-num">{favorites.length}</span>
          <span className="stat-label">Favoritos</span>
        </div>
        <div className="stat-card">
          <span className="stat-num">{history.length}</span>
          <span className="stat-label">Assistidos</span>
        </div>
        <div className="stat-card">
          <span className="stat-num">{achCount}/{ACHIEVEMENTS.length}</span>
          <span className="stat-label">Conquistas</span>
        </div>
      </div>

      {/* Histórico de assistidos */}
      {history.length > 0 && (
        <div className="config-section">
          <div className="config-section-header" onClick={() => setShowHist(o => !o)}>
            <span><FiClock size={15} /> Histórico de Assistidos</span>
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <span className="config-badge">{history.length}</span>
              <button
                className="config-clear-btn"
                onClick={e => { e.stopPropagation(); handleClearHistory() }}
                title="Limpar histórico"
              >
                <FiTrash2 size={14} />
              </button>
              <span>{showHist ? '▲' : '▼'}</span>
            </div>
          </div>

          {showHist && (
            <div className="history-list">
              {history.map(entry => {
                const pct  = getEpProgress(entry.mal_id, entry.lastEp) ?? 0
                const date = new Date(entry.watchedAt).toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit' })
                return (
                  <Link key={entry.mal_id} to={`/watch/${entry.mal_id}?ep=${entry.lastEp}`} className="history-item">
                    <div className="history-thumb">
                      {entry.image && <img src={entry.image} alt={entry.title} loading="lazy" />}
                    </div>
                    <div className="history-info">
                      <span className="history-title">{entry.title}</span>
                      <span className="history-ep">EP {entry.lastEp} • {date}</span>
                      <div className="history-bar">
                        <div className="history-fill" style={{ width:`${pct}%` }} />
                      </div>
                    </div>
                    <span className="history-pct">{pct}%</span>
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Menu */}
      <div className="config-menu">
        {user && (
          <Link to="/favoritos" className="config-item">
            <FiHeart /> Meus Favoritos
            {favorites.length > 0 && <span className="config-badge">{favorites.length}</span>}
          </Link>
        )}

        <Link to="/conquistas" className="config-item">
          <FiAward /> Minhas Conquistas
          {achCount > 0 && <span className="config-badge">{achCount}</span>}
        </Link>

        <button className="config-item" onClick={toggleNotif}>
          <FiBell /> Notificações de Novos EPs
          <div className={`config-toggle ${notif ? 'on' : ''}`} />
        </button>

        <Link to="/api-status" className="config-item config-item-status">
          <FiActivity /> Status dos Serviços
          <span className="config-status-indicator" />
        </Link>

        <Link to="/termos" className="config-item"><FiInfo /> Termos de Uso</Link>
        <Link to="/privacidade" className="config-item"><FiShield /> Política de Privacidade</Link>
        <Link to="/sobre" className="config-item">
          <FiExternalLink /> Sobre o Up Anime+
        </Link>

        {user && (
          <button className="config-item config-logout" onClick={logout}>
            <FiLogOut /> Sair da conta
          </button>
        )}
      </div>

      <p className="config-version">Up Anime+ v2.0.0</p>
    </div>
  )
                                                                          }
