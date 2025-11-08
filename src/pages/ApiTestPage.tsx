import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { checkApiHealth } from '../utils/apiHealth'
import { roomAPI } from '../services/api'

const MAX_TEST_RESULTS = 50 // Ограничиваем количество результатов

const ApiTestPage: React.FC = () => {
  const [apiStatus, setApiStatus] = useState<any>(null)
  const [userRooms, setUserRooms] = useState<any>(null)
  const [testResults, setTestResults] = useState<string[]>([])
  const [loading, setLoading] = useState(false)

  const addTestResult = useCallback((message: string) => {
    setTestResults(prev => {
      const newResults = [...prev, `${new Date().toLocaleTimeString()}: ${message}`]
      // Ограничиваем размер массива для экономии памяти
      return newResults.length > MAX_TEST_RESULTS 
        ? newResults.slice(-MAX_TEST_RESULTS) 
        : newResults
    })
  }, [])

  const runApiTests = async () => {
    setLoading(true)
    setTestResults([])
    
    const apiUrl = import.meta.env.REACT_APP_API_URL || 'https://speakaz-backend.onrender.com'
    addTestResult(`🌐 Testing API at: ${apiUrl}`)
    
    try {
      // 1. Проверка здоровья API
      addTestResult('🏥 Checking API health...')
      const health = await checkApiHealth(apiUrl)
      setApiStatus(health)
      addTestResult(`🏥 API Health: ${health.isHealthy ? '✅ Healthy' : '❌ Unhealthy'} (${health.status})`)
      
      if (!health.isHealthy) {
        addTestResult(`❌ API Error: ${health.error}`)
        return
      }
      
      // 2. Проверка авторизации
      const token = localStorage.getItem('token')
      addTestResult(`🔐 Auth token: ${token ? '✅ Present' : '❌ Missing'}`)
      
      if (!token) {
        addTestResult('❌ No auth token found. Please login first.')
        return
      }
      
      // 3. Проверка эндпоинта комнат пользователя
      addTestResult('📋 Getting user rooms...')
      try {
        const rooms = await roomAPI.getMyRooms()
        setUserRooms(rooms)
        addTestResult(`📋 User rooms: ✅ Success (${rooms.data?.length || 0} rooms)`)
      } catch (error: any) {
        addTestResult(`❌ User rooms failed: ${error.message}`)
      }
      
      // 4. Тест создания комнаты
      addTestResult('🏗️ Testing room creation...')
      try {
        const createResponse = await roomAPI.createRoom({
          name: `Test Room ${Date.now()}`,
          maxParticipants: 3,
          audioBitrate: 64
        })
        addTestResult(`🏗️ Room creation: ✅ Success (${createResponse.data?.roomKey})`)
        
        // 5. Тест получения информации о созданной комнате
        if (createResponse.data?.roomKey) {
          addTestResult('🔍 Testing room info retrieval...')
          try {
            const roomInfo = await roomAPI.getRoomInfo(createResponse.data.roomKey)
            addTestResult(`🔍 Room info: ✅ Success (${roomInfo.data?.name})`)
          } catch (error: any) {
            addTestResult(`❌ Room info failed: ${error.message}`)
          }
        }
      } catch (error: any) {
        addTestResult(`❌ Room creation failed: ${error.message}`)
      }
      
    } catch (error: any) {
      addTestResult(`❌ Test suite failed: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    runApiTests()
  }, [])

  return (
    <div style={{ padding: '20px', fontFamily: 'monospace' }}>
      <h1>🔧 API Test Dashboard</h1>
      
      <div style={{ marginBottom: '20px' }}>
        <button 
          onClick={runApiTests} 
          disabled={loading}
          style={{ 
            padding: '10px 20px', 
            fontSize: '16px',
            backgroundColor: loading ? '#ccc' : '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: loading ? 'not-allowed' : 'pointer'
          }}
        >
          {loading ? '🔄 Running Tests...' : '🚀 Run API Tests'}
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        <div>
          <h3>📊 API Status</h3>
          <pre style={{ backgroundColor: '#f5f5f5', padding: '10px', borderRadius: '5px' }}>
            {JSON.stringify(apiStatus, null, 2)}
          </pre>
        </div>

        <div>
          <h3>📋 User Rooms</h3>
          <pre style={{ backgroundColor: '#f5f5f5', padding: '10px', borderRadius: '5px' }}>
            {JSON.stringify(userRooms, null, 2)}
          </pre>
        </div>
      </div>

      <div style={{ marginTop: '20px' }}>
        <h3>📝 Test Results</h3>
        <div style={{ 
          backgroundColor: '#000', 
          color: '#00ff00', 
          padding: '10px', 
          borderRadius: '5px',
          height: '300px',
          overflowY: 'auto',
          fontSize: '12px'
        }}>
          {testResults.map((result, index) => (
            <div key={index}>{result}</div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default ApiTestPage
