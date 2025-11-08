import axios from 'axios'
import { Room, CreateRoomRequest, JoinRoomRequest } from '../types/Room'

const API_URL = import.meta.env.REACT_APP_API_URL || 'https://speakaz-backend.onrender.com'

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
    'ngrok-skip-browser-warning': 'true',  // Пропускаем предупреждение ngrok
    'Accept': 'application/json',
    'Cache-Control': 'no-cache'
  },
  timeout: 10000  // 10 секунд таймаут
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
      url: error.config?.url,
      headers: error.response?.headers,
      responseText: typeof error.response?.data === 'string' ? error.response.data.substring(0, 200) : 'Not string'
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
    try {
      const response = await api.post('/api/auth/LoginByUsername', { username, password })
      return response.data
    } catch (error: any) {
      // Специальная обработка для ngrok HTML ответов
      if (error.message?.includes('Unexpected token') && error.message?.includes('<!DOCTYPE')) {
        console.error('🚨 Electron ngrok issue: Received HTML instead of JSON')
        console.error('This usually means ngrok warning page is being shown')
        throw new Error('Проблема с подключением к серверу. Попробуйте перезапустить приложение.')
      }
      throw error
    }
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
  },

  updateAudioBitrate: async (roomKey: string, audioBitrate: number) => {
    const response = await api.post(`/api/room/${roomKey}/bitrate`, { audioBitrate })
    return response.data
  }
}

// P2P API для управления P2P комнатами и серверами
export const p2pAPI = {
  // Управление P2P комнатами
  createP2PRoom: async (data: {
    name: string
    serverPort: number
    maxParticipants?: number
    requirePassword?: boolean
    password?: string
    description?: string
  }) => {
    console.log('P2P API - Отправляем запрос на создание комнаты:', data)
    
    // Очищаем пароль если он не требуется
    const cleanData = {
      ...data,
      password: data.requirePassword ? data.password : undefined
    }
    
    console.log('P2P API - Очищенные данные:', cleanData)
    
    try {
      const response = await api.post('/api/p2p/rooms/create', cleanData)
      console.log('P2P API - Комната создана успешно:', response.data)
      return response.data
    } catch (error: any) {
      console.error('P2P API - Ошибка создания комнаты:', {
        status: error.response?.status,
        data: error.response?.data,
        url: error.config?.url,
        method: error.config?.method,
        sentData: data
      })
      throw error
    }
  },

  joinP2PRoom: async (data: { roomKey: string; password?: string }) => {
    const response = await api.post('/api/p2p/rooms/join', data)
    return response.data
  },

  leaveP2PRoom: async (roomKey: string) => {
    const response = await api.post(`/api/p2p/rooms/leave/${roomKey}`)
    return response.data
  },

  getP2PRoomInfo: async (roomKey: string) => {
    const response = await api.get(`/api/p2p/rooms/${roomKey}`)
    return response.data
  },

  getMyP2PRooms: async () => {
    const response = await api.get('/api/p2p/rooms/my')
    return response.data
  },

  deleteP2PRoom: async (roomKey: string) => {
    const response = await api.delete(`/api/p2p/rooms/${roomKey}`)
    return response.data
  },

  getPublicP2PRooms: async () => {
    const response = await api.get('/api/p2p/rooms/public')
    return response.data
  },

  // Управление локальными серверами
  startP2PServer: async (roomKey: string, port: number) => {
    const response = await api.post(`/api/p2p/server/start/${roomKey}`, port)
    return response.data
  },

  stopP2PServer: async (roomKey: string) => {
    const response = await api.post(`/api/p2p/server/stop/${roomKey}`)
    return response.data
  },

  getP2PServerStatus: async (roomKey: string) => {
    const response = await api.get(`/api/p2p/server/status/${roomKey}`)
    return response.data
  },

  getActiveP2PServers: async () => {
    const response = await api.get('/api/p2p/server/active')
    return response.data
  },

  // Управление участниками P2P
  muteP2PParticipant: async (roomKey: string, participantUserId: string) => {
    const response = await api.post(`/api/p2p/rooms/${roomKey}/participants/${participantUserId}/mute`)
    return response.data
  },

  kickP2PParticipant: async (roomKey: string, participantUserId: string) => {
    const response = await api.post(`/api/p2p/rooms/${roomKey}/participants/${participantUserId}/kick`)
    return response.data
  },

  updateP2PPing: async (roomKey: string, latency?: number) => {
    const response = await api.post(`/api/p2p/rooms/${roomKey}/ping`, latency)
    return response.data
  }
}

export default api
