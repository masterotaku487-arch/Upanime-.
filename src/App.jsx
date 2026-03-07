import { Routes, Route, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import { AuthProvider } from './context/AuthContext'
import { FavoritesProvider, useFavorites } from './context/FavoritesContext'
import Navbar from './components/Navbar'
import BottomNav from './components/BottomNav'
import Footer from './components/Footer'
import Home from './pages/Home'
import AnimePage from './pages/AnimePage'
import WatchPage from './pages/WatchPage'
import SearchPage from './pages/SearchPage'
import CategoryPage from './pages/CategoryPage'
import GenresPage from './pages/GenresPage'
import ExplorarPage from './pages/ExplorarPage'
import LegalPage from './pages/LegalPage'
import FavoritesPage from './pages/FavoritesPage'
import NoticiasPage from './pages/NoticiasPage'
import ConfigPage from './pages/ConfigPage'
import ApiStatusPage from './pages/ApiStatusPage'
import { checkNewEpisodes, notifEnabled } from './services/notifications'

// Checa novos eps dos favoritos (roda uma vez ao abrir o site)
function NotifChecker() {
  const { favorites } = useFavorites()
  useEffect(() => {
    if (!notifEnabled() || !favorites?.length) return
    const timer = setTimeout(() => checkNewEpisodes(favorites), 5000)
    return () => clearTimeout(timer)
  }, [favorites])
  return null
}

function AppInner() {
  const { pathname } = useLocation()
  const isWatch = pathname.startsWith('/watch/')
  return (
    <div className="app">
      {!isWatch && <Navbar />}
      <main>
        <Routes>
          <Route path="/"                  element={<Home />} />
          <Route path="/anime/:id"         element={<AnimePage />} />
          <Route path="/watch/:id"         element={<WatchPage />} />
          <Route path="/search"            element={<SearchPage />} />
          <Route path="/category/:type"    element={<CategoryPage />} />
          <Route path="/genres"            element={<GenresPage />} />
          <Route path="/genres/:genreId"   element={<CategoryPage />} />
          <Route path="/explorar"          element={<ExplorarPage />} />
          <Route path="/termos"            element={<LegalPage />} />
          <Route path="/privacidade"       element={<LegalPage />} />
          <Route path="/favoritos"         element={<FavoritesPage />} />
          <Route path="/novidades"         element={<NoticiasPage />} />
          <Route path="/config"            element={<ConfigPage />} />
          <Route path="/api-status"        element={<ApiStatusPage />} />
        </Routes>
      </main>
      {!isWatch && <BottomNav />}
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <FavoritesProvider>
        <NotifChecker />
        <AppInner />
      </FavoritesProvider>
    </AuthProvider>
  )
}
