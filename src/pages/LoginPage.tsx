import React from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import LoginForm from '../components/LoginForm'

const LoginPage: React.FC = () => {
  const { user, loading } = useAuth()

  if (loading) {
    return <div className="loading">Загрузка...</div>
  }

  if (user) {
    return <Navigate to="/rooms" replace />
  }

  return <LoginForm />
}

export default LoginPage
