import { Routes, Route, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
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
import SobrePage from './pages/SobrePage'
import AchievementsPage from './pages/AchievementsPage'
import ProfilePage from './pages/ProfilePage'
import FeedbackModal from './components/FeedbackModal'
import { checkNewEpisodes, notifEnabled } from './services/notifications'
import { loadAchievements, saveAchievements } from './services/achievements'
import { FiAlertTriangle } from "react-icons/fi"
import './App.css'

function NotifChecker() {
  const { favorites } = useFavorites()
  useEffect(() => {
    if (!notifEnabled() || !favorites?.length) return
    const timer = setTimeout(() => checkNewEpisodes(favorites), 5000)
    return () => clearTimeout(timer)
  }, [favorites])
  return null
}

function BetaAchievement() {
  useEffect(() => {
    const ach = loadAchievements()
    if (!ach.unlocked.includes('beta_tester')) {
      ach.unlocked.push('beta_tester')
      ach.seenAt['beta_tester'] = Date.now()
      saveAchievements(ach)
    }
  }, [])
  return null
}

function AppInner() {
  const { pathname } = useLocation()
  const isWatch = pathname.startsWith('/watch/')
  const [showFeedback, setShowFeedback] = useState(false)

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
          <Route path="/sobre"             element={<SobrePage />} />
          <Route path="/conquistas"        element={<AchievementsPage />} />
          <Route path="/perfil"            element={<ProfilePage />} />
        </Routes>
      </main>
      {!isWatch && <BottomNav />}

      {/* Botão flutuante de feedback */}
      <button
        className="fab-feedback"
        onClick={() => setShowFeedback(true)}
        title="Relatar bug ou enviar feedback"
      >
        <FiAlertTriangle size={18} />
        <span>Feedback</span>
      </button>

      {showFeedback && (
        <FeedbackModal onClose={() => setShowFeedback(false)} />
      )}
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <FavoritesProvider>
        <NotifChecker />
        <BetaAchievement />
        <AppInner />
      </FavoritesProvider>
    </AuthProvider>
  )
}
