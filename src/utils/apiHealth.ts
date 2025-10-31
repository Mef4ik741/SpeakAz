// Утилита для проверки здоровья API
export const checkApiHealth = async (baseUrl: string): Promise<{
  isHealthy: boolean
  status: number | null
  error?: string
}> => {
  try {
    console.log('🔍 Checking API health at:', baseUrl)
    
    // Проверяем доступность Swagger UI
    const swaggerResponse = await fetch(`${baseUrl}/swagger/index.html`, {
      method: 'GET',
      mode: 'cors'
    })
    
    console.log('📊 Swagger response status:', swaggerResponse.status)
    
    if (swaggerResponse.ok) {
      return {
        isHealthy: true,
        status: swaggerResponse.status
      }
    } else {
      return {
        isHealthy: false,
        status: swaggerResponse.status,
        error: `Swagger UI недоступен: ${swaggerResponse.status}`
      }
    }
  } catch (error: any) {
    console.error('❌ API Health Check failed:', error)
    return {
      isHealthy: false,
      status: null,
      error: error.message || 'Сетевая ошибка'
    }
  }
}

export const checkRoomEndpoint = async (baseUrl: string, roomKey: string, token: string): Promise<{
  isWorking: boolean
  status: number | null
  data?: any
  error?: string
}> => {
  try {
    console.log('🏠 Checking room endpoint for roomKey:', roomKey)
    
    const response = await fetch(`${baseUrl}/api/room/info/${roomKey}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true'  // Пропускаем предупреждение ngrok
      },
      mode: 'cors'
    })
    
    console.log('🏠 Room endpoint response status:', response.status)
    console.log('🏠 Room endpoint response headers:', Object.fromEntries(response.headers.entries()))
    
    const contentType = response.headers.get('content-type')
    console.log('🏠 Content-Type:', contentType)
    
    let data: any
    if (contentType && contentType.includes('application/json')) {
      data = await response.json()
      console.log('🏠 Room endpoint response data (JSON):', data)
    } else {
      const text = await response.text()
      console.log('🏠 Room endpoint response data (TEXT):', text.substring(0, 200) + '...')
      data = { 
        error: 'Server returned non-JSON response', 
        contentType, 
        preview: text.substring(0, 100) 
      }
    }
    
    return {
      isWorking: response.ok,
      status: response.status,
      data: data,
      error: response.ok ? undefined : data.message || `HTTP ${response.status}`
    }
  } catch (error: any) {
    console.error('❌ Room endpoint check failed:', error)
    return {
      isWorking: false,
      status: null,
      error: error.message || 'Сетевая ошибка'
    }
  }
}
