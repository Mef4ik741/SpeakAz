import React from 'react'
import { useNavigate } from 'react-router-dom'
import CreateRoom from '../components/CreateRoom'
import { Room } from '../types/Room'

const CreateRoomPage: React.FC = () => {
  const navigate = useNavigate()

  const handleRoomCreated = (room: Room) => {
    console.log('CreateRoomPage - room data:', room)
    console.log('CreateRoomPage - roomKey:', room.roomKey)
    
    if (!room.roomKey) {
      console.error('CreateRoomPage - roomKey is missing!')
      return
    }
    
    const targetUrl = `/room/${room.roomKey}`
    console.log('CreateRoomPage - navigating to:', targetUrl)
    navigate(targetUrl)
  }

  return <CreateRoom onRoomCreated={handleRoomCreated} />
}

export default CreateRoomPage
