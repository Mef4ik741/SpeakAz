import React, { useEffect } from 'react'
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useElectron } from '../hooks/useElectron'

const Layout: React.FC = () => {
  const { user, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const { isElectron, electronAPI, showNotification } = useElectron()

  useEffect(() => {
    if (electronAPI) {
      // Настраиваем обработчики событий от main процесса
      electronAPI.onCreateRoom(() => {
        navigate('/create')
      })

      electronAPI.onJoinRoom(() => {
        navigate('/join')
      })

      electronAPI.onOpenSettings(() => {
        // TODO: Открыть модальное окно настроек
        showNotification('Настройки', 'Окно настроек будет добавлено в следующей версии')
      })

      // Очистка при размонтировании
      return () => {
        electronAPI.removeAllListeners('create-room')
        electronAPI.removeAllListeners('join-room')
        electronAPI.removeAllListeners('open-settings')
      }
    }
  }, [electronAPI, navigate, showNotification])

  return (
    <div className="app-layout">
      {/* Боковая панель */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <h1 className="app-title">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
              <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
            </svg>
            SpeakAz
            {isElectron && (
              <span style={{ 
                fontSize: '0.7rem', 
                opacity: 0.7, 
                marginLeft: '0.5rem',
                backgroundColor: '#5c6bc0',
                padding: '0.2rem 0.4rem',
                borderRadius: '0.3rem'
              }}>
                Desktop
              </span>
            )}
          </h1>
        </div>

        <nav className="sidebar-nav">
          <Link 
            to="/rooms"
            className={`nav-item ${location.pathname === '/rooms' ? 'active' : ''}`}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
            </svg>
            Мои комнаты
          </Link>
          <Link 
            to="/create"
            className={`nav-item ${location.pathname === '/create' ? 'active' : ''}`}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
            </svg>
            Создать комнату
          </Link>
          
          <Link 
            to="/server"
            className={`nav-item ${location.pathname === '/server' ? 'active' : ''}`}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M4 1h16c1.1 0 2 .9 2 2v6c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V3c0-1.1.9-2 2-2zm0 8h16c1.1 0 2 .9 2 2v6c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2v-6c0-1.1.9-2 2-2zm2-6v2h2V3H6zm0 8v2h2v-2H6z"/>
            </svg>
            Открыть сервер
          </Link>
          
          <Link 
            to="/join"
            className={`nav-item ${location.pathname === '/join' ? 'active' : ''}`}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm-1 16H9V7h9v14z"/>
            </svg>
            Присоединиться
          </Link>
          
          {location.pathname.startsWith('/room/') && (
            <div className="nav-item active">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
              </svg>
              В комнате
            </div>
          )}
          
          <div className="nav-divider"></div>
          
          {!isElectron && (
            <button 
              onClick={() => {
                const downloadUrl = 'https://github.com/Mef4ik741/SpeakAz.exe/releases/download/v1.0.0/SpeakAz.Setup.1.0.0.exe'
                
                // Создаем невидимую ссылку для скачивания
                const link = document.createElement('a')
                link.href = downloadUrl
                link.download = 'SpeakAz.Setup.1.0.0.exe'
                link.target = '_blank'
                document.body.appendChild(link)
                link.click()
                document.body.removeChild(link)
                
                // Показываем уведомление
                if (showNotification) {
                  showNotification('Скачивание началось', 'Проверьте папку "Загрузки"')
                }
              }}
              className="nav-item download-btn"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
              </svg>
              Загрузить приложение
            </button>
          )}
          
          <Link 
            to="/api-test"
            className={`nav-item ${location.pathname === '/api-test' ? 'active' : ''}`}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19.14,12.94c0.04-0.3,0.06-0.61,0.06-0.94c0-0.32-0.02-0.64-0.07-0.94l2.03-1.58c0.18-0.14,0.23-0.41,0.12-0.61 l-1.92-3.32c-0.12-0.22-0.37-0.29-0.59-0.22l-2.39,0.96c-0.5-0.38-1.03-0.7-1.62-0.94L14.4,2.81c-0.04-0.24-0.24-0.41-0.48-0.41 h-3.84c-0.24,0-0.43,0.17-0.47,0.41L9.25,5.35C8.66,5.59,8.12,5.92,7.63,6.29L5.24,5.33c-0.22-0.08-0.47,0-0.59,0.22L2.74,8.87 C2.62,9.08,2.66,9.34,2.86,9.48l2.03,1.58C4.84,11.36,4.8,11.69,4.8,12s0.02,0.64,0.07,0.94l-2.03,1.58 c-0.18,0.14-0.23,0.41-0.12,0.61l1.92,3.32c0.12,0.22,0.37,0.29,0.59,0.22l2.39-0.96c0.5,0.38,1.03,0.7,1.62,0.94l0.36,2.54 c0.05,0.24,0.24,0.41,0.48,0.41h3.84c0.24,0,0.44-0.17,0.47-0.41l0.36-2.54c0.59-0.24,1.13-0.56,1.62-0.94l2.39,0.96 c0.22,0.08,0.47,0,0.59-0.22l1.92-3.32c0.12-0.22,0.07-0.47-0.12-0.61L19.14,12.94z M12,15.6c-1.98,0-3.6-1.62-3.6-3.6 s1.62-3.6,3.6-3.6s3.6,1.62,3.6,3.6S13.98,15.6,12,15.6z"/>
            </svg>
            API Тест
          </Link>
        </nav>

        <div className="sidebar-footer">
          <div className="user-info">
            <div className="user-avatar">
              {user?.username?.charAt(0).toUpperCase()}
            </div>
            <div className="user-details">
              <div className="username">{user?.username}</div>
              <button onClick={logout} className="logout-btn">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z"/>
                </svg>
                Выйти
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Основная область */}
      <main className="main-area">
        <div className="main-content">
          <Outlet />
        </div>
      </main>
    </div>
  )
}

export default Layout
