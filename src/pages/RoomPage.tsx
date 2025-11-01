import React, { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { roomAPI } from '../services/api'
import RoomView from '../components/RoomView'
import { Room } from '../types/Room'
import { checkApiHealth, checkRoomEndpoint } from '../utils/apiHealth'

const RoomPage: React.FC = () => {
  const params = useParams<{ roomKey: string }>()
  const { roomKey } = params
  const navigate = useNavigate()
  const [room, setRoom] = useState<Room | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const isLoadingRef = useRef(false)

  useEffect(() => {
    if (isLoadingRef.current) return // Предотвращаем дублирование
    const loadRoom = async () => {
      isLoadingRef.current = true
      console.log('RoomPage - Full URL:', window.location.href)
      console.log('RoomPage - Pathname:', window.location.pathname)
      console.log('RoomPage - All params:', params)
      console.log('RoomPage - roomKey:', roomKey)
      
      if (!roomKey || roomKey === 'undefined') {
        console.log('RoomPage - roomKey is invalid, redirecting to /rooms')
        navigate('/rooms')
        return
      }

      // Проверяем, был ли пользователь уже в этой комнате
      // Используем roomKey из URL (который на самом деле roomId) для проверки сессии
      const sessionKey = `room_session_${roomKey}`
      const wasInRoom = sessionStorage.getItem(sessionKey)

      if (wasInRoom) {
        console.log('RoomPage - User was already in room, assuming page reload, redirecting to rooms with message')
        sessionStorage.removeItem(sessionKey)
        // Сохраняем информацию о том, что нужно показать сообщение
        sessionStorage.setItem('room_reload_message', `Соединение с комнатой "${roomKey}" было прервано. Войдите в комнату заново.`)
        navigate('/rooms')
        return
      }

      try {
        // Проверяем авторизацию
        const token = localStorage.getItem('token')
        console.log('RoomPage - Auth token exists:', !!token)
        if (!token) {
          throw new Error('Необходима авторизация')
        }
        
        // Полная диагностика API
        const apiUrl = import.meta.env.REACT_APP_API_URL || 'https://leola-unengraven-gristly.ngrok-free.dev'
        console.log('🔍 RoomPage - Starting comprehensive API diagnostics...')
        console.log('🌐 API URL:', apiUrl)
        
        // 1. Проверяем здоровье API
        const healthCheck = await checkApiHealth(apiUrl)
        console.log('🏥 API Health Check:', healthCheck)
        
        if (!healthCheck.isHealthy) {
          throw new Error(`API недоступен: ${healthCheck.error}`)
        }
        
        // 2. Проверяем конкретный эндпоинт комнаты
        const roomCheck = await checkRoomEndpoint(apiUrl, roomKey, token)
        console.log('🏠 Room Endpoint Check:', roomCheck)
        
        if (!roomCheck.isWorking) {
          console.warn(`🔧 Room API endpoint issue: ${roomCheck.error}`)
          console.log('🔧 Continuing with WebSocket-only mode (this is normal for some room configurations)')
          // Не прерываем выполнение - WebSocket может работать даже если REST API недоступен
        }
        
        // 3. Проверяем, какие комнаты доступны пользователю
        try {
          console.log('📋 Getting user rooms for debugging...')
          const userRoomsResponse = await roomAPI.getMyRooms()
          console.log('📋 User rooms:', userRoomsResponse)
        } catch (roomsError) {
          console.error('❌ Failed to get user rooms:', roomsError)
        }
        
        console.log('RoomPage - calling getRoomInfo with:', roomKey)
        
        try {
          const response = await roomAPI.getRoomInfo(roomKey)
          console.log('RoomPage - API response:', response)
          
          if (response.isSuccess && response.data) {
            console.log('RoomPage - Room loaded successfully:', response.data)
            setRoom(response.data)
          } else {
            console.log('RoomPage - API returned error, creating fallback room object:', response.message)
            throw new Error(response.message || 'Комната не найдена')
          }
        } catch (apiError: any) {
          console.warn('RoomPage - API failed, creating fallback room object for WebSocket-only mode')
          
          // Создаем базовый объект комнаты для WebSocket подключения
          const fallbackRoom: Room = {
            roomId: roomKey,
            roomKey: roomKey,
            name: `Комната ${roomKey.substring(0, 8)}...`,
            ownerUsername: 'Неизвестно',
            currentParticipants: 0,
            maxParticipants: 5,
            createdAt: new Date().toISOString(),
            lastActivity: new Date().toISOString(),
            isActive: true,
            canJoin: true,
            participants: []
          }
          
          console.log('RoomPage - Using fallback room object:', fallbackRoom)
          setRoom(fallbackRoom)
        }
      } catch (error: any) {
        console.error('RoomPage - error loading room:', error)
        console.error('RoomPage - error details:', {
          message: error.message,
          response: error.response?.data,
          status: error.response?.status
        })
        
        let errorMessage = 'Комната не найдена или недоступна'
        if (error.response?.status === 404) {
          errorMessage = 'Комната не найдена'
        } else if (error.response?.status === 403) {
          errorMessage = 'Нет доступа к комнате'
        } else if (error.response?.status === 401) {
          errorMessage = 'Необходима авторизация'
        }
        
        setError(errorMessage)
        setTimeout(() => navigate('/rooms'), 3000)
      } finally {
        setLoading(false)
        isLoadingRef.current = false
      }
    }

    loadRoom()
  }, [roomKey, navigate])

  const handleLeaveRoom = () => {
    // Очищаем sessionStorage при выходе из комнаты
    if (roomKey) {
      const sessionKey = `room_session_${roomKey}`
      sessionStorage.removeItem(sessionKey)
    }
    navigate('/rooms')
  }

  if (loading) {
    return (
      <div className="loading">Загрузка комнаты...</div>
    )
  }

  if (error) {
    return (
      <div className="error-container">
        <div className="error-message">{error}</div>
        <p>Перенаправление на главную страницу...</p>
      </div>
    )
  }

  if (!room) {
    return (
      <div className="error-message">Комната не найдена</div>
    )
  }

  return (
    <RoomView room={room} onLeave={handleLeaveRoom} />
  )
}

export default RoomPage
