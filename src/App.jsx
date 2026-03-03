import { Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar'
import Footer from './components/Footer'
import Home from './pages/Home'
import AnimePage from './pages/AnimePage'
import WatchPage from './pages/WatchPage'
import SearchPage from './pages/SearchPage'
import CategoryPage from './pages/CategoryPage'
import GenresPage from './pages/GenresPage'
import LegalPage from './pages/LegalPage'

export default function App() {
  return (
    <div className="app">
      <Navbar />
      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/anime/:id" element={<AnimePage />} />
          <Route path="/watch/:id" element={<WatchPage />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/category/:type" element={<CategoryPage />} />
          <Route path="/genres" element={<GenresPage />} />
          <Route path="/genres/:genreId" element={<CategoryPage />} />
          <Route path="/termos" element={<LegalPage />} />
          <Route path="/privacidade" element={<LegalPage />} />
        </Routes>
      </main>
      <Footer />
    </div>
  )
}
