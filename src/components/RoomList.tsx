import React, { useState, useEffect } from 'react'
import { roomAPI } from '../services/api'
import { Room } from '../types/Room'
import { Users, Trash2, LogIn } from 'lucide-react'

interface RoomListProps {
  onRoomJoined: (room: Room) => void
}

const RoomList: React.FC<RoomListProps> = ({ onRoomJoined }) => {
  const [rooms, setRooms] = useState<Room[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadRooms = async () => {
    try {
      setLoading(true)
      const response = await roomAPI.getMyRooms()
      setRooms(response.data || [])
    } catch (error: any) {
      setError('Ошибка загрузки комнат')
      console.error('Load rooms error:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadRooms()
  }, [])

  const handleJoinRoom = async (roomKey: string) => {
    try {
      const response = await roomAPI.joinRoom({ roomKey })
      if (response.isSuccess && response.data) {
        onRoomJoined(response.data)
      }
    } catch (error: any) {
      setError('Ошибка присоединения к комнате')
    }
  }

  const handleDeleteRoom = async (roomKey: string) => {
    if (!confirm('Вы уверены, что хотите удалить комнату?')) return

    try {
      await roomAPI.deleteRoom(roomKey)
      await loadRooms() // Перезагружаем список
    } catch (error: any) {
      setError('Ошибка удаления комнаты')
    }
  }

  if (loading) {
    return <div className="loading">Загрузка комнат...</div>
  }

  return (
    <div className="room-list">
      <div className="section-header">
        <h2>Мои комнаты</h2>
        <button onClick={loadRooms} className="refresh-btn">
          Обновить
        </button>
      </div>

      {error && <div className="error-message">{error}</div>}

      {rooms.length === 0 ? (
        <div className="empty-state">
          <p>У вас пока нет комнат</p>
          <p>Создайте новую комнату или присоединитесь к существующей</p>
        </div>
      ) : (
        <div className="rooms-grid">
          {rooms.map((room) => (
            <div key={room.roomId} className="room-card">
              <div className="room-header">
                <h3>{room.name}</h3>
                <div className="room-participants">
                  <Users size={16} />
                  <span>{room.currentParticipants}/{room.maxParticipants}</span>
                </div>
              </div>

              <div className="room-info">
                <p><strong>Владелец:</strong> {room.ownerUsername}</p>
                <p><strong>Ключ:</strong> <code>{room.roomKey}</code></p>
                <p><strong>Создана:</strong> {new Date(room.createdAt).toLocaleString()}</p>
              </div>

              <div className="room-actions">
                <button 
                  onClick={() => handleJoinRoom(room.roomKey)}
                  className="join-btn"
                  disabled={!room.canJoin}
                >
                  <LogIn size={16} />
                  {room.canJoin ? 'Войти' : 'Заполнена'}
                </button>

                {room.participants.some(p => p.isOwner) && (
                  <button 
                    onClick={() => handleDeleteRoom(room.roomKey)}
                    className="delete-btn"
                  >
                    <Trash2 size={16} />
                    Удалить
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default RoomList
