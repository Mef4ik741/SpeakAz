// Утилиты для воспроизведения звуков в комнатах

// URL звуков
const SOUNDS = {
  JOIN: 'https://res.cloudinary.com/duygiwcsz/video/upload/v1762197971/piuw_gaiq0m.mp3',
  LEAVE: 'https://res.cloudinary.com/duygiwcsz/video/upload/v1762197954/ack_mp3cut.net_1_te3h7t.mp3'
}

// Кэш для предзагруженных аудио элементов
const audioCache = new Map<string, HTMLAudioElement>()

/**
 * Предзагружает звуковые файлы для быстрого воспроизведения
 */
export function preloadSounds(): void {
  Object.entries(SOUNDS).forEach(([key, url]) => {
    if (!audioCache.has(key)) {
      const audio = new Audio(url)
      audio.preload = 'auto'
      audio.volume = 0.6 // Устанавливаем громкость 60%
      
      // Обработка ошибок загрузки
      audio.addEventListener('error', (e) => {
        console.warn(`Failed to preload sound ${key}:`, e)
      })
      
      // Логируем успешную загрузку
      audio.addEventListener('canplaythrough', () => {
        console.log(`✅ Sound preloaded: ${key}`)
      })
      
      audioCache.set(key, audio)
    }
  })
}

/**
 * Воспроизводит звук входа в комнату
 */
export function playJoinSound(): void {
  playSound('JOIN')
}

/**
 * Воспроизводит звук выхода из комнаты
 */
export function playLeaveSound(): void {
  playSound('LEAVE')
}

/**
 * Воспроизводит указанный звук
 */
function playSound(soundKey: string): void {
  try {
    const audio = audioCache.get(soundKey)
    
    if (audio) {
      // Сбрасываем время воспроизведения на начало
      audio.currentTime = 0
      
      // Воспроизводим звук
      const playPromise = audio.play()
      
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            console.log(`🔊 Playing sound: ${soundKey}`)
          })
          .catch((error) => {
            console.warn(`Failed to play sound ${soundKey}:`, error)
          })
      }
    } else {
      console.warn(`Sound not found in cache: ${soundKey}`)
      
      // Fallback: создаем новый аудио элемент
      const fallbackAudio = new Audio(SOUNDS[soundKey as keyof typeof SOUNDS])
      fallbackAudio.volume = 0.6
      fallbackAudio.play().catch(e => {
        console.warn(`Fallback sound play failed:`, e)
      })
    }
  } catch (error) {
    console.error(`Error playing sound ${soundKey}:`, error)
  }
}

/**
 * Устанавливает громкость для всех звуков
 */
export function setSoundVolume(volume: number): void {
  const clampedVolume = Math.max(0, Math.min(1, volume))
  
  audioCache.forEach((audio) => {
    audio.volume = clampedVolume
  })
  
  console.log(`🔊 Sound volume set to: ${Math.round(clampedVolume * 100)}%`)
}

/**
 * Отключает все звуки
 */
export function muteSounds(): void {
  setSoundVolume(0)
}

/**
 * Включает звуки с указанной громкостью
 */
export function unmuteSounds(volume: number = 0.6): void {
  setSoundVolume(volume)
}

/**
 * Очищает кэш звуков (для освобождения памяти)
 */
export function clearSoundCache(): void {
  audioCache.forEach((audio) => {
    audio.pause()
    audio.src = ''
  })
  audioCache.clear()
  console.log('🧹 Sound cache cleared')
}
