import React, { useState } from 'react'
import { roomAPI } from '../services/api'
import type { Room } from '../types/Room'
import { Plus } from 'lucide-react'

interface CreateRoomProps {
  onRoomCreated: (room: Room) => void
}

const CreateRoom: React.FC<CreateRoomProps> = ({ onRoomCreated }) => {
  const [name, setName] = useState('')
  const [maxParticipants, setMaxParticipants] = useState(5)
  const [audioBitrate, setAudioBitrate] = useState(64)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [createdRoom, setCreatedRoom] = useState<any>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const response = await roomAPI.createRoom({
        name,
        maxParticipants,
        audioBitrate
      })

      if (response.isSuccess && response.data) {
        console.log('CreateRoom - API response:', response.data)
        setCreatedRoom(response.data)
        setName('')
        setMaxParticipants(5)
        setAudioBitrate(64)
      } else {
        throw new Error(response.message || 'Ошибка создания комнаты')
      }
    } catch (error: any) {
      setError(error.response?.data?.message || error.message || 'Ошибка создания комнаты')
    } finally {
      setLoading(false)
    }
  }

  const handleJoinCreatedRoom = () => {
    console.log('CreateRoom - handleJoinCreatedRoom called with:', createdRoom)
    
    if (!createdRoom?.roomKey) {
      console.error('CreateRoom - roomKey is missing in createdRoom:', createdRoom)
      setError('Ключ комнаты не найден')
      return
    }
    
    // Создаем объект Room из данных созданной комнаты
    const roomData: Room = {
      roomId: createdRoom.roomId || '',
      roomKey: createdRoom.roomKey,
      name: createdRoom.name || '',
      ownerUsername: '', // Будет заполнено при загрузке
      currentParticipants: 1,
      maxParticipants: createdRoom.maxParticipants || 5,
      audioBitrate: createdRoom.audioBitrate || audioBitrate,
      createdAt: createdRoom.createdAt || new Date().toISOString(),
      lastActivity: new Date().toISOString(),
      isActive: true,
      canJoin: true,
      participants: []
    }
    
    console.log('CreateRoom - calling onRoomCreated with:', roomData)
    onRoomCreated(roomData)
  }

  const copyRoomKey = () => {
    if (createdRoom) {
      navigator.clipboard.writeText(createdRoom.roomKey)
      alert('Ключ комнаты скопирован!')
    }
  }

  return (
    <div className="create-room">
      <h2>Создать голосовую комнату</h2>

      {!createdRoom ? (
        <form onSubmit={handleSubmit} className="create-form">
          <div className="form-group">
            <label htmlFor="roomName">Название комнаты</label>
            <input
              id="roomName"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Введите название комнаты"
              required
              minLength={3}
              maxLength={100}
            />
          </div>

          <div className="form-group">
            <label htmlFor="maxParticipants">Максимум участников</label>
            <select
              id="maxParticipants"
              value={maxParticipants}
              onChange={(e) => setMaxParticipants(Number(e.target.value))}
            >
              <option value={2}>2 участника</option>
              <option value={3}>3 участника</option>
              <option value={4}>4 участника</option>
              <option value={5}>5 участников</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="audioBitrate">Битрейт аудио</label>
            <div className="bitrate-container">
              <input
                id="audioBitrate"
                type="range"
                min="8"
                max="320"
                step="8"
                value={audioBitrate}
                onChange={(e) => setAudioBitrate(Number(e.target.value))}
                className="bitrate-slider"
              />
              <div className="bitrate-display">
                <span>{audioBitrate}kbps</span>
              </div>
            </div>
            <div className="bitrate-presets">
              <button type="button" onClick={() => setAudioBitrate(64)} className={audioBitrate === 64 ? 'active' : ''}>64kbps</button>
              <button type="button" onClick={() => setAudioBitrate(128)} className={audioBitrate === 128 ? 'active' : ''}>128kbps</button>
              <button type="button" onClick={() => setAudioBitrate(192)} className={audioBitrate === 192 ? 'active' : ''}>192kbps</button>
            </div>
            <p className="bitrate-warning">
              Рекомендуется 64 kbps для стабильного соединения
            </p>
          </div>

          {error && <div className="error-message">{error}</div>}

          <button type="submit" disabled={loading} className="create-btn">
            <Plus size={20} />
            {loading ? 'Создание...' : 'Создать комнату'}
          </button>
        </form>
      ) : (
        <div className="room-created">
          <div className="success-message">
            <h3>✅ Комната создана успешно!</h3>
            <div className="room-details">
              <p><strong>Название:</strong> {createdRoom.name}</p>
              <p><strong>Максимум участников:</strong> {createdRoom.maxParticipants}</p>
              <div className="room-key-section">
                <p><strong>Ключ комнаты:</strong></p>
                <div className="key-container">
                  <code className="room-key">{createdRoom.roomKey}</code>
                  <button onClick={copyRoomKey} className="copy-btn">
                    Копировать
                  </button>
                </div>
                <p className="key-hint">
                  Поделитесь этим ключом с друзьями, чтобы они могли присоединиться
                </p>
              </div>
            </div>

            <div className="room-actions">
              <button onClick={handleJoinCreatedRoom} className="join-room-btn">
                Войти в комнату
              </button>
              <button 
                onClick={() => setCreatedRoom(null)} 
                className="create-another-btn"
              >
                Создать ещё одну
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default CreateRoom
