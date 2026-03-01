import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { FiSearch, FiX, FiMenu } from 'react-icons/fi'
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
  const inputRef = useRef(null)
  const navigate = useNavigate()
  const location = useLocation()

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

  const handleSearch = (e) => {
    e.preventDefault()
    if (query.trim()) {
      navigate(`/search?q=${encodeURIComponent(query.trim())}`)
      setSearchOpen(false)
      setQuery('')
    }
  }

  return (
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
          <button className="icon-btn mobile-menu" onClick={() => setMenuOpen(o => !o)}>
            {menuOpen ? <FiX /> : <FiMenu />}
          </button>
        </div>
      </div>
    </header>
  )
}
