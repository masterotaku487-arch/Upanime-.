import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { FiSearch, FiX, FiMenu, FiLogOut, FiUser, FiHeart } from 'react-icons/fi'
import { useAuth } from '../context/AuthContext'
import LoginModal from './LoginModal'
import './Navbar.css'

const navLinks = [
  { label: 'Início', path: '/' },
  { label: 'Em Alta', path: '/category/bypopularity' },
  { label: 'Lançamentos', path: '/category/airing' },
  { label: 'Filmes', path: '/category/movie' },
  { label: 'Gêneros', path: '/genres' },
]

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const [showLogin, setShowLogin] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const inputRef = useRef(null)
  const userMenuRef = useRef(null)
  const navigate = useNavigate()
  const location = useLocation()
  const { user, logout } = useAuth()

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    if (searchOpen) setTimeout(() => inputRef.current?.focus(), 100)
  }, [searchOpen])

  useEffect(() => {
    setMenuOpen(false)
    setSearchOpen(false)
  }, [location])

  // Fechar menu do usuário ao clicar fora
  useEffect(() => {
    const handler = (e) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setShowUserMenu(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
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
    <>
      <header className={`navbar ${scrolled ? 'scrolled' : ''}`}>
        <div className="navbar-inner container">
          <Link to="/" className="nav-logo">
            <img src="/logo.png" alt="Up Anime+" className="logo-img" />
            <span className="logo-text">UP <span>ANIME</span>+</span>
          </Link>

          <nav className={`nav-links ${menuOpen ? 'open' : ''}`}>
            {navLinks.map(l => (
              <Link
                key={l.path}
                to={l.path}
                className={`nav-link ${location.pathname === l.path ? 'active' : ''}`}
              >
                {l.label}
              </Link>
            ))}
          </nav>

          <div className="nav-actions">
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
              <button className="icon-btn" onClick={() => setSearchOpen(true)}>
                <FiSearch />
              </button>
            )}

            {/* Botão de login / avatar */}
            {user ? (
              <div className="user-menu-wrap" ref={userMenuRef}>
                <button
                  className="user-avatar-btn"
                  onClick={() => setShowUserMenu(o => !o)}
                  title={user.name}
                >
                  <img src={user.picture} alt={user.name} className="user-avatar" />
                </button>
                {showUserMenu && (
                  <div className="user-dropdown">
                    <div className="user-dropdown-info">
                      <img src={user.picture} alt={user.name} />
                      <div>
                        <strong>{user.name}</strong>
                        <span>{user.email}</span>
                      </div>
                    </div>
                    <Link to="/favoritos" className="user-dropdown-item" onClick={() => setShowUserMenu(false)}>
                      <FiHeart /> Meus Favoritos
                    </Link>
                    <button className="user-dropdown-item" onClick={() => { logout(); setShowUserMenu(false) }}>
                      <FiLogOut /> Sair
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <button className="login-btn" onClick={() => setShowLogin(true)}>
                <FiUser /> Entrar
              </button>
            )}

            <button className="icon-btn mobile-menu" onClick={() => setMenuOpen(o => !o)}>
              {menuOpen ? <FiX /> : <FiMenu />}
            </button>
          </div>
        </div>
      </header>

      {showLogin && <LoginModal onClose={() => setShowLogin(false)} />}
    </>
  )
  }

