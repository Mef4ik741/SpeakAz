const { contextBridge, ipcRenderer } = require('electron')

// Безопасный API для взаимодействия с main процессом
contextBridge.exposeInMainWorld('electronAPI', {
  // Информация о приложении
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  
  // Управление окном
  minimizeToTray: () => ipcRenderer.invoke('minimize-to-tray'),
  quitApp: () => ipcRenderer.invoke('quit-app'),
  
  // Уведомления
  showNotification: (title, body) => ipcRenderer.invoke('show-notification', title, body),
  
  // Слушатели событий от main процесса
  onCreateRoom: (callback) => ipcRenderer.on('create-room', callback),
  onJoinRoom: (callback) => ipcRenderer.on('join-room', callback),
  onOpenSettings: (callback) => ipcRenderer.on('open-settings', callback),
  
  // Удаление слушателей
  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel),
  
  // Проверка, что мы в Electron
  isElectron: true,
  
  // Платформа
  platform: process.platform
})

// Логирование для отладки
console.log('Preload script loaded successfully')
console.log('Electron API exposed to renderer process')
