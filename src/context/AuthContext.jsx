import { createContext, useContext, useState, useEffect } from 'react'

const AuthContext = createContext(null)

const GOOGLE_CLIENT_ID = '842758524960-b4pd55oqc6qsopgjeukin7r6q98td5tl.apps.googleusercontent.com'

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Carrega SDK do Google
    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.defer = true
    script.onload = () => {
      // Tenta restaurar sessão salva
      const saved = localStorage.getItem('upanime_user')
      if (saved) {
        try { setUser(JSON.parse(saved)) } catch { localStorage.removeItem('upanime_user') }
      }

      window.google?.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleCredential,
        auto_select: true,
      })
      setLoading(false)
    }
    document.head.appendChild(script)
    return () => document.head.removeChild(script)
  }, [])

  const handleCredential = (response) => {
    // Decodifica JWT do Google
    const payload = JSON.parse(atob(response.credential.split('.')[1]))
    const userData = {
      id: payload.sub,
      name: payload.name,
      email: payload.email,
      picture: payload.picture,
    }
    setUser(userData)
    localStorage.setItem('upanime_user', JSON.stringify(userData))
  }

  const login = () => {
    window.google?.accounts.id.prompt()
  }

  const logout = () => {
    window.google?.accounts.id.disableAutoSelect()
    setUser(null)
    localStorage.removeItem('upanime_user')
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
  
