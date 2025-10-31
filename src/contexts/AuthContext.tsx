import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { User } from '../types/Room'
import roomWebSocketService from '../services/RoomWebSocketService'

interface AuthContextType {
  user: User | null
  login: (username: string, password: string) => Promise<void>
  register: (username: string, password: string, confirmPassword: string) => Promise<void>
  logout: () => void
  loading: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    console.error('useAuth called outside of AuthProvider. Make sure the component is wrapped with AuthProvider.')
    console.error('Current component stack:', new Error().stack)
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

interface AuthProviderProps {
  children: ReactNode
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('token')
    const userData = localStorage.getItem('user')
    
    if (token && userData) {
      try {
        const parsedUser = JSON.parse(userData)
        setUser({ ...parsedUser, token })
      } catch (error) {
        localStorage.removeItem('token')
        localStorage.removeItem('user')
      }
    }
    setLoading(false)
  }, [])

  const login = async (username: string, password: string) => {
    try {
      const response = await fetch(`${import.meta.env.REACT_APP_API_URL || 'https://leola-unengraven-gristly.ngrok-free.dev'}/api/auth/LoginByUsername`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true'
        },
        body: JSON.stringify({ username, password }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || 'Ошибка входа')
      }

      const data = await response.json()
      
      if (data.isSuccess && data.data) {
        const userData = {
          id: data.data.userId || data.data.id,
          username: data.data.username,
          token: data.data.accessToken
        }
        
        localStorage.setItem('token', data.data.accessToken)
        localStorage.setItem('user', JSON.stringify(userData))
        setUser(userData)
        
        // Переподключаем WebSocket после успешного логина
        console.log('AuthContext: User logged in, reconnecting WebSocket');
        roomWebSocketService.reconnect();
      } else {
        throw new Error(data.message || 'Ошибка входа')
      }
    } catch (error) {
      console.error('Login error:', error)
      throw error
    }
  }

  const register = async (username: string, password: string, confirmPassword: string) => {
    try {
      const response = await fetch(`${import.meta.env.REACT_APP_API_URL || 'https://leola-unengraven-gristly.ngrok-free.dev'}/api/account/register`, {
        method: 'PO ST',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true'
        },
        body: JSON.stringify({ username, password, confirmPassword }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || 'Ошибка регистрации')
      }

      const data = await response.json()
      
      if (data.isSuccess) {
        // После успешной регистрации автоматически входим
        await login(username, password)
      } else {
        throw new Error(data.message || 'Ошибка регистрации')
      }
    } catch (error) {
      console.error('Register error:', error)
      throw error
    }
  }

  const logout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    setUser(null)
  }

  const value = {
    user,
    login,
    register,
    logout,
    loading
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}
