import React, { useState, useEffect } from 'react'
import { Server, Settings, Code, Database, Play, Square, Users, Wifi, Clock, Activity } from 'lucide-react'
import { p2pAPI } from '../services/api'
import { P2PRoom, CreateP2PRoomRequest, P2PServerStatus } from '../types/P2P'

const ServerPage: React.FC = () => {
  const [myP2PRooms, setMyP2PRooms] = useState<P2PRoom[]>([])
  const [activeServers, setActiveServers] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [createForm, setCreateForm] = useState<CreateP2PRoomRequest>({
    name: '',
    serverPort: 8080,
    maxParticipants: 10,
    requirePassword: false,
    password: '',
    description: ''
  })

  useEffect(() => {
    loadData()
    const interval = setInterval(loadData, 5000) // Обновляем каждые 5 секунд
    return () => clearInterval(interval)
  }, [])

  const loadData = async () => {
    try {
      const [roomsResponse, serversResponse] = await Promise.all([
        p2pAPI.getMyP2PRooms(),
        p2pAPI.getActiveP2PServers()
      ])
      
      setMyP2PRooms(roomsResponse.rooms || [])
      setActiveServers(serversResponse.activeServers || [])
    } catch (err: any) {
      console.error('Ошибка загрузки данных:', err)
      setError(err.response?.data?.message || 'Ошибка загрузки данных')
    }
  }

  const handleCreateP2PRoom = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const response = await p2pAPI.createP2PRoom(createForm)
      console.log('P2P комната создана:', response)
      
      // Сбрасываем форму
      setCreateForm({
        name: '',
        serverPort: 8080,
        maxParticipants: 10,
        requirePassword: false,
        password: '',
        description: ''
      })
      setShowCreateForm(false)
      
      // Обновляем список комнат
      await loadData()
    } catch (err: any) {
      console.error('Ошибка создания P2P комнаты:', err)
      setError(err.response?.data?.message || 'Ошибка создания комнаты')
    } finally {
      setLoading(false)
    }
  }

  const handleStartServer = async (roomKey: string, port: number) => {
    setLoading(true)
    try {
      await p2pAPI.startP2PServer(roomKey, port)
      await loadData()
    } catch (err: any) {
      setError(err.response?.data?.message || 'Ошибка запуска сервера')
    } finally {
      setLoading(false)
    }
  }

  const handleStopServer = async (roomKey: string) => {
    setLoading(true)
    try {
      await p2pAPI.stopP2PServer(roomKey)
      await loadData()
    } catch (err: any) {
      setError(err.response?.data?.message || 'Ошибка остановки сервера')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteRoom = async (roomKey: string) => {
    if (!confirm('Вы уверены, что хотите удалить эту P2P комнату?')) return
    
    setLoading(true)
    try {
      await p2pAPI.deleteP2PRoom(roomKey)
      await loadData()
    } catch (err: any) {
      setError(err.response?.data?.message || 'Ошибка удаления комнаты')
    } finally {
      setLoading(false)
    }
  }

  const isServerRunning = (roomKey: string) => activeServers.includes(roomKey)

  return (
    <div className="server-page">
      <div className="server-container">
        <div className="server-header">
          <Server size={64} className="server-icon" />
          <h1>P2P Сервер управление</h1>
          <p className="server-subtitle">Создавайте и управляйте P2P комнатами</p>
        </div>

        {error && (
          <div className="error-message">
            <p>❌ {error}</p>
            <button onClick={() => setError(null)}>✕</button>
          </div>
        )}

        <div className="server-stats">
          <div className="stat-card">
            <Database size={32} />
            <div>
              <h3>{myP2PRooms.length}</h3>
              <p>Мои P2P комнаты</p>
            </div>
          </div>
          <div className="stat-card">
            <Activity size={32} />
            <div>
              <h3>{activeServers.length}</h3>
              <p>Активные серверы</p>
            </div>
          </div>
          <div className="stat-card">
            <Users size={32} />
            <div>
              <h3>{myP2PRooms.reduce((sum, room) => sum + room.currentParticipants, 0)}</h3>
              <p>Всего участников</p>
            </div>
          </div>
        </div>

        <div className="server-actions">
          <button 
            className="create-room-btn"
            onClick={() => setShowCreateForm(!showCreateForm)}
            disabled={loading}
          >
            {showCreateForm ? '❌ Отмена' : '➕ Создать P2P комнату'}
          </button>
        </div>

        {showCreateForm && (
          <div className="create-form-container">
            <form onSubmit={handleCreateP2PRoom} className="create-p2p-form">
              <h3>🚀 Создать P2P комнату</h3>
              
              <div className="form-group">
                <label>Название комнаты:</label>
                <input
                  type="text"
                  value={createForm.name}
                  onChange={(e) => setCreateForm({...createForm, name: e.target.value})}
                  placeholder="Моя P2P комната"
                  required
                />
              </div>

              <div className="form-group">
                <label>Порт сервера:</label>
                <input
                  type="number"
                  value={createForm.serverPort}
                  onChange={(e) => setCreateForm({...createForm, serverPort: parseInt(e.target.value)})}
                  min="1024"
                  max="65535"
                  required
                />
              </div>

              <div className="form-group">
                <label>Максимум участников:</label>
                <input
                  type="number"
                  value={createForm.maxParticipants}
                  onChange={(e) => setCreateForm({...createForm, maxParticipants: parseInt(e.target.value)})}
                  min="2"
                  max="50"
                />
              </div>

              <div className="form-group">
                <label>
                  <input
                    type="checkbox"
                    checked={createForm.requirePassword}
                    onChange={(e) => setCreateForm({...createForm, requirePassword: e.target.checked})}
                  />
                  Требовать пароль
                </label>
              </div>

              {createForm.requirePassword && (
                <div className="form-group">
                  <label>Пароль:</label>
                  <input
                    type="password"
                    value={createForm.password}
                    onChange={(e) => setCreateForm({...createForm, password: e.target.value})}
                    placeholder="Введите пароль"
                  />
                </div>
              )}

              <div className="form-group">
                <label>Описание:</label>
                <textarea
                  value={createForm.description}
                  onChange={(e) => setCreateForm({...createForm, description: e.target.value})}
                  placeholder="Описание комнаты (необязательно)"
                  rows={3}
                />
              </div>

              <button type="submit" disabled={loading}>
                {loading ? '⏳ Создание...' : '🚀 Создать и запустить'}
              </button>
            </form>
          </div>
        )}

        <div className="p2p-rooms-section">
          <h2>📡 Мои P2P комнаты</h2>
          
          {myP2PRooms.length === 0 ? (
            <div className="empty-state">
              <Server size={64} />
              <h3>Нет P2P комнат</h3>
              <p>Создайте свою первую P2P комнату, чтобы стать сервером для друзей</p>
            </div>
          ) : (
            <div className="rooms-grid">
              {myP2PRooms.map((room) => (
                <div key={room.roomKey} className="p2p-room-card">
                  <div className="room-header">
                    <h3>{room.name}</h3>
                    <div className={`server-status ${isServerRunning(room.roomKey) ? 'running' : 'stopped'}`}>
                      {isServerRunning(room.roomKey) ? '🟢 Запущен' : '🔴 Остановлен'}
                    </div>
                  </div>

                  <div className="room-info">
                    <div className="info-item">
                      <Wifi size={16} />
                      <span>{room.serverAddress}</span>
                    </div>
                    <div className="info-item">
                      <Users size={16} />
                      <span>{room.currentParticipants}/{room.maxParticipants}</span>
                    </div>
                    <div className="info-item">
                      <Clock size={16} />
                      <span>{new Date(room.lastActivity).toLocaleString()}</span>
                    </div>
                  </div>

                  {room.description && (
                    <p className="room-description">{room.description}</p>
                  )}

                  <div className="room-actions">
                    {isServerRunning(room.roomKey) ? (
                      <button 
                        className="stop-btn"
                        onClick={() => handleStopServer(room.roomKey)}
                        disabled={loading}
                      >
                        <Square size={16} />
                        Остановить
                      </button>
                    ) : (
                      <button 
                        className="start-btn"
                        onClick={() => handleStartServer(room.roomKey, parseInt(room.serverAddress.split(':')[1]))}
                        disabled={loading}
                      >
                        <Play size={16} />
                        Запустить
                      </button>
                    )}
                    
                    <button 
                      className="delete-btn"
                      onClick={() => handleDeleteRoom(room.roomKey)}
                      disabled={loading}
                    >
                      🗑️ Удалить
                    </button>
                  </div>

                  {room.connections.length > 0 && (
                    <div className="participants-list">
                      <h4>👥 Участники:</h4>
                      {room.connections.map((conn) => (
                        <div key={conn.id} className="participant-item">
                          <span className={`participant-status ${conn.connectionStatus.toLowerCase()}`}>
                            {conn.connectionStatus === 'Online' ? '🟢' : '🟡'}
                          </span>
                          <span>{conn.username}</span>
                          <span className="participant-quality">
                            {conn.connectionQuality}% | {conn.latency}ms
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="server-benefits">
          <h2>🚀 Преимущества P2P подхода</h2>
          <div className="benefits-grid">
            <div className="benefit-card">
              <div className="benefit-icon">⚡</div>
              <h3>Минимальная задержка</h3>
              <p>Прямое соединение между участниками без промежуточного сервера</p>
            </div>
            <div className="benefit-card">
              <div className="benefit-icon">🔗</div>
              <h3>Децентрализация</h3>
              <p>Каждый владелец комнаты становится сервером для своих друзей</p>
            </div>
            <div className="benefit-card">
              <div className="benefit-icon">🔒</div>
              <h3>Полный контроль</h3>
              <p>Управление участниками, настройками и безопасностью</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ServerPage
