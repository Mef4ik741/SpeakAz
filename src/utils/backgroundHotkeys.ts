// Утилиты для работы с горячими клавишами в фоновом режиме
// Использует localStorage для синхронизации между вкладками

interface BackgroundHotkeyEvent {
  key: string;
  timestamp: number;
  action: string;
}

const BACKGROUND_HOTKEY_KEY = 'speakaz_background_hotkey';
const HOTKEY_EXPIRY_MS = 1000; // События старше 1 секунды игнорируются

// Отправляет событие горячей клавиши через localStorage
export const sendBackgroundHotkeyEvent = (key: string, action: string) => {
  const event: BackgroundHotkeyEvent = {
    key,
    action,
    timestamp: Date.now()
  };
  
  localStorage.setItem(BACKGROUND_HOTKEY_KEY, JSON.stringify(event));
  console.log('🔥 Background hotkey event sent:', event);
};

// Слушает события горячих клавиш из других вкладок/окон
export const listenForBackgroundHotkeyEvents = (callback: (key: string, action: string) => void) => {
  const handleStorageChange = (event: StorageEvent) => {
    if (event.key === BACKGROUND_HOTKEY_KEY && event.newValue) {
      try {
        const hotkeyEvent: BackgroundHotkeyEvent = JSON.parse(event.newValue);
        
        // Проверяем что событие не слишком старое
        if (Date.now() - hotkeyEvent.timestamp < HOTKEY_EXPIRY_MS) {
          console.log('🔥 Background hotkey event received:', hotkeyEvent);
          callback(hotkeyEvent.key, hotkeyEvent.action);
        } else {
          console.log('🔥 Background hotkey event expired, ignoring');
        }
      } catch (error) {
        console.error('🔥 Error parsing background hotkey event:', error);
      }
    }
  };

  window.addEventListener('storage', handleStorageChange);
  
  return () => {
    window.removeEventListener('storage', handleStorageChange);
  };
};

// Проверяет, поддерживает ли браузер фоновые события
export const supportsBackgroundEvents = (): boolean => {
  // В большинстве браузеров это не поддерживается по соображениям безопасности
  return false;
};

// Альтернативное решение: использование Broadcast Channel API
export class BackgroundHotkeyChannel {
  private channel: BroadcastChannel | null = null;
  private callback: ((key: string, action: string) => void) | null = null;

  constructor() {
    if (typeof BroadcastChannel !== 'undefined') {
      this.channel = new BroadcastChannel('speakaz-hotkeys');
      console.log('🔥 BroadcastChannel created for background hotkeys');
    } else {
      console.log('🔥 BroadcastChannel not supported, falling back to localStorage');
    }
  }

  // Отправляет событие горячей клавиши
  send(key: string, action: string) {
    const event = { key, action, timestamp: Date.now() };
    
    if (this.channel) {
      this.channel.postMessage(event);
      console.log('🔥 Hotkey event sent via BroadcastChannel:', event);
    } else {
      // Fallback к localStorage
      sendBackgroundHotkeyEvent(key, action);
    }
  }

  // Слушает события горячих клавиш
  listen(callback: (key: string, action: string) => void) {
    this.callback = callback;
    
    if (this.channel) {
      this.channel.onmessage = (event) => {
        const { key, action, timestamp } = event.data;
        
        if (Date.now() - timestamp < HOTKEY_EXPIRY_MS) {
          console.log('🔥 Hotkey event received via BroadcastChannel:', event.data);
          callback(key, action);
        }
      };
    } else {
      // Fallback к localStorage
      return listenForBackgroundHotkeyEvents(callback);
    }
  }

  // Закрывает канал
  close() {
    if (this.channel) {
      this.channel.close();
      this.channel = null;
    }
  }
}

// Создает уведомление пользователю о ограничениях браузера
export const showBrowserLimitationNotice = () => {
  console.warn(`
🔥 ОГРАНИЧЕНИЯ БРАУЗЕРА:
Веб-браузеры не поддерживают истинно глобальные горячие клавиши по соображениям безопасности.
Горячие клавиши будут работать только когда:
1. Окно браузера в фокусе
2. Вкладка активна
3. Курсор не в поле ввода

Для истинно глобальных горячих клавиш используйте Electron версию приложения.
  `);
};

// Проверяет возможности браузера и показывает соответствующие уведомления
export const checkBrowserCapabilities = () => {
  const capabilities = {
    broadcastChannel: typeof BroadcastChannel !== 'undefined',
    serviceWorker: 'serviceWorker' in navigator,
    webWorker: typeof Worker !== 'undefined',
    localStorage: typeof localStorage !== 'undefined'
  };

  console.log('🔥 Browser capabilities for background hotkeys:', capabilities);
  
  if (!capabilities.broadcastChannel && !capabilities.localStorage) {
    console.warn('🔥 Limited background hotkey support - no communication methods available');
  }

  return capabilities;
};
