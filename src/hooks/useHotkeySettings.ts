import { useState, useEffect } from 'react';

interface HotkeySettings {
  micHotkey: string;
  deafenHotkey: string;
}

const DEFAULT_SETTINGS: HotkeySettings = {
  micHotkey: 'f1', // F1 по умолчанию для микрофона
  deafenHotkey: 'f2' // F2 по умолчанию для звука
};

const STORAGE_KEY = 'speakaz_hotkey_settings';

export const useHotkeySettings = () => {
  const [settings, setSettings] = useState<HotkeySettings>(DEFAULT_SETTINGS);
  const [isLoaded, setIsLoaded] = useState(false);

  // Загружаем настройки из localStorage при инициализации
  useEffect(() => {
    try {
      const savedSettings = localStorage.getItem(STORAGE_KEY);
      if (savedSettings) {
        const parsed = JSON.parse(savedSettings) as HotkeySettings;
        console.log('🔥 Loaded hotkey settings from localStorage:', parsed);
        setSettings(parsed);
      } else {
        console.log('🔥 No saved hotkey settings found, using defaults:', DEFAULT_SETTINGS);
        setSettings(DEFAULT_SETTINGS);
      }
    } catch (error) {
      console.error('🔥 Failed to load hotkey settings from localStorage:', error);
      setSettings(DEFAULT_SETTINGS);
    } finally {
      setIsLoaded(true);
    }
  }, []);

  // Сохраняем настройки в localStorage
  const saveSettings = (newSettings: HotkeySettings) => {
    try {
      const settingsString = JSON.stringify(newSettings);
      localStorage.setItem(STORAGE_KEY, settingsString);
      setSettings(newSettings);
      console.log('🔥 Saved hotkey settings to localStorage:', newSettings);
      console.log('🔥 localStorage key:', STORAGE_KEY);
      console.log('🔥 localStorage value:', settingsString);
      
      // Проверяем, что настройки действительно сохранились
      const savedValue = localStorage.getItem(STORAGE_KEY);
      console.log('🔥 Verification - saved value from localStorage:', savedValue);
    } catch (error) {
      console.error('🔥 Failed to save hotkey settings to localStorage:', error);
    }
  };

  // Обновляем горячую клавишу микрофона
  const setMicHotkey = (hotkey: string) => {
    console.log('🔥 setMicHotkey called with:', hotkey);
    const newSettings = { ...settings, micHotkey: hotkey };
    console.log('🔥 New settings for mic:', newSettings);
    saveSettings(newSettings);
  };

  // Обновляем горячую клавишу звука
  const setDeafenHotkey = (hotkey: string) => {
    console.log('🔥 setDeafenHotkey called with:', hotkey);
    const newSettings = { ...settings, deafenHotkey: hotkey };
    console.log('🔥 New settings for deafen:', newSettings);
    saveSettings(newSettings);
  };

  // Сбрасываем настройки к значениям по умолчанию
  const resetSettings = () => {
    saveSettings(DEFAULT_SETTINGS);
    console.log('🔥 Reset hotkey settings to defaults');
  };

  // Проверяем, отличаются ли текущие настройки от сохраненных
  const hasUnsavedChanges = (tempSettings: HotkeySettings): boolean => {
    return tempSettings.micHotkey !== settings.micHotkey || 
           tempSettings.deafenHotkey !== settings.deafenHotkey;
  };

  return {
    settings,
    isLoaded,
    setMicHotkey,
    setDeafenHotkey,
    saveSettings,
    resetSettings,
    hasUnsavedChanges
  };
};
