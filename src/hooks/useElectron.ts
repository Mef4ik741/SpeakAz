import { useEffect, useState } from 'react'

// Типы для Electron API
interface ElectronAPI {
  getAppVersion: () => Promise<string>
  minimizeToTray: () => Promise<void>
  quitApp: () => Promise<void>
  showNotification: (title: string, body: string) => Promise<void>
  onCreateRoom: (callback: () => void) => void
  onJoinRoom: (callback: () => void) => void
  onOpenSettings: (callback: () => void) => void
  removeAllListeners: (channel: string) => void
  isElectron: boolean
  platform: string
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI
  }
}

export const useElectron = () => {
  const [isElectron, setIsElectron] = useState(false)
  const [electronAPI, setElectronAPI] = useState<ElectronAPI | null>(null)

  useEffect(() => {
    // Проверяем, доступен ли Electron API
    if (window.electronAPI) {
      setIsElectron(true)
      setElectronAPI(window.electronAPI)
      console.log('🖥️ Running in Electron environment')
    } else {
      setIsElectron(false)
      console.log('🌐 Running in browser environment')
    }
  }, [])

  // Вспомогательные функции
  const showNotification = async (title: string, body: string) => {
    if (electronAPI) {
      await electronAPI.showNotification(title, body)
    } else {
      // Fallback для браузера
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(title, { body })
      }
    }
  }

  const minimizeToTray = async () => {
    if (electronAPI) {
      await electronAPI.minimizeToTray()
    }
  }

  const quitApp = async () => {
    if (electronAPI) {
      await electronAPI.quitApp()
    }
  }

  const getAppVersion = async (): Promise<string> => {
    if (electronAPI) {
      return await electronAPI.getAppVersion()
    }
    return '1.0.0 (Web)'
  }

  return {
    isElectron,
    electronAPI,
    showNotification,
    minimizeToTray,
    quitApp,
    getAppVersion,
    platform: electronAPI?.platform || 'web'
  }
}
