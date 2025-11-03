const { app, BrowserWindow, Menu, Tray, nativeImage, ipcMain, shell, dialog, protocol } = require('electron')
const path = require('path')
const fs = require('fs')
const express = require('express')
const http = require('http')
const os = require('os')

// Создаем лог файл для диагностики
const logPath = path.join(os.tmpdir(), 'speakaz-electron.log')
function writeLog(message) {
  const timestamp = new Date().toISOString()
  const logMessage = `[${timestamp}] ${message}\n`
  console.log(message)
  try {
    fs.appendFileSync(logPath, logMessage)
  } catch (err) {
    console.error('Failed to write log:', err)
  }
}

writeLog('🚀 SpeakAz Electron starting...')
writeLog(`📁 Log file: ${logPath}`)
writeLog(`🔧 Node version: ${process.version}`)
writeLog(`🔧 Electron version: ${process.versions.electron}`)
writeLog(`🔧 Platform: ${process.platform}`)
writeLog(`🔧 Arch: ${process.arch}`)

// Определяем режим разработки без внешней зависимости
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged

// Глобальные переменные
let mainWindow
let tray
let isQuitting = false
let memoryMonitorTimer = null

// Настройка безопасности
process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true'

// Обработка неперехваченных ошибок
process.on('uncaughtException', (error) => {
  writeLog(`❌ Uncaught Exception: ${error.message}`)
  writeLog(`Stack: ${error.stack}`)
  
  dialog.showErrorBox('Критическая ошибка SpeakAz', 
    `Произошла неожиданная ошибка:\n\n${error.message}\n\nЛог файл: ${logPath}`)
})

process.on('unhandledRejection', (reason, promise) => {
  writeLog(`❌ Unhandled Rejection at: ${promise}, reason: ${reason}`)
  
  dialog.showErrorBox('Ошибка SpeakAz', 
    `Произошла ошибка обработки:\n\n${reason}\n\nЛог файл: ${logPath}`)
})

// Функция мониторинга памяти
function startMemoryMonitoring() {
  memoryMonitorTimer = setInterval(() => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      const memoryInfo = process.getProcessMemoryInfo()
      const systemMemory = process.getSystemMemoryInfo()
      
      writeLog(`🧠 Memory Usage: RSS=${Math.round(memoryInfo.residentSet / 1024 / 1024)}MB, Heap=${Math.round(memoryInfo.private / 1024 / 1024)}MB, External=${Math.round(memoryInfo.sharedWorkingSet / 1024 / 1024)}MB, SystemFree=${Math.round(systemMemory.free / 1024 / 1024)}MB`)
      
      // Если память превышает 500MB, принудительно очищаем
      if (memoryInfo.residentSet > 500 * 1024 * 1024) {
        writeLog('🧠 High memory usage detected, performing cleanup...')
        performMemoryCleanup()
      }
    }
  }, 30000) // Каждые 30 секунд
}

function performMemoryCleanup() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    // Очищаем кэш сессии
    mainWindow.webContents.session.clearCache()
    
    // Принудительный сбор мусора в renderer процессе
    mainWindow.webContents.executeJavaScript(`
      // Очищаем WebRTC и WebSocket буферы
      if (window.webRTCService) {
        console.log('🧹 Electron: Triggering WebRTC cleanup...')
        window.webRTCService.performMemoryCleanup?.()
      }
      
      if (window.roomWebSocketService) {
        console.log('🧹 Electron: Triggering WebSocket cleanup...')
        window.roomWebSocketService.performBufferCleanup?.()
      }
      
      // Принудительный сбор мусора если доступен
      if (window.gc) {
        window.gc()
      }
      
      console.log('🧹 Electron: Memory cleanup completed')
    `).catch(err => {
      console.error('Error during memory cleanup:', err)
    })
    
    // Принудительный сбор мусора в main процессе
    if (global.gc) {
      global.gc()
    }
  }
}

// HTTP сервер для статических файлов
let localServer = null
const LOCAL_PORT = 8080

function createLocalServer() {
  return new Promise((resolve, reject) => {
    if (isDev) {
      resolve('http://localhost:3000')
      return
    }

    const expressApp = express()
    
    // Определяем путь к dist папке
    let distPath
    if (process.resourcesPath) {
      distPath = path.join(process.resourcesPath, 'app', 'dist')
    } else {
      distPath = path.join(__dirname, '../dist')
    }
    
    writeLog('📁 Serving static files from: ' + distPath)
    
    // Настраиваем статические файлы
    expressApp.use(express.static(distPath, {
      setHeaders: (res, filePath) => {
        // Устанавливаем правильные MIME типы
        if (filePath.endsWith('.js')) {
          res.setHeader('Content-Type', 'application/javascript')
        } else if (filePath.endsWith('.css')) {
          res.setHeader('Content-Type', 'text/css')
        }
      }
    }))
    
    // SPA fallback - все маршруты возвращают index.html
    expressApp.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'))
    })
    
    localServer = expressApp.listen(LOCAL_PORT, 'localhost', () => {
      const serverUrl = `http://localhost:${LOCAL_PORT}`
      writeLog('🌐 Local server started: ' + serverUrl)
      resolve(serverUrl)
    })
    
    localServer.on('error', (err) => {
      writeLog('❌ Local server error: ' + err.message)
      reject(err)
    })
  })
}

// Регистрируем схему ДО app.ready (должно быть в самом начале)
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'app',
    privileges: {
      standard: true,
      secure: true,
      allowServiceWorkers: true,
      supportFetchAPI: true,
      corsEnabled: true
    }
  }
])

function setupFileProtocol() {
  // Регистрируем кастомный протокол для статических файлов
  protocol.registerFileProtocol('app', (request, callback) => {
    const url = request.url.substr(6) // убираем 'app://'
    const distPath = path.join(__dirname, '../dist')
    
    let filePath
    if (url === '' || url === '/') {
      filePath = path.join(distPath, 'index.html')
    } else {
      filePath = path.join(distPath, url)
    }
    
    console.log('Protocol request:', request.url, '-> File:', filePath)
    console.log('File exists:', fs.existsSync(filePath))
    
    // Проверяем существование файла
    if (fs.existsSync(filePath)) {
      console.log('✅ Serving file:', filePath)
      callback({ path: filePath })
    } else {
      console.log('❌ File not found, checking alternatives...')
      
      // Попробуем найти файл в assets
      const assetsPath = path.join(distPath, 'assets', path.basename(url))
      if (fs.existsSync(assetsPath)) {
        console.log('✅ Found in assets:', assetsPath)
        callback({ path: assetsPath })
      } else {
        console.log('📄 Fallback to index.html for SPA routing')
        callback({ path: path.join(distPath, 'index.html') })
      }
    }
  })
}

function createWindow() {
  // Создаем главное окно приложения с оптимизацией памяти
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    // icon: path.join(__dirname, 'assets', 'icon.png'), // Иконка отключена пока
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: path.join(__dirname, 'preload.js'),
      webSecurity: false, // Временно отключаем для диагностики
      allowRunningInsecureContent: true,
      experimentalFeatures: true,
      // Оптимизация памяти
      backgroundThrottling: false, // Отключаем троттлинг для аудио
      offscreen: false,
      spellcheck: false, // Отключаем проверку орфографии
      // Ограничиваем использование памяти
      partition: 'persist:main',
      // Включаем аппаратное ускорение только если нужно
      hardwareAcceleration: true
    },
    titleBarStyle: 'default',
    show: false, // Не показываем окно сразу
    autoHideMenuBar: false, // Показываем меню
  })

  // Настройки сессии для оптимизации памяти
  const session = mainWindow.webContents.session
  
  // Очистка кэша при старте
  session.clearCache()
  
  // Устанавливаем User-Agent через webContents (работает в Electron)
  mainWindow.webContents.setUserAgent('SpeakAz-Electron/1.0.0')
  
  // Ограничиваем размер кэша (в байтах)
  session.setCacheSize(50 * 1024 * 1024) // 50MB
  
  // Загружаем приложение через HTTP сервер
  createLocalServer().then((serverUrl) => {
    console.log('🚀 Loading URL:', serverUrl)
    console.log('🔧 isDev:', isDev)
    console.log('📁 __dirname:', __dirname)
    
    mainWindow.loadURL(serverUrl)
  }).catch((error) => {
    console.error('❌ Failed to start server:', error)
    
    // Fallback на простую страницу с ошибкой
    const errorHtml = `
      <html>
        <head><title>SpeakAz - Server Error</title></head>
        <body style="font-family: Arial; padding: 50px; text-align: center; background: #f44336; color: white;">
          <h1>❌ Ошибка запуска сервера</h1>
          <p>${error.message}</p>
        </body>
      </html>
    `
    mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(errorHtml)}`)
  })

  // Добавляем обработчик для всех запросов
  mainWindow.webContents.session.webRequest.onBeforeRequest((details, callback) => {
    console.log('Request:', details.url)
    
    // Исправляем неправильные пути к assets
    if (details.url.startsWith('file:///C:/assets/')) {
      const fileName = path.basename(details.url)
      const correctPath = path.join(process.resourcesPath || __dirname, '../dist/assets', fileName)
      console.log('🔧 Redirecting asset:', details.url, '-> file://' + correctPath)
      callback({ redirectURL: 'file://' + correctPath })
    } else {
      callback({})
    }
  })

  // Добавляем заголовки для ngrok запросов
  mainWindow.webContents.session.webRequest.onBeforeSendHeaders((details, callback) => {
    // Добавляем заголовки для обхода ngrok предупреждения
    if (details.url.includes('ngrok-free.dev') || details.url.includes('ngrok.io')) {
      console.log('🔧 Adding ngrok headers for:', details.url)
      details.requestHeaders['ngrok-skip-browser-warning'] = 'true'
      // User-Agent нельзя устанавливать через JavaScript - браузер блокирует
    }
    
    callback({ requestHeaders: details.requestHeaders })
  })

  // Обработка ошибок загрузки ресурсов
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    console.error('Failed to load:', errorCode, errorDescription, validatedURL)
    
    // Показываем простую страницу с ошибкой
    const errorHtml = `
      <html>
        <head><title>SpeakAz - Ошибка загрузки</title></head>
        <body style="font-family: Arial; padding: 50px; text-align: center;">
          <h1>SpeakAz</h1>
          <h2>Ошибка загрузки приложения</h2>
          <p>Код ошибки: ${errorCode}</p>
          <p>Описание: ${errorDescription}</p>
          <p>URL: ${validatedURL}</p>
          <button onclick="location.reload()">Попробовать снова</button>
        </body>
      </html>
    `
    mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(errorHtml)}`)
  })

  // Показываем окно когда оно готово
  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
    
    // Открываем DevTools только в режиме разработки
    if (isDev) {
      mainWindow.webContents.openDevTools({ mode: 'detach' })
    }
  })

  // Добавляем обработчики для диагностики
  mainWindow.webContents.on('dom-ready', () => {
    console.log('✅ DOM ready')
  })

  mainWindow.webContents.on('did-finish-load', () => {
    console.log('✅ Page finished loading')
    
    // Проверяем, что загрузилось
    mainWindow.webContents.executeJavaScript(`
      console.log('🔍 Document title:', document.title);
      console.log('🔍 Document body innerHTML length:', document.body.innerHTML.length);
      console.log('🔍 Scripts count:', document.scripts.length);
      console.log('🔍 React root element:', document.getElementById('root'));
      
      // Проверяем загрузку скриптов
      Array.from(document.scripts).forEach((script, index) => {
        console.log('📜 Script', index, ':', script.src || 'inline', script.type);
      });
    `)
  })

  // Обработка закрытия окна
  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault()
      mainWindow.hide()
      
      // Показываем уведомление при первом сворачивании в трей
      if (process.platform === 'win32') {
        tray.displayBalloon({
          iconType: 'info',
          title: 'SpeakAz',
          content: 'Приложение продолжает работать в фоне. Кликните на иконку в трее для возврата.'
        })
      }
    }
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  // Обработка внешних ссылок
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })
}

function createTray() {
  // Создаем иконку в системном трее
  let trayIconPath
  if (isDev) {
    trayIconPath = path.join(__dirname, 'assets', 'tray-icon.png')
  } else {
    // В продакшене используем встроенную иконку Electron
    trayIconPath = path.join(process.resourcesPath, 'assets', 'tray-icon.png')
  }
  
  let trayIcon
  try {
    trayIcon = nativeImage.createFromPath(trayIconPath).resize({ width: 16, height: 16 })
  } catch (error) {
    // Fallback - создаем простую иконку программно
    trayIcon = nativeImage.createEmpty()
  }
  
  tray = new Tray(trayIcon)
  
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Показать SpeakAz',
      click: () => {
        mainWindow.show()
        mainWindow.focus()
      }
    },
    {
      label: 'Настройки',
      click: () => {
        // TODO: Открыть окно настроек
        mainWindow.show()
        mainWindow.focus()
        mainWindow.webContents.send('open-settings')
      }
    },
    { type: 'separator' },
    {
      label: 'О программе',
      click: () => {
        dialog.showMessageBox(mainWindow, {
          type: 'info',
          title: 'О программе SpeakAz',
          message: 'SpeakAz Desktop',
          detail: 'Голосовые чаты в реальном времени\nВерсия: 1.0.0\nРазработано с ❤️'
        })
      }
    },
    {
      label: 'Выход',
      click: () => {
        isQuitting = true
        app.quit()
      }
    }
  ])
  
  tray.setToolTip('SpeakAz - Голосовые чаты')
  tray.setContextMenu(contextMenu)
  
  // Двойной клик по трею показывает окно
  tray.on('double-click', () => {
    mainWindow.show()
    mainWindow.focus()
  })
}

function createMenu() {
  const template = [
    {
      label: 'Файл',
      submenu: [
        {
          label: 'Новая комната',
          accelerator: 'CmdOrCtrl+N',
          click: () => {
            mainWindow.webContents.send('create-room')
          }
        },
        {
          label: 'Присоединиться к комнате',
          accelerator: 'CmdOrCtrl+J',
          click: () => {
            mainWindow.webContents.send('join-room')
          }
        },
        { type: 'separator' },
        {
          label: 'Настройки',
          accelerator: 'CmdOrCtrl+,',
          click: () => {
            mainWindow.webContents.send('open-settings')
          }
        },
        { type: 'separator' },
        {
          label: 'Выход',
          accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
          click: () => {
            isQuitting = true
            app.quit()
          }
        }
      ]
    },
    {
      label: 'Правка',
      submenu: [
        { role: 'undo', label: 'Отменить' },
        { role: 'redo', label: 'Повторить' },
        { type: 'separator' },
        { role: 'cut', label: 'Вырезать' },
        { role: 'copy', label: 'Копировать' },
        { role: 'paste', label: 'Вставить' },
        { role: 'selectall', label: 'Выделить все' }
      ]
    },
    {
      label: 'Вид',
      submenu: [
        { role: 'reload', label: 'Перезагрузить' },
        { role: 'forceReload', label: 'Принудительная перезагрузка' },
        { role: 'toggleDevTools', label: 'Инструменты разработчика' },
        { type: 'separator' },
        { role: 'resetZoom', label: 'Сбросить масштаб' },
        { role: 'zoomIn', label: 'Увеличить' },
        { role: 'zoomOut', label: 'Уменьшить' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: 'Полный экран' }
      ]
    },
    {
      label: 'Окно',
      submenu: [
        { role: 'minimize', label: 'Свернуть' },
        { role: 'close', label: 'Закрыть' }
      ]
    },
    {
      label: 'Справка',
      submenu: [
        {
          label: 'О программе',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'О программе SpeakAz',
              message: 'SpeakAz Desktop',
              detail: 'Голосовые чаты в реальном времени\nВерсия: 1.0.0\nРазработано с ❤️'
            })
          }
        },
        {
          label: 'Горячие клавиши',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'Горячие клавиши',
              message: 'Управление SpeakAz',
              detail: 'Ctrl+N - Новая комната\nCtrl+J - Присоединиться\nCtrl+, - Настройки\nCtrl+Q - Выход'
            })
          }
        }
      ]
    }
  ]

  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)
}

// Обработчики событий приложения
app.whenReady().then(() => {
  console.log('🚀 App is ready, starting initialization...')
  console.log('🔧 isDev:', isDev)
  console.log('🔧 isPackaged:', app.isPackaged)
  console.log('📁 __dirname:', __dirname)
  console.log('📁 process.resourcesPath:', process.resourcesPath)
  
  // Настраиваем файловый протокол (если нужен)
  // setupFileProtocol()

  // Логируем структуру dist папки для диагностики
  const distPath = path.join(__dirname, '../dist')
  console.log('📁 Dist path:', distPath)
  console.log('📁 Dist exists:', fs.existsSync(distPath))
  
  if (fs.existsSync(distPath)) {
    console.log('📁 Dist contents:', fs.readdirSync(distPath))
    
    const assetsPath = path.join(distPath, 'assets')
    if (fs.existsSync(assetsPath)) {
      console.log('📁 Assets contents:', fs.readdirSync(assetsPath))
    }
  } else {
    console.error('❌ Dist folder not found! This will cause loading issues.')
  }

  try {
    createWindow()
    createTray()
    createMenu()
    
    // Запускаем мониторинг памяти
    startMemoryMonitoring()
    
    console.log('✅ All components initialized successfully')
  } catch (error) {
    console.error('❌ Error during initialization:', error)
    
    // Показываем диалог с ошибкой
    dialog.showErrorBox('Ошибка запуска SpeakAz', 
      `Не удалось запустить приложение:\n\n${error.message}\n\nПожалуйста, переустановите приложение.`)
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    } else {
      mainWindow.show()
      mainWindow.focus()
    }
  })
}).catch(error => {
  console.error('❌ Fatal error during app ready:', error)
  dialog.showErrorBox('Критическая ошибка', 
    `Не удалось инициализировать приложение:\n\n${error.message}`)
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  isQuitting = true
  
  // Останавливаем мониторинг памяти
  if (memoryMonitorTimer) {
    console.log('🧠 Stopping memory monitoring...')
    clearInterval(memoryMonitorTimer)
    memoryMonitorTimer = null
  }
  
  // Закрываем HTTP сервер
  if (localServer) {
    console.log('🔌 Closing local server...')
    localServer.close()
    localServer = null
  }
})

// IPC обработчики для взаимодействия с рендер процессом
ipcMain.handle('get-app-version', () => {
  return app.getVersion()
})

ipcMain.handle('show-notification', (event, title, body) => {
  new Notification({ title, body }).show()
})

ipcMain.handle('minimize-to-tray', () => {
  mainWindow.hide()
})

ipcMain.handle('quit-app', () => {
  isQuitting = true
  app.quit()
})

// Автоматические обновления (для будущего использования)
if (!isDev) {
  // TODO: Настроить автообновления
  console.log('Production mode - auto-updater can be configured here')
}
