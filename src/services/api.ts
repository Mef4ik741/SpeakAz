import axios from 'axios'
import { Room, CreateRoomRequest, JoinRoomRequest } from '../types/Room'

const API_URL = import.meta.env.REACT_APP_API_URL || 'https://leola-unengraven-gristly.ngrok-free.dev'

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
    'ngrok-skip-browser-warning': 'true'  // Пропускаем предупреждение ngrok
  },
})

// Добавляем токен к каждому запросу
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Обработка ошибок авторизации
api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Interceptor - Error caught:', {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data,
      url: error.config?.url
    })
    
    if (error.response?.status === 401) {
      console.log('API Interceptor - 401 Unauthorized, clearing tokens')
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      window.location.reload()
    }
    return Promise.reject(error)
  }
)

export const authAPI = {
  login: async (username: string, password: string) => {
    const response = await api.post('/api/auth/LoginByUsername', { username, password })
    return response.data
  },

  register: async (username: string, password: string, confirmPassword: string) => {
    const response = await api.post('/api/account/register', { 
      username, 
      password, 
      confirmPassword 
    })
    return response.data
  }
}

export const roomAPI = {
  createRoom: async (data: CreateRoomRequest) => {
    const response = await api.post('/api/room/create', data)
    return response.data
  },

  joinRoom: async (data: JoinRoomRequest) => {
    const response = await api.post('/api/room/join', data)
    return response.data
  },

  leaveRoom: async (roomKey: string) => {
    try {
      console.log('API - Attempting to leave room:', roomKey)
      const response = await api.post(`/api/room/leave/${roomKey}`)
      console.log('API - Successfully left room:', response.data)
      return response.data
    } catch (error: any) {
      console.log('API - Leave room error details:', {
        status: error.response?.status,
        message: error.response?.data?.message,
        data: error.response?.data,
        roomKey: roomKey
      })
      
      // Если комната не найдена или пользователь не участник, это не критичная ошибка
      if (error.response?.status === 400) {
        const errorMessage = error.response?.data?.message || ''
        if (errorMessage.includes('не найдена') || 
            errorMessage.includes('не являетесь участником') ||
            errorMessage.includes('неактивна') ||
            errorMessage.includes('not found') ||
            errorMessage.includes('not a participant')) {
          console.warn('API - Room leave error (non-critical):', errorMessage)
          return { isSuccess: true, message: 'Выход из комнаты выполнен (комната недоступна или вы уже не участник)' }
        }
      }
      
      console.error('API - Critical leave room error:', error.response?.data || error.message)
      throw error
    }
  },

  getRoomInfo: async (roomKey: string) => {
    try {
      console.log('API - getRoomInfo called with roomKey:', roomKey)
      console.log('API - Full URL will be:', `${API_URL}/api/room/info/${roomKey}`)
      const response = await api.get(`/api/room/info/${roomKey}`)
      console.log('API - getRoomInfo response:', response.data)
      return response.data
    } catch (error: any) {
      console.error('API - getRoomInfo error:', error)
      console.error('API - Error response:', error.response?.data)
      console.error('API - Error status:', error.response?.status)
      throw error
    }
  },

  getMyRooms: async (): Promise<{ data: Room[] }> => {
    const response = await api.get('/api/room/my-rooms')
    return response.data
  },

  deleteRoom: async (roomKey: string) => {
    const response = await api.delete(`/api/room/${roomKey}`)
    return response.data
  },

  muteParticipant: async (roomKey: string, participantId: string) => {
    const response = await api.post(`/api/room/${roomKey}/mute/${participantId}`)
    return response.data
  },

  kickParticipant: async (roomKey: string, participantId: string) => {
    const response = await api.post(`/api/room/${roomKey}/kick/${participantId}`)
    return response.data
  },

  heartbeat: async (roomKey: string) => {
    const response = await api.post(`/api/room/${roomKey}/heartbeat`)
    return response.data
  }
}

export default api
