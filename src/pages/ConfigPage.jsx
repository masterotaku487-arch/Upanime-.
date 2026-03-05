import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useFavorites } from '../context/FavoritesContext'
import { Link } from 'react-router-dom'
import { FiHeart, FiLogOut, FiUser, FiInfo, FiShield, FiBell, FiExternalLink } from 'react-icons/fi'
import './ConfigPage.css'

export default function ConfigPage() {
  const { user, logout, openLogin } = useAuth()
  const { favorites } = useFavorites()
  const [notif, setNotif] = useState(
    () => localStorage.getItem('upanime_notif') === '1'
  )

  const toggleNotif = () => {
    const next = !notif
    setNotif(next)
    localStorage.setItem('upanime_notif', next ? '1' : '0')
  }

  const watchedCount = Object.keys(localStorage).filter(k => k.startsWith('progress_')).length

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
      {user && (
        <div className="config-stats">
          <div className="stat-card">
            <span className="stat-num">{favorites.length}</span>
            <span className="stat-label">Favoritos</span>
          </div>
          <div className="stat-card">
            <span className="stat-num">{watchedCount}</span>
            <span className="stat-label">Episódios</span>
          </div>
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

        <button className="config-item" onClick={toggleNotif}>
          <FiBell /> Notificações
          <div className={`config-toggle ${notif ? 'on' : ''}`} />
        </button>

        <Link to="/termos" className="config-item">
          <FiInfo /> Termos de Uso
        </Link>

        <Link to="/privacidade" className="config-item">
          <FiShield /> Política de Privacidade
        </Link>

        <a href="https://upanime-nine.vercel.app" target="_blank" rel="noreferrer" className="config-item">
          <FiExternalLink /> Sobre o Up Anime+
        </a>

        {user && (
          <button className="config-item config-logout" onClick={logout}>
            <FiLogOut /> Sair da conta
          </button>
        )}
      </div>

      <p className="config-version">Up Anime+ v1.0.0</p>
    </div>
  )
}
