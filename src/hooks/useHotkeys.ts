import { useEffect, useCallback, useRef } from 'react';

export interface HotkeyConfig {
  key: string;
  ctrl?: boolean;
  alt?: boolean;
  shift?: boolean;
  callback: () => void;
  description: string;
}

// Проверяем, работаем ли мы в Electron
const isElectron = () => {
  return typeof window !== 'undefined' && window.process && window.process.type === 'renderer';
};

export const useHotkeys = (hotkeys: HotkeyConfig[]) => {
  const hotkeyMapRef = useRef<Map<string, HotkeyConfig>>(new Map());
  const electronHotkeysRef = useRef<string[]>([]);

  // Создаем карту горячих клавиш
  useEffect(() => {
    hotkeyMapRef.current.clear();
    hotkeys.forEach(hotkey => {
      const key = createHotkeyKey(hotkey);
      hotkeyMapRef.current.set(key, hotkey);
    });
  }, [hotkeys]);

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    // Игнорируем если фокус на input/textarea (но НЕ если браузер свернут)
    const target = event.target as HTMLElement;
    const isInputFocused = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.contentEditable === 'true';
    
    // Если браузер в фокусе И фокус на поле ввода - игнорируем
    // Если браузер НЕ в фокусе (свернут) - обрабатываем горячие клавиши в любом случае
    if (document.hasFocus() && isInputFocused) {
      return;
    }

    const pressedKey = createKeyFromEvent(event);
    const hotkey = hotkeyMapRef.current.get(pressedKey);

    if (hotkey) {
      event.preventDefault();
      event.stopPropagation();
      
      const focusState = document.hasFocus() ? 'focused' : 'background';
      const visibilityState = document.visibilityState;
      
      console.log(`🔥 Hotkey triggered: ${pressedKey} (${hotkey.description}) - Window: ${focusState}, Page: ${visibilityState}`);
      
      // Выполняем callback
      try {
        hotkey.callback();
      } catch (error) {
        console.error('🔥 Error executing hotkey callback:', error);
      }
    }
  }, []);

  // Обработчик для Electron глобальных горячих клавиш
  const handleElectronHotkey = useCallback((hotkeyString: string) => {
    const hotkey = hotkeyMapRef.current.get(hotkeyString);
    if (hotkey) {
      console.log('🔥 Electron Global Hotkey triggered:', hotkeyString, hotkey.description);
      hotkey.callback();
    }
  }, []);

  useEffect(() => {
    // Веб-браузер: используем обычные события клавиатуры
    const handleKeyDownCapture = (event: KeyboardEvent) => handleKeyDown(event);
    const handleVisibilityChange = () => {
      // Когда страница становится видимой/невидимой, переустанавливаем слушатели
      console.log('🔥 Page visibility changed:', document.visibilityState);
      
      // Попытка переустановить слушатели при изменении видимости
      if (document.visibilityState === 'visible') {
        console.log('🔥 Page became visible - attempting to restore hotkey functionality');
        // Переустанавливаем слушатели
        setTimeout(() => {
          document.addEventListener('keydown', handleKeyDownCapture, true);
          window.addEventListener('keydown', handleKeyDownCapture, true);
        }, 100);
      }
    };

    const handleWindowFocus = () => {
      console.log('🔥 Window focused - hotkeys active');
    };

    const handleWindowBlur = () => {
      console.log('🔥 Window blurred - attempting to maintain hotkeys');
      
      // Попытка сохранить функциональность при потере фокуса
      // Используем setTimeout для попытки "захватить" события
      setTimeout(() => {
        console.log('🔥 Attempting to maintain background hotkey functionality');
      }, 100);
    };

    // Добавляем слушатели на разных уровнях для максимального покрытия
    document.addEventListener('keydown', handleKeyDownCapture, true); // capture phase
    window.addEventListener('keydown', handleKeyDownCapture, true);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleWindowFocus);
    window.addEventListener('blur', handleWindowBlur);

    // Дополнительные слушатели для попытки работы в фоне
    const handleDocumentKeyDown = (event: KeyboardEvent) => {
      handleKeyDown(event);
    };
    
    const handleBodyKeyDown = (event: KeyboardEvent) => {
      handleKeyDown(event);
    };
    
    // Используем passive: false для возможности preventDefault
    document.addEventListener('keydown', handleDocumentKeyDown, { passive: false, capture: true });
    document.body?.addEventListener('keydown', handleBodyKeyDown, { passive: false, capture: true });
    
    // Попытка использовать глобальные события
    if (typeof window !== 'undefined') {
      const handleGlobalKeyDown = (event: KeyboardEvent) => {
        console.log('🔥 Global keydown detected:', event.key, 'Focus:', document.hasFocus(), 'Visibility:', document.visibilityState);
        handleKeyDown(event);
      };
      
      // Добавляем на самый верхний уровень
      window.addEventListener('keydown', handleGlobalKeyDown, { passive: false, capture: true });
    }

    // Если это Electron, регистрируем глобальные горячие клавиши
    if (isElectron() && window.electronAPI) {
      const electronAPI = window.electronAPI as any; // Временное решение для типов
      
      if (electronAPI.registerGlobalShortcut) {
        console.log('🔥 Registering Electron global shortcuts');
        
        // Очищаем старые горячие клавиши
        electronHotkeysRef.current.forEach(shortcut => {
          if (electronAPI.unregisterGlobalShortcut) {
            electronAPI.unregisterGlobalShortcut(shortcut);
          }
        });
        electronHotkeysRef.current = [];

        // Регистрируем новые
        hotkeys.forEach(hotkey => {
          const electronShortcut = convertToElectronShortcut(hotkey);
          if (electronShortcut) {
            electronAPI.registerGlobalShortcut(electronShortcut, () => {
              handleElectronHotkey(createHotkeyKey(hotkey));
            });
            electronHotkeysRef.current.push(electronShortcut);
            console.log('🔥 Registered global shortcut:', electronShortcut);
          }
        });
      }
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDownCapture, true);
      window.removeEventListener('keydown', handleKeyDownCapture, true);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleWindowFocus);
      window.removeEventListener('blur', handleWindowBlur);
      document.removeEventListener('keydown', handleDocumentKeyDown, true);
      document.body?.removeEventListener('keydown', handleBodyKeyDown, true);

      // Очищаем Electron горячие клавиши
      if (isElectron() && window.electronAPI) {
        const electronAPI = window.electronAPI as any;
        if (electronAPI.unregisterGlobalShortcut) {
          electronHotkeysRef.current.forEach(shortcut => {
            electronAPI.unregisterGlobalShortcut(shortcut);
          });
          electronHotkeysRef.current = [];
        }
      }
    };
  }, [handleKeyDown, handleElectronHotkey, hotkeys]);
};

// Конвертирует HotkeyConfig в формат Electron
const convertToElectronShortcut = (hotkey: HotkeyConfig): string | null => {
  const parts: string[] = [];
  
  if (hotkey.ctrl) parts.push('CommandOrControl');
  if (hotkey.alt) parts.push('Alt');
  if (hotkey.shift) parts.push('Shift');
  
  // Конвертируем клавиши в формат Electron
  let key = hotkey.key;
  switch (key.toLowerCase()) {
    case ' ':
    case 'space':
      key = 'Space';
      break;
    case 'f1': case 'f2': case 'f3': case 'f4': case 'f5': case 'f6':
    case 'f7': case 'f8': case 'f9': case 'f10': case 'f11': case 'f12':
      key = key.toUpperCase();
      break;
    default:
      key = key.toUpperCase();
  }
  
  parts.push(key);
  return parts.join('+');
};

// Создает строковый ключ для горячей клавиши
export const createHotkeyKey = (hotkey: HotkeyConfig): string => {
  const parts: string[] = [];
  if (hotkey.ctrl) parts.push('ctrl');
  if (hotkey.alt) parts.push('alt');
  if (hotkey.shift) parts.push('shift');
  parts.push(hotkey.key.toLowerCase());
  return parts.join('+');
};

// Создает ключ из события клавиатуры
const createKeyFromEvent = (event: KeyboardEvent): string => {
  const parts: string[] = [];
  if (event.ctrlKey) parts.push('ctrl');
  if (event.altKey) parts.push('alt');
  if (event.shiftKey) parts.push('shift');
  parts.push(event.key.toLowerCase());
  return parts.join('+');
};

// Парсит строку горячей клавиши в объект
export const parseHotkeyString = (hotkeyString: string): Omit<HotkeyConfig, 'callback' | 'description'> => {
  const parts = hotkeyString.toLowerCase().split('+');
  const key = parts[parts.length - 1];
  
  return {
    key,
    ctrl: parts.includes('ctrl'),
    alt: parts.includes('alt'),
    shift: parts.includes('shift')
  };
};

// Форматирует горячую клавишу для отображения
export const formatHotkeyDisplay = (hotkey: HotkeyConfig | string): string => {
  let config: Omit<HotkeyConfig, 'callback' | 'description'>;
  
  if (typeof hotkey === 'string') {
    config = parseHotkeyString(hotkey);
  } else {
    config = hotkey;
  }

  const parts: string[] = [];
  if (config.ctrl) parts.push('Ctrl');
  if (config.alt) parts.push('Alt');
  if (config.shift) parts.push('Shift');
  parts.push(config.key.toUpperCase());
  
  return parts.join(' + ');
};

// Проверяет валидность горячей клавиши
export const isValidHotkey = (hotkeyString: string): boolean => {
  if (!hotkeyString || hotkeyString.trim() === '') return false;
  
  const parts = hotkeyString.toLowerCase().split('+');
  const key = parts[parts.length - 1];
  
  // Проверяем что есть основная клавиша
  if (!key || key.trim() === '') return false;
  
  // Проверяем что клавиша не является модификатором
  const modifiers = ['ctrl', 'alt', 'shift'];
  if (modifiers.includes(key)) return false;
  
  return true;
};

// Список рекомендуемых клавиш для микрофона
export const RECOMMENDED_MIC_KEYS = [
  'F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12',
  'Space', 'Tab', 'CapsLock', 'Insert', 'Delete', 'Home', 'End', 'PageUp', 'PageDown',
  'Backquote', 'Minus', 'Equal', 'BracketLeft', 'BracketRight', 'Backslash',
  'Semicolon', 'Quote', 'Comma', 'Period', 'Slash'
];
