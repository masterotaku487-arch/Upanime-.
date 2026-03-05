import { Link, useLocation } from 'react-router-dom'
import { FiHome, FiCompass, FiHeart, FiCalendar, FiSettings } from 'react-icons/fi'
import { useAuth } from '../context/AuthContext'
import './BottomNav.css'

const items = [
  { label: 'Home',      path: '/',          icon: FiHome },
  { label: 'Explorar',  path: '/genres',    icon: FiCompass },
  { label: 'Favoritos', path: '/favoritos', icon: FiHeart },
  { label: 'Novidades', path: '/novidades', icon: FiCalendar },
  { label: 'Config',    path: '/config',    icon: FiSettings },
]

export default function BottomNav() {
  const { pathname } = useLocation()

  return (
    <nav className="bottom-nav">
      {items.map(({ label, path, icon: Icon }) => {
        const active = pathname === path || (path !== '/' && pathname.startsWith(path))
        return (
          <Link key={path} to={path} className={`bnav-item ${active ? 'active' : ''}`}>
            <Icon size={22} />
            <span>{label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
