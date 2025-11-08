import React, { useState, useEffect } from 'react';
import { 
  formatHotkeyDisplay, 
  isValidHotkey, 
  parseHotkeyString, 
  RECOMMENDED_MIC_KEYS,
  HotkeyConfig 
} from '../hooks/useHotkeys';
import { Keyboard, Save, RotateCcw, AlertCircle, CheckCircle } from 'lucide-react';
import HotkeyLimitations from './HotkeyLimitations';

interface HotkeySettingsProps {
  currentMicHotkey: string;
  currentDeafenHotkey: string;
  onMicHotkeyChange: (hotkey: string) => void;
  onDeafenHotkeyChange: (hotkey: string) => void;
  onSave: () => void;
  onReset: () => void;
}

const HotkeySettings: React.FC<HotkeySettingsProps> = ({
  currentMicHotkey,
  currentDeafenHotkey,
  onMicHotkeyChange,
  onDeafenHotkeyChange,
  onSave,
  onReset
}) => {
  const [isRecordingMic, setIsRecordingMic] = useState(false);
  const [isRecordingDeafen, setIsRecordingDeafen] = useState(false);
  const [tempMicHotkey, setTempMicHotkey] = useState(currentMicHotkey);
  const [tempDeafenHotkey, setTempDeafenHotkey] = useState(currentDeafenHotkey);
  const [recordedKeys, setRecordedKeys] = useState<string[]>([]);

  useEffect(() => {
    console.log('🔥 HotkeySettings: Syncing with current settings:', {
      currentMicHotkey,
      currentDeafenHotkey
    });
    setTempMicHotkey(currentMicHotkey);
    setTempDeafenHotkey(currentDeafenHotkey);
  }, [currentMicHotkey, currentDeafenHotkey]);

  const handleKeyDown = (event: KeyboardEvent) => {
    if (!isRecordingMic && !isRecordingDeafen) return;

    event.preventDefault();
    event.stopPropagation();

    const keys: string[] = [];
    if (event.ctrlKey) keys.push('Ctrl');
    if (event.altKey) keys.push('Alt');
    if (event.shiftKey) keys.push('Shift');
    
    // Добавляем основную клавишу если это не модификатор
    if (!['Control', 'Alt', 'Shift'].includes(event.key)) {
      keys.push(event.key);
      
      // Создаем строку горячей клавиши
      const hotkeyString = keys.join('+').toLowerCase();
      
      if (isRecordingMic) {
        console.log('🎤 Recording mic hotkey:', hotkeyString);
        setTempMicHotkey(hotkeyString);
        setIsRecordingMic(false);
        console.log('🎤 New mic hotkey recorded and set to temp:', hotkeyString);
        
        // Автоматически сохраняем новую клавишу микрофона
        onMicHotkeyChange(hotkeyString);
        console.log('🎤 Auto-saved mic hotkey:', hotkeyString);
      } else if (isRecordingDeafen) {
        console.log('🔊 Recording deafen hotkey:', hotkeyString);
        setTempDeafenHotkey(hotkeyString);
        setIsRecordingDeafen(false);
        console.log('🔊 New deafen hotkey recorded and set to temp:', hotkeyString);
        
        // Автоматически сохраняем новую клавишу звука
        onDeafenHotkeyChange(hotkeyString);
        console.log('🔊 Auto-saved deafen hotkey:', hotkeyString);
      }
      
      setRecordedKeys([]);
    } else {
      setRecordedKeys(keys);
    }
  };

  const handleKeyUp = (event: KeyboardEvent) => {
    if (!isRecordingMic && !isRecordingDeafen) return;
    
    // Если отпустили все модификаторы, очищаем записанные клавиши
    if (!event.ctrlKey && !event.altKey && !event.shiftKey) {
      setRecordedKeys([]);
    }
  };

  useEffect(() => {
    if (isRecordingMic || isRecordingDeafen) {
      document.addEventListener('keydown', handleKeyDown);
      document.addEventListener('keyup', handleKeyUp);
      
      return () => {
        document.removeEventListener('keydown', handleKeyDown);
        document.removeEventListener('keyup', handleKeyUp);
      };
    }
  }, [isRecordingMic, isRecordingDeafen]);

  const startRecordingMic = () => {
    setIsRecordingMic(true);
    setIsRecordingDeafen(false);
    setRecordedKeys([]);
    console.log('🎤 Started recording mic hotkey...');
  };

  const startRecordingDeafen = () => {
    setIsRecordingDeafen(true);
    setIsRecordingMic(false);
    setRecordedKeys([]);
    console.log('🔊 Started recording deafen hotkey...');
  };

  const cancelRecording = () => {
    setIsRecordingMic(false);
    setIsRecordingDeafen(false);
    setRecordedKeys([]);
  };

  const handleSave = () => {
    // Сохраняем настройки через переданные функции
    onMicHotkeyChange(tempMicHotkey);
    onDeafenHotkeyChange(tempDeafenHotkey);
    
    console.log('🔥 Saving hotkey settings:', {
      micHotkey: tempMicHotkey,
      deafenHotkey: tempDeafenHotkey
    });
    
    onSave();
  };

  const handleReset = () => {
    onReset();
    setTempMicHotkey('');
    setTempDeafenHotkey('');
  };

  const isValidMicHotkey = isValidHotkey(tempMicHotkey);
  const isValidDeafenHotkey = isValidHotkey(tempDeafenHotkey);
  const hasChanges = tempMicHotkey !== currentMicHotkey || tempDeafenHotkey !== currentDeafenHotkey;

  return (
    <div className="hotkey-settings">
      <div className="hotkey-header">
        <Keyboard size={20} />
        <h3>⌨️ Настройка горячих клавиш</h3>
      </div>

      <div className="hotkey-item">
        <div className="hotkey-label">
          <span>🎤 Переключение микрофона:</span>
          <div className="hotkey-display">
            {isRecordingMic ? (
              <span className="recording">
                {recordedKeys.length > 0 ? recordedKeys.join(' + ') + ' + ...' : 'Нажмите клавишу...'}
              </span>
            ) : (
              <span className={`hotkey-value ${isValidMicHotkey ? 'valid' : 'invalid'}`}>
                {tempMicHotkey ? formatHotkeyDisplay(tempMicHotkey) : 'Не назначено'}
                {isValidMicHotkey ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
              </span>
            )}
          </div>
        </div>
        
        <div className="hotkey-controls">
          <button 
            onClick={startRecordingMic}
            disabled={isRecordingDeafen}
            className={`hotkey-btn ${isRecordingMic ? 'recording' : ''}`}
          >
            {isRecordingMic ? 'Запись...' : 'Записать'}
          </button>
          
          {isRecordingMic && (
            <button onClick={cancelRecording} className="hotkey-btn cancel">
              Отмена
            </button>
          )}
        </div>
      </div>

      <div className="hotkey-item">
        <div className="hotkey-label">
          <span>🔊 Переключение звука:</span>
          <div className="hotkey-display">
            {isRecordingDeafen ? (
              <span className="recording">
                {recordedKeys.length > 0 ? recordedKeys.join(' + ') + ' + ...' : 'Нажмите клавишу...'}
              </span>
            ) : (
              <span className={`hotkey-value ${isValidDeafenHotkey ? 'valid' : 'invalid'}`}>
                {tempDeafenHotkey ? formatHotkeyDisplay(tempDeafenHotkey) : 'Не назначено'}
                {isValidDeafenHotkey ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
              </span>
            )}
          </div>
        </div>
        
        <div className="hotkey-controls">
          <button 
            onClick={startRecordingDeafen}
            disabled={isRecordingMic}
            className={`hotkey-btn ${isRecordingDeafen ? 'recording' : ''}`}
          >
            {isRecordingDeafen ? 'Запись...' : 'Записать'}
          </button>
          
          {isRecordingDeafen && (
            <button onClick={cancelRecording} className="hotkey-btn cancel">
              Отмена
            </button>
          )}
        </div>
      </div>

      <div className="hotkey-recommendations">
        <h4>💡 Рекомендуемые клавиши:</h4>
        <div className="recommended-keys">
          {RECOMMENDED_MIC_KEYS.slice(0, 12).map(key => (
            <button
              key={key}
              onClick={() => {
                if (isRecordingMic) {
                  const hotkeyString = key.toLowerCase();
                  setTempMicHotkey(hotkeyString);
                  setIsRecordingMic(false);
                  
                  // Автоматически сохраняем выбранную клавишу микрофона
                  onMicHotkeyChange(hotkeyString);
                  console.log('🎤 Auto-saved recommended mic hotkey:', hotkeyString);
                } else if (isRecordingDeafen) {
                  const hotkeyString = key.toLowerCase();
                  setTempDeafenHotkey(hotkeyString);
                  setIsRecordingDeafen(false);
                  
                  // Автоматически сохраняем выбранную клавишу звука
                  onDeafenHotkeyChange(hotkeyString);
                  console.log('🔊 Auto-saved recommended deafen hotkey:', hotkeyString);
                }
              }}
              className="recommended-key"
              disabled={!isRecordingMic && !isRecordingDeafen}
            >
              {key}
            </button>
          ))}
        </div>
      </div>

      <div className="hotkey-actions">
        <button 
          onClick={handleSave}
          disabled={!hasChanges || (!isValidMicHotkey && !!tempMicHotkey) || (!isValidDeafenHotkey && !!tempDeafenHotkey)}
          className="hotkey-btn save"
        >
          <Save size={16} />
          Сохранить
        </button>
        
        <button onClick={handleReset} className="hotkey-btn reset">
          <RotateCcw size={16} />
          Сбросить
        </button>
      </div>

      <div className="hotkey-help">
        <h4>ℹ️ Справка:</h4>
        <ul>
          <li>Используйте функциональные клавиши (F1-F12) для лучшей совместимости</li>
          <li>Избегайте стандартных комбинаций браузера (Ctrl+T, Ctrl+W и т.д.)</li>
          <li>Комбинации с Ctrl/Alt/Shift работают во всех режимах</li>
          <li>Горячие клавиши не работают при фокусе на полях ввода</li>
        </ul>
      </div>

      <HotkeyLimitations />
    </div>
  );
};

export default HotkeySettings;
