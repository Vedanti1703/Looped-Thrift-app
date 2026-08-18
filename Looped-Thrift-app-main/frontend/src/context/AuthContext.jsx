import { createContext, useContext, useState, useEffect } from 'react'
import api from '../services/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null)
  const [token, setToken]     = useState(() => localStorage.getItem('looped_token'))
  const [loading, setLoading] = useState(true)

  // On mount, fetch profile if token exists
  useEffect(() => {
    if (token) {
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`
      api.get('/user/profile')
        .then(r => setUser(r.data))
        .catch(() => logout())
        .finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [token])

  const login = (tokenVal, userData) => {
    localStorage.setItem('looped_token', tokenVal)
    api.defaults.headers.common['Authorization'] = `Bearer ${tokenVal}`
    setToken(tokenVal)
    setUser(userData)
  }

  const logout = () => {
    localStorage.removeItem('looped_token')
    delete api.defaults.headers.common['Authorization']
    setToken(null)
    setUser(null)
  }

  // Refresh user profile (after like, upload, etc.)
  const refreshUser = async () => {
    try {
      const r = await api.get('/user/profile')
      setUser(r.data)
    } catch {}
  }

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
