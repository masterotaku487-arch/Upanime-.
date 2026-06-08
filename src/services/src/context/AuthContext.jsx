// src/context/AuthContext.jsx
import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { getProfile, upsertProfile } from '../services/supabase'

const AuthContext = createContext(null)
const GOOGLE_CLIENT_ID = '842758524960-b4pd55oqc6qsopgjeukin7r6q98td5tl.apps.googleusercontent.com'
const STORAGE_KEY = 'upanime_user'
const GUEST_KEY   = 'upanime_guest'

function genId() {
  return 'guest_' + Math.random().toString(36).slice(2) + Date.now().toString(36)
}

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [showGuestModal, setShowGuestModal] = useState(false)

  const syncProfile = useCallback(async (userData) => {
    try {
      if (!userData.is_guest) {
        // Busca perfil existente para pegar is_vip, is_admin etc
        const existing = await getProfile(userData.id)
        if (existing) {
          const merged = { ...userData, ...existing, name: userData.name, avatar: userData.picture || existing.avatar }
          setUser(merged)
          localStorage.setItem(STORAGE_KEY, JSON.stringify(merged))
          return merged
        }
      }
      // Upsert perfil
      await upsertProfile({
        id:       userData.id,
        name:     userData.name,
        avatar:   userData.picture || userData.avatar || '',
        is_guest: userData.is_guest || false,
        is_vip:   userData.is_vip   || false,
        is_admin: userData.is_admin || false,
        referral_code: userData.referral_code || userData.id.slice(0, 8),
      })
    } catch (e) {
      console.warn('[Auth] sync error:', e.message)
    }
    return userData
  }, [])

  useEffect(() => {
    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.defer = true
    script.onload = () => {
      // Restaura sessão salva
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        try {
          const u = JSON.parse(saved)
          setUser(u)
          // Resync para pegar is_vip atualizado
          syncProfile(u).then(updated => { if (updated) setUser(updated) })
        } catch { localStorage.removeItem(STORAGE_KEY) }
      } else {
        // Verifica se tem guest salvo
        const guest = localStorage.getItem(GUEST_KEY)
        if (guest) {
          try { setUser(JSON.parse(guest)) } catch {}
        }
      }

      window.google?.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleCredential,
        auto_select: true,
      })
      setLoading(false)
    }
    script.onerror = () => setLoading(false)
    document.head.appendChild(script)
    return () => document.head.removeChild(script)
  }, [])

  const handleCredential = async (response) => {
    const payload  = JSON.parse(atob(response.credential.split('.')[1]))
    const userData = {
      id:       payload.sub,
      name:     payload.name,
      email:    payload.email,
      picture:  payload.picture,
      avatar:   payload.picture,
      is_guest: false,
      is_vip:   false,
      is_admin: false,
      referral_code: payload.sub.slice(0, 8),
    }
    localStorage.removeItem(GUEST_KEY)
    setUser(userData)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(userData))
    const synced = await syncProfile(userData)
    setUser(synced)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(synced))
  }

  const login = () => window.google?.accounts.id.prompt()

  const loginAsGuest = async (name, avatarUrl = '') => {
    const existing = localStorage.getItem(GUEST_KEY)
    let guestId
    if (existing) {
      try { guestId = JSON.parse(existing).id } catch {}
    }
    if (!guestId) guestId = genId()

    const guestData = {
      id:           guestId,
      name:         name.slice(0, 50),
      picture:      avatarUrl,
      avatar:       avatarUrl,
      is_guest:     true,
      is_vip:       false,
      is_admin:     false,
      referral_code: guestId.slice(0, 8),
    }
    setUser(guestData)
    localStorage.setItem(GUEST_KEY, JSON.stringify(guestData))
    await syncProfile(guestData)
    setShowGuestModal(false)
  }

  const logout = () => {
    window.google?.accounts.id.disableAutoSelect()
    setUser(null)
    localStorage.removeItem(STORAGE_KEY)
    localStorage.removeItem(GUEST_KEY)
  }

  const promptGuest = () => setShowGuestModal(true)
  const closeGuestModal = () => setShowGuestModal(false)

  return (
    <AuthContext.Provider value={{
      user, loading,
      login, logout,
      loginAsGuest, promptGuest, closeGuestModal, showGuestModal,
      isVip:   user?.is_vip   || false,
      isAdmin: user?.is_admin || false,
      isGuest: user?.is_guest || false,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
