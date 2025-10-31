import React from 'react'
import { useNavigate } from 'react-router-dom'
import JoinRoom from '../components/JoinRoom'
import { Room } from '../types/Room'

const JoinRoomPage: React.FC = () => {
  const navigate = useNavigate()

  const handleRoomJoined = (room: Room) => {
    console.log('JoinRoomPage - room joined:', room)
    console.log('JoinRoomPage - roomKey:', room.roomKey)
    console.log('JoinRoomPage - roomId:', room.roomId)
    
    // Используем roomKey если есть, иначе roomId
    const roomIdentifier = room.roomKey || room.roomId
    const targetUrl = `/room/${roomIdentifier}`
    console.log('JoinRoomPage - navigating to:', targetUrl)
    navigate(targetUrl)
  }

  return <JoinRoom onRoomJoined={handleRoomJoined} />
}

export default JoinRoomPage
