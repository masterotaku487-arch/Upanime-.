import { useState, useRef, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { FiSearch, FiX, FiUser, FiBell } from 'react-icons/fi'
import { useAuth } from '../context/AuthContext'
import { getUnreadCount } from '../services/notifications'
import './Navbar.css'

export default function Navbar() {
  const [searchOpen, setSearchOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [unread, setUnread] = useState(0)
  const inputRef = useRef(null)
  const navigate = useNavigate()
  const { user } = useAuth()

  useEffect(() => {
    if (searchOpen) setTimeout(() => inputRef.current?.focus(), 100)
  }, [searchOpen])

  useEffect(() => {
    setUnread(getUnreadCount())
    // Recalcula quando a aba volta a ficar visível (ex: voltando da tela de notificações)
    const onFocus = () => setUnread(getUnreadCount())
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onFocus)
    return () => {
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onFocus)
    }
  }, [])

  const handleSearch = (e) => {
    e.preventDefault()
    if (query.trim()) {
      navigate(`/search?q=${encodeURIComponent(query.trim())}`)
      setSearchOpen(false)
      setQuery('')
    }
  }

  return (
    <header className="navbar">
      <div className="navbar-inner">
        <Link to="/" className="nav-logo">
          <img src="/logo.png" alt="Up Anime+" className="logo-img" />
          <span className="logo-text">UP <span>ANIME</span>+</span>
        </Link>

        {searchOpen ? (
          <form className="search-bar" onSubmit={handleSearch}>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Buscar anime..."
            />
            <button type="submit"><FiSearch /></button>
            <button type="button" onClick={() => setSearchOpen(false)}><FiX /></button>
          </form>
        ) : (
          <div className="nav-actions">
            <button className="icon-btn" onClick={() => setSearchOpen(true)}>
              <FiSearch />
            </button>
            <Link to="/notificacoes" className="icon-btn notif-btn">
              <FiBell />
              {unread > 0 && <span className="notif-count">{unread > 9 ? '9+' : unread}</span>}
            </Link>
            <Link to="/config" className="icon-btn profile-btn">
              {user?.avatar ? (
                <img src={user.avatar} alt={user.name || 'Perfil'} className="profile-avatar" />
              ) : (
                <FiUser />
              )}
            </Link>
          </div>
        )}
      </div>
    </header>
  )
}
