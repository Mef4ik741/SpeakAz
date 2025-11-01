const { app, BrowserWindow, Menu, Tray, nativeImage, ipcMain, shell, dialog, protocol } = require('electron')
const path = require('path')
const fs = require('fs')
const express = require('express')
const http = require('http')

// Определяем режим разработки без внешней зависимости
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged

// Глобальные переменные
let mainWindow
let tray
let isQuitting = false

// Настройка безопасности
process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true'

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
    
    console.log('📁 Serving static files from:', distPath)
    
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
      console.log('🌐 Local server started:', serverUrl)
      resolve(serverUrl)
    })
    
    localServer.on('error', (err) => {
      console.error('❌ Local server error:', err)
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
  // Создаем главное окно приложения
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
      experimentalFeatures: true
    },
    titleBarStyle: 'default',
    show: false, // Не показываем окно сразу
    autoHideMenuBar: false, // Показываем меню
  })

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
    
    // Принудительно открываем DevTools для диагностики
    mainWindow.webContents.openDevTools({ mode: 'detach' })
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
  }

  createWindow()
  createTray()
  createMenu()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    } else {
      mainWindow.show()
      mainWindow.focus()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  isQuitting = true
  
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
