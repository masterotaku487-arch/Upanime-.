import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { useAuth } from './AuthContext'

const FavoritesContext = createContext(null)

export function FavoritesProvider({ children }) {
  const { user } = useAuth()
  const [favorites, setFavorites] = useState([])

  const storageKey = user ? `upanime_favs_${user.id}` : null

  useEffect(() => {
    if (!storageKey) { setFavorites([]); return }
    try {
      const saved = localStorage.getItem(storageKey)
      setFavorites(saved ? JSON.parse(saved) : [])
    } catch { setFavorites([]) }
  }, [storageKey])

  const toggle = useCallback((anime) => {
    if (!user) return false
    setFavorites(prev => {
      const exists = prev.some(f => f.mal_id === anime.mal_id)
      const next = exists
        ? prev.filter(f => f.mal_id !== anime.mal_id)
        : [...prev, {
            mal_id: anime.mal_id,
            title: anime.title_english || anime.title,
            image: anime.images?.jpg?.large_image_url || anime.images?.jpg?.image_url,
            score: anime.score,
            type: anime.type,
            episodes: anime.episodes,
            status: anime.status,
            addedAt: Date.now(),
          }]
      if (storageKey) localStorage.setItem(storageKey, JSON.stringify(next))
      return next
    })
    return true
  }, [user, storageKey])

  const isFav = useCallback((malId) => favorites.some(f => f.mal_id === malId), [favorites])

  return (
    <FavoritesContext.Provider value={{ favorites, toggle, isFav }}>
      {children}
    </FavoritesContext.Provider>
  )
}

export const useFavorites = () => useContext(FavoritesContext)
