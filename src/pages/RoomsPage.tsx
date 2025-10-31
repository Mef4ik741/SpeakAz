import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import RoomList from '../components/RoomList'
import { Room } from '../types/Room'

const RoomsPage: React.FC = () => {
  const navigate = useNavigate()
  const [reloadMessage, setReloadMessage] = useState<string | null>(null)

  useEffect(() => {
    // Проверяем, есть ли сообщение о перезагрузке
    const message = sessionStorage.getItem('room_reload_message')
    if (message) {
      setReloadMessage(message)
      sessionStorage.removeItem('room_reload_message')
      
      // Автоматически скрываем сообщение через 5 секунд
      setTimeout(() => {
        setReloadMessage(null)
      }, 5000)
    }
  }, [])

  const handleRoomJoined = (room: Room) => {
    console.log('RoomsPage - room joined:', room)
    console.log('RoomsPage - roomKey:', room.roomKey)
    console.log('RoomsPage - roomId:', room.roomId)
    
    // Используем roomKey если есть, иначе roomId
    const roomIdentifier = room.roomKey || room.roomId
    const targetUrl = `/room/${roomIdentifier}`
    console.log('RoomsPage - navigating to:', targetUrl)
    navigate(targetUrl)
  }

  const dismissMessage = () => {
    setReloadMessage(null)
  }

  return (
    <>
      {reloadMessage && (
        <div className="reload-message">
          <div className="reload-message-content">
            <span>{reloadMessage}</span>
            <button onClick={dismissMessage} className="dismiss-btn">×</button>
          </div>
        </div>
      )}
      <RoomList onRoomJoined={handleRoomJoined} />
    </>
  )
}

export default RoomsPage
