import React from 'react'
import { Server, Settings, Code, Database } from 'lucide-react'

const ServerPage: React.FC = () => {
  return (
    <div className="server-page">
      <div className="server-container">
        <div className="server-header">
          <Server size={64} className="server-icon" />
          <h1>Управление сервером</h1>
          <p className="server-subtitle">Настройки и администрирование SpeakAz</p>
        </div>

        <div className="server-benefits">
          <h2>🚀 Почему стоит развернуть собственный сервер?</h2>
          <div className="benefits-grid">
            <div className="benefit-card">
              <div className="benefit-icon">⚡</div>
              <h3>Минимальная задержка</h3>
              <p>Значительно меньше латенси при работе в локальной сети или при близком расположении к серверу</p>
            </div>
            <div className="benefit-card">
              <div className="benefit-icon">🔗</div>
              <h3>Стабильное соединение</h3>
              <p>Более надёжная связь без зависимости от внешних факторов и загруженности публичных серверов</p>
            </div>
            <div className="benefit-card">
              <div className="benefit-icon">🔒</div>
              <h3>Полный контроль</h3>
              <p>Управление настройками, безопасностью и производительностью под ваши конкретные потребности</p>
            </div>
          </div>
        </div>

        <div className="development-notice">
          <div className="notice-content">
            <Settings size={48} className="notice-icon" />
            <h2>🚧 В разработке</h2>
            <p>Панель управления сервером находится в стадии разработки.</p>
            <p>Скоро здесь будут доступны:</p>
            
            <div className="features-grid">
              <div className="feature-card">
                <Database size={32} />
                <h3>База данных</h3>
                <p>Управление пользователями и комнатами</p>
              </div>
              
              <div className="feature-card">
                <Settings size={32} />
                <h3>Настройки</h3>
                <p>Конфигурация сервера и лимиты</p>
              </div>
              
              <div className="feature-card">
                <Code size={32} />
                <h3>API</h3>
                <p>Мониторинг и логи системы</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ServerPage
