import React, { useState } from 'react'
import { roomAPI } from '../services/api'
import { Room } from '../types/Room'
import { LogIn, Search } from 'lucide-react'

interface JoinRoomProps {
  onRoomJoined: (room: Room) => void
}

const JoinRoom: React.FC<JoinRoomProps> = ({ onRoomJoined }) => {
  const [roomKey, setRoomKey] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [roomInfo, setRoomInfo] = useState<any>(null)

  const handleGetRoomInfo = async () => {
    if (!roomKey.trim()) {
      setError('Введите ключ комнаты')
      return
    }

    setError('')
    setLoading(true)

    try {
      const response = await roomAPI.getRoomInfo(roomKey.trim())
      if (response.isSuccess && response.data) {
        setRoomInfo(response.data)
      } else {
        throw new Error(response.message || 'Комната не найдена')
      }
    } catch (error: any) {
      setError(error.response?.data?.message || error.message || 'Комната не найдена')
      setRoomInfo(null)
    } finally {
      setLoading(false)
    }
  }

  const handleJoinRoom = async () => {
    if (!roomKey.trim()) return

    setError('')
    setLoading(true)

    try {
      const response = await roomAPI.joinRoom({ roomKey: roomKey.trim() })
      if (response.isSuccess && response.data) {
        onRoomJoined(response.data)
      } else {
        throw new Error(response.message || 'Ошибка присоединения')
      }
    } catch (error: any) {
      setError(error.response?.data?.message || error.message || 'Ошибка присоединения к комнате')
    } finally {
      setLoading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (roomInfo) {
        handleJoinRoom()
      } else {
        handleGetRoomInfo()
      }
    }
  }

  return (
    <div className="join-room">
      <h2>Присоединиться к комнате</h2>

      <div className="join-form">
        <div className="form-group">
          <label htmlFor="roomKey">Ключ комнаты</label>
          <div className="input-with-button">
            <input
              id="roomKey"
              type="text"
              value={roomKey}
              onChange={(e) => setRoomKey(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Введите ключ комнаты (GUID)"
              disabled={loading}
            />
            <button 
              onClick={handleGetRoomInfo}
              disabled={loading || !roomKey.trim()}
              className="search-btn"
            >
              <Search size={20} />
              Найти
            </button>
          </div>
        </div>

        {error && <div className="error-message">{error}</div>}

        {roomInfo && (
          <div className="room-preview">
            <h3>Информация о комнате</h3>
            <div className="room-details">
              <div className="detail-row">
                <span className="label">Название:</span>
                <span className="value">{roomInfo.name}</span>
              </div>
              <div className="detail-row">
                <span className="label">Владелец:</span>
                <span className="value">{roomInfo.ownerUsername}</span>
              </div>
              <div className="detail-row">
                <span className="label">Участники:</span>
                <span className="value">
                  {roomInfo.currentParticipants}/{roomInfo.maxParticipants}
                </span>
              </div>
              <div className="detail-row">
                <span className="label">Статус:</span>
                <span className={`status ${roomInfo.canJoin ? 'available' : 'full'}`}>
                  {roomInfo.canJoin ? 'Можно присоединиться' : 'Комната заполнена'}
                </span>
              </div>
              <div className="detail-row">
                <span className="label">Создана:</span>
                <span className="value">
                  {new Date(roomInfo.createdAt).toLocaleString()}
                </span>
              </div>
            </div>

            {roomInfo.participants && roomInfo.participants.length > 0 && (
              <div className="participants-list">
                <h4>Участники:</h4>
                <ul>
                  {roomInfo.participants.map((participant: any) => (
                    <li key={participant.userId} className="participant">
                      <span className="username">{participant.username}</span>
                      {participant.isOwner && <span className="owner-badge">Владелец</span>}
                      {participant.isMuted && <span className="muted-badge">🔇</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <button 
              onClick={handleJoinRoom}
              disabled={loading || !roomInfo.canJoin}
              className="join-btn"
            >
              <LogIn size={20} />
              {loading ? 'Присоединение...' : 
               roomInfo.canJoin ? 'Присоединиться' : 'Комната заполнена'}
            </button>
          </div>
        )}

        <div className="help-text">
          <h4>Как получить ключ комнаты?</h4>
          <ul>
            <li>Попросите владельца комнаты поделиться ключом</li>
            <li>Ключ представляет собой уникальный GUID</li>
            <li>Максимум 5 участников в одной комнате</li>
          </ul>
        </div>
      </div>
    </div>
  )
}

export default JoinRoom
