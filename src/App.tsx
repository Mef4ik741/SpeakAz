import React from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import Layout from './components/Layout'
import LoginPage from './pages/LoginPage'
import RoomsPage from './pages/RoomsPage'
import CreateRoomPage from './pages/CreateRoomPage'
import JoinRoomPage from './pages/JoinRoomPage'
import RoomPage from './pages/RoomPage'
import ApiTestPage from './pages/ApiTestPage'
import ServerPage from './pages/ServerPage'
import ProtectedRoute from './components/ProtectedRoute'
import './App.css'

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route 
            path="/" 
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/rooms" replace />} />
            <Route path="rooms" element={<RoomsPage />} />
            <Route path="create" element={<CreateRoomPage />} />
            <Route path="join" element={<JoinRoomPage />} />
            <Route path="room/:roomKey" element={<RoomPage />} />
            <Route path="api-test" element={<ApiTestPage />} />
            <Route path="server" element={<ServerPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  )
}

export default App
