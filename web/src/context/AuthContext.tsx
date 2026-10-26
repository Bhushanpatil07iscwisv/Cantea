import React, { createContext, useContext, useEffect, useState } from 'react'
import { api, setStoredToken } from '../api'
import type { Canteen, User } from '../types'

interface AuthContextType {
  user: User | null
  token: string | null
  canteens: Canteen[]
  selectedCanteen: Canteen | null
  isLoading: boolean
  error: string | null
  login: (email: string, password: string) => Promise<User>
  register: (name: string, email: string, password: string, canteen_id: string) => Promise<User>
  logout: () => Promise<void>
  deleteAccount: () => Promise<void>
  refreshUser: () => Promise<void>
  setSelectedCanteen: (canteen: Canteen | null) => void
  clearError: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('cantea_token'))
  const [canteens, setCanteens] = useState<Canteen[]>([])
  const [selectedCanteen, setSelectedCanteen] = useState<Canteen | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  // Load canteens on startup
  useEffect(() => {
    api.fetchCanteens()
      .then((data) => {
        setCanteens(data)
        if (data.length > 0) {
          const savedCanteenId = localStorage.getItem('cantea_canteen_id')
          const found = data.find((c) => c.id === savedCanteenId) || data[0]
          setSelectedCanteen(found)
        }
      })
      .catch((err) => console.error('Failed to load canteens:', err))
  }, [])

  // Sync selected canteen to localStorage
  useEffect(() => {
    if (selectedCanteen) {
      localStorage.setItem('cantea_canteen_id', selectedCanteen.id)
    }
  }, [selectedCanteen])

  // Check auth session
  useEffect(() => {
    if (token) {
      api.getMe()
        .then((userData) => {
          setUser(userData)
        })
        .catch(() => {
          // Token expired or invalid
          setToken(null)
          setStoredToken(null)
          setUser(null)
        })
        .finally(() => setIsLoading(false))
    } else {
      setIsLoading(false)
    }
  }, [token])

  const login = async (email: string, password: string) => {
    setError(null)
    try {
      const res = await api.login({ email, password })
      setToken(res.token)
      setStoredToken(res.token)
      setUser(res.user)
      if (res.user.canteen_id && canteens.length > 0) {
        const found = canteens.find((c) => c.id === res.user.canteen_id)
        if (found) setSelectedCanteen(found)
      }
      return res.user
    } catch (err: any) {
      const msg = err.message || 'Login failed'
      setError(msg)
      throw err
    }
  }

  const register = async (name: string, email: string, password: string, canteen_id: string) => {
    setError(null)
    try {
      const res = await api.register({ name, email, password, canteen_id })
      setToken(res.token)
      setStoredToken(res.token)
      setUser(res.user)
      return res.user
    } catch (err: any) {
      const msg = err.message || 'Registration failed'
      setError(msg)
      throw err
    }
  }

  const logout = async () => {
    try {
      await api.logout()
    } catch {
      // Ignore network errors on logout
    } finally {
      setUser(null)
      setToken(null)
      setStoredToken(null)
    }
  }

  const deleteAccount = async () => {
    await api.deleteMe()
    setUser(null)
    setToken(null)
    setStoredToken(null)
  }

  const refreshUser = async () => {
    if (!token) return
    const userData = await api.getMe()
    setUser(userData)
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        canteens,
        selectedCanteen,
        isLoading,
        error,
        login,
        register,
        logout,
        deleteAccount,
        refreshUser,
        setSelectedCanteen,
        clearError: () => setError(null),
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within an AuthProvider')
  return context
}
