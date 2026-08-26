import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { useFavorites } from '../context/FavoritesContext'
import { Link } from 'react-router-dom'
import {
  FiUser, FiCreditCard, FiBell, FiHeadphones, FiDownload,
  FiHelpCircle, FiLogOut, FiInfo, FiShield, FiActivity, FiAward,
  FiHeart, FiClock, FiTrash2, FiChevronRight, FiExternalLink,
} from 'react-icons/fi'
import { getHistory, clearHistory, getEpProgress } from '../services/history'
import { loadAchievements, ACHIEVEMENTS } from '../services/achievements'
import { requestNotifPermission } from '../services/notifications'
import './ConfigPage.css'

export default function ConfigPage() {
  const { user, logout, openLogin, isVip } = useAuth()
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
    <div className="config-page">

      {/* ── Cabeçalho do perfil ─────────────────────────────── */}
      <div className="profile-header">
        {user ? (
          <img src={user.avatar || user.picture} alt={user.name} className="avatar avatar-img" />
        ) : (
          <div className="avatar"><FiUser size={30} /></div>
        )}
        <div className="profile-name">{user ? user.name : 'Visitante'}</div>
        {user ? (
          <div className="profile-plan">{isVip ? '💎 Upanime+ VIP' : '🎌 Otaku'}</div>
        ) : (
          <button className="btn btn-primary" style={{ marginTop: 10 }} onClick={openLogin}>
            Entrar com Google
          </button>
        )}

        {user && (
          <div className="stats-row">
            <div className="stat"><b>{history.length}</b><span>Assistidos</span></div>
            <div className="stat"><b>{favorites.length}</b><span>Na Lista</span></div>
            <div className="stat"><b>{achCount}/{ACHIEVEMENTS.length}</b><span>Conquistas</span></div>
          </div>
        )}
      </div>

      {/* ── Histórico de assistidos ─────────────────────────── */}
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

      {/* ── Menu agrupado (estilo do mockup) ────────────────── */}
      <div className="menu-list">

        <div className="menu-section-title">Conta</div>

        <Link to="/perfil" className="menu-item">
          <div className="menu-ic"><FiUser /></div>
          <div className="menu-label">Editar Perfil</div>
          <FiChevronRight className="chev" />
        </Link>

        <div className="menu-item menu-item-soon">
          <div className="menu-ic"><FiCreditCard /></div>
          <div className="menu-label">Assinatura e VIP</div>
          <span className="menu-soon-tag">Em breve</span>
        </div>

        <button className="menu-item" onClick={toggleNotif}>
          <div className="menu-ic"><FiBell /></div>
          <div className="menu-label">Notificações de Novos EPs</div>
          <div className={`config-toggle ${notif ? 'on' : ''}`} />
        </button>

        <div className="menu-section-title">Preferências</div>

        <Link to="/perfil" className="menu-item">
          <div className="menu-ic"><FiHeadphones /></div>
          <div className="menu-label">Idioma de Áudio e Legenda</div>
          <FiChevronRight className="chev" />
        </Link>

        <Link to="/downloads" className="menu-item">
          <div className="menu-ic"><FiDownload /></div>
          <div className="menu-label">Download e Armazenamento</div>
          <FiChevronRight className="chev" />
        </Link>

        <div className="menu-section-title">Outros</div>

        {user && (
          <Link to="/favoritos" className="menu-item">
            <div className="menu-ic"><FiHeart /></div>
            <div className="menu-label">Meus Favoritos</div>
            {favorites.length > 0 && <span className="config-badge">{favorites.length}</span>}
            <FiChevronRight className="chev" />
          </Link>
        )}

        <Link to="/conquistas" className="menu-item">
          <div className="menu-ic"><FiAward /></div>
          <div className="menu-label">Minhas Conquistas</div>
          {achCount > 0 && <span className="config-badge">{achCount}</span>}
          <FiChevronRight className="chev" />
        </Link>

        <Link to="/api-status" className="menu-item">
          <div className="menu-ic"><FiActivity /></div>
          <div className="menu-label">Status dos Serviços</div>
          <span className="config-status-indicator" />
        </Link>

        <div className="menu-item menu-item-soon">
          <div className="menu-ic"><FiHelpCircle /></div>
          <div className="menu-label">Ajuda e Suporte</div>
          <span className="menu-soon-tag">Em breve</span>
        </div>

        <Link to="/termos" className="menu-item">
          <div className="menu-ic"><FiInfo /></div>
          <div className="menu-label">Termos de Uso</div>
          <FiChevronRight className="chev" />
        </Link>

        <Link to="/privacidade" className="menu-item">
          <div className="menu-ic"><FiShield /></div>
          <div className="menu-label">Política de Privacidade</div>
          <FiChevronRight className="chev" />
        </Link>

        <Link to="/sobre" className="menu-item">
          <div className="menu-ic"><FiExternalLink /></div>
          <div className="menu-label">Sobre o Up Anime+</div>
          <FiChevronRight className="chev" />
        </Link>

        {user && (
          <button className="menu-item menu-item-danger" onClick={logout}>
            <div className="menu-ic menu-ic-danger"><FiLogOut /></div>
            <div className="menu-label">Sair da Conta</div>
          </button>
        )}
      </div>

      <p className="config-version">Up Anime+ v2.0.0</p>
    </div>
  )
}
