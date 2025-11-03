import React, { useState, useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { roomAPI } from '../services/api'
import { Room, RoomParticipant } from '../types/Room'
import { useAuth } from '../contexts/AuthContext'
import roomWebSocketService from '../services/RoomWebSocketService'
import webRTCService from '../services/WebRTCService'
import { getUserIdFromToken } from '../utils/jwt'
import { preloadSounds, playJoinSound, playLeaveSound, clearSoundCache, setSoundVolume } from '../utils/soundUtils'
import { 
  Mic, 
  MicOff, 
  Volume2, 
  VolumeX, 
  LogOut, 
  Users, 
  Crown, 
  UserX,
  Copy,
  Settings
} from 'lucide-react'

interface RoomViewProps {
  room: Room
  onLeave: () => void
}

const RoomView: React.FC<RoomViewProps> = ({ room: initialRoom, onLeave }) => {
  const { user } = useAuth()
  const { roomKey: urlRoomKey } = useParams<{ roomKey: string }>()
  const [room, setRoom] = useState<Room>(initialRoom)
  const [participants, setParticipants] = useState<RoomParticipant[]>(room.participants || [])
  const [isMuted, setIsMuted] = useState(false)
  const [isDeafened, setIsDeafened] = useState(false)
  const [error, setError] = useState('')
  const [errorType, setErrorType] = useState<'general' | 'room-not-found'>('general')
  const [showSettings, setShowSettings] = useState(false)
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map())
  const [webRTCInitialized, setWebRTCInitialized] = useState(false)
  const [pendingParticipants, setPendingParticipants] = useState<RoomParticipant[]>([])
  const isInitializedRef = useRef(false)
  const heartbeatRef = useRef<NodeJS.Timeout>()
  const audioElementsRef = useRef<Map<string, HTMLAudioElement>>(new Map())
  const audioCleanupTimerRef = useRef<NodeJS.Timeout | null>(null)

  const currentUser = participants.find(p => p.userId === user?.id)
  const isOwner = currentUser?.isOwner || false

  // Функция для периодической очистки audio элементов
  const startAudioCleanup = () => {
    if (audioCleanupTimerRef.current) {
      clearInterval(audioCleanupTimerRef.current);
    }
    
    audioCleanupTimerRef.current = setInterval(() => {
      console.log('🧹 RoomView: Performing audio elements cleanup...');
      
      const deadElements: string[] = [];
      audioElementsRef.current.forEach((audioElement, userId) => {
        // Проверяем, есть ли соответствующий участник
        const participant = participants.find(p => p.userId === userId);
        
        if (!participant || audioElement.ended || audioElement.error) {
          console.log('🧹 RoomView: Found dead audio element for user:', userId);
          deadElements.push(userId);
        }
      });
      
      // Удаляем мертвые элементы
      deadElements.forEach(userId => {
        const audioElement = audioElementsRef.current.get(userId);
        if (audioElement) {
          console.log('🧹 RoomView: Cleaning up audio element for user:', userId);
          audioElement.pause();
          audioElement.srcObject = null;
          if (document.body.contains(audioElement)) {
            document.body.removeChild(audioElement);
          }
          audioElementsRef.current.delete(userId);
        }
      });
      
      if (deadElements.length > 0) {
        console.log('🧹 RoomView: Cleaned up', deadElements.length, 'audio elements');
      }
    }, 60000); // Каждую минуту
  };

  useEffect(() => {
    if (isInitializedRef.current) {
      console.log('RoomView: Already initialized, skipping');
      return; // Предотвращаем дублирование инициализации
    }
    
    // Проверяем авторизацию перед подключением WebSocket
    const token = localStorage.getItem('token');
    if (!token) {
      console.warn('RoomView: No auth token found, WebSocket will not connect');
      return;
    }

    console.log('RoomView: Auth token found, connecting WebSocket');
    isInitializedRef.current = true;

    // Предзагружаем звуки для быстрого воспроизведения
    console.log('🔊 Preloading room sounds...');
    preloadSounds();

    // WebSocket подключение к комнате (всегда используем room.roomKey, не URL параметр)
    const actualRoomKey = room.roomKey;
    console.log('RoomView: Using roomKey for WebSocket:', actualRoomKey);
    console.log('RoomView: URL roomKey (roomId):', urlRoomKey);
    console.log('RoomView: Actual roomKey from room object:', room.roomKey);
    
    // Проверяем валидность roomKey перед подключением
    if (!actualRoomKey || actualRoomKey.trim() === '') {
      console.error('RoomView: Invalid roomKey, cannot connect to WebSocket');
      setErrorType('room-not-found');
      setError('Неверный ключ комнаты. Перенаправление на список комнат...');
      setTimeout(() => onLeave(), 3000);
      return;
    }
    
    roomWebSocketService.joinRoom(actualRoomKey);

    // Инициализация WebRTC
    const initializeWebRTC = async () => {
      try {
        console.log('RoomView: Checking user for WebRTC initialization:', user);
        console.log('RoomView: User ID from context:', user?.id);
        
        // Получаем реальный userId из JWT токена
        const realUserId = getUserIdFromToken();
        console.log('RoomView: Real User ID from JWT:', realUserId);
        
        if (realUserId) {
          console.log('🔧 RoomView: Initializing WebRTC...');
          console.log('🔧 RoomView: WebRTC state before initialization:', webRTCService.getState());
          await webRTCService.initialize(actualRoomKey, realUserId);
          setWebRTCInitialized(true);
          console.log('🔧 RoomView: WebRTC initialized successfully');
          console.log('🔧 RoomView: WebRTC state after initialization:', webRTCService.getState());
          
          // Запускаем периодическую очистку audio элементов
          startAudioCleanup();

          // Setup WebRTC event handlers
          webRTCService.onRemoteStream((userId: string, stream: MediaStream) => {
            console.log('🎵 RoomView: Remote stream received from:', userId);
            console.log('🎵 RoomView: Stream tracks:', stream.getTracks().map(t => ({ kind: t.kind, enabled: t.enabled })));
            console.log('🎵 RoomView: Stream ID:', stream.id);
            console.log('🎵 RoomView: Stream active:', stream.active);
            
            setRemoteStreams(prev => {
              const newMap = new Map(prev.set(userId, stream));
              console.log('🎵 RoomView: Updated remote streams map size:', newMap.size);
              return newMap;
            });
            
            // Create audio element for remote stream (hidden)
            const audioElement = new Audio();
            audioElement.srcObject = stream;
            audioElement.autoplay = true;
            audioElement.volume = 1.0;
            audioElement.muted = false;
            audioElement.setAttribute('data-user-id', userId);
            
            console.log('🔊 Audio element created for user:', userId);
            console.log('🔊 Stream tracks:', stream.getTracks());
            console.log('🔊 Stream active:', stream.active);
            
            // Add event listeners for debugging
            audioElement.onloadedmetadata = () => {
              console.log('🔊 Audio metadata loaded for user:', userId);
            };
            
            audioElement.onplay = () => {
              console.log('🔊 Audio started playing for user:', userId);
            };
            
            audioElement.onerror = (error) => {
              console.error('🔊 Audio error for user:', userId, error);
            };
            
            // Try to play manually
            audioElement.play().then(() => {
              console.log('🔊 Audio play() succeeded for user:', userId);
            }).catch(error => {
              console.error('🔊 Audio play() failed for user:', userId, error);
            });
            
            audioElementsRef.current.set(userId, audioElement);
            
            // Добавляем в DOM, но делаем невидимым
            audioElement.style.display = 'none';
            audioElement.style.position = 'absolute';
            audioElement.style.left = '-9999px';
            document.body.appendChild(audioElement);
            
            // Дополнительная проверка аудио контекста
            if (window.AudioContext || (window as any).webkitAudioContext) {
              const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
              const audioContext = new AudioContext();
              console.log('🔊 Audio context state:', audioContext.state);
              
              if (audioContext.state === 'suspended') {
                audioContext.resume().then(() => {
                  console.log('🔊 Audio context resumed');
                }).catch(err => {
                  console.error('🔊 Failed to resume audio context:', err);
                });
              }
            }
          });

          webRTCService.onRemoteStreamRemoved((userId: string) => {
            console.log('RoomView: Remote stream removed from:', userId);
            setRemoteStreams(prev => {
              const newMap = new Map(prev);
              newMap.delete(userId);
              return newMap;
            });
            
            // Remove audio element
            const audioElement = audioElementsRef.current.get(userId);
            if (audioElement) {
              audioElement.pause();
              audioElement.srcObject = null;
              if (document.body.contains(audioElement)) {
                document.body.removeChild(audioElement);
              }
              audioElementsRef.current.delete(userId);
            }
          });

          webRTCService.onConnectionStateChange((userId: string, state: string) => {
            console.log('RoomView: Connection state changed for', userId, ':', state);
          });
        } else {
          console.warn('RoomView: Cannot initialize WebRTC - realUserId is missing');
          console.log('RoomView: User object:', user);
          console.log('RoomView: Token exists:', !!localStorage.getItem('token'));
        }
      } catch (error) {
        console.error('RoomView: Failed to initialize WebRTC:', error);
        setErrorType('general');
        setError('Не удалось получить доступ к микрофону. Проверьте разрешения браузера.');
      }
    };

    initializeWebRTC();

    // Обработчики WebSocket событий
    const handleParticipantJoined = (message: any) => {
      console.log('🎵 RoomView: Participant joined event received:', message);
      
      // Извлекаем userId из разных структур сообщения
      const userId = message.participant?.userId || message.userId;
      const username = message.participant?.username || message.username;
      const joinedAt = message.participant?.joinedAt || message.timestamp;
      
      console.log('🔍 Participant data extracted:', { userId, username, joinedAt });
      console.log('🔍 Original message.participant:', message.participant);
      
      if (!userId) {
        console.warn('RoomView: No userId found in participant_joined message');
        return;
      }
      
      // Проверяем, что у нас есть минимальные данные
      if (!username || username.trim() === '') {
        console.warn('RoomView: No username found in participant_joined message, skipping');
        return;
      }
      
      // Добавляем участника в состояние
      const participantData = {
        userId,
        username: username,
        joinedAt,
        isOwner: false,
        isMuted: false
      };
      
      setParticipants(prev => {
        const exists = prev.some(p => p.userId === userId);
        if (!exists) {
          console.log('🎵 RoomView: Adding new participant to state:', participantData);
          
          // Проигрываем звук входа (только если это не текущий пользователь)
          if (userId !== user?.id) {
            console.log('🔊 Playing join sound for participant:', username);
            playJoinSound();
          }
          
          return [...prev, participantData];
        }
        console.log('🎵 RoomView: Participant already exists in state');
        return prev;
      });
      
      // WebRTC сервис теперь обрабатывает participant_joined автоматически через WebSocket
      console.log('🎵 RoomView: WebRTC will handle this participant via WebSocket automatically');
    };

    const handleParticipantLeft = (message: any) => {
      console.log('🚪 RoomView: Participant left event received:', message);
      console.log('🚪 RoomView: Current participants before removal:', participants.map(p => ({ userId: p.userId, username: p.username })));
      
      // Найдем участника перед удалением для получения имени
      const leavingParticipant = participants.find(p => p.userId === message.userId);
      
      // Проигрываем звук выхода ПЕРЕД обновлением состояния (только если это не текущий пользователь)
      if (message.userId !== user?.id && leavingParticipant) {
        console.log('🔊 Playing leave sound for participant:', leavingParticipant.username);
        playLeaveSound();
      } else {
        console.log('🔊 Not playing leave sound - either current user or participant not found:', {
          isCurrentUser: message.userId === user?.id,
          participantFound: !!leavingParticipant,
          userId: message.userId,
          currentUserId: user?.id
        });
      }
      
      setParticipants(prev => {
        const filtered = prev.filter(p => p.userId !== message.userId);
        console.log('🚪 RoomView: Participants after removal:', filtered.map(p => ({ userId: p.userId, username: p.username })));
        return filtered;
      });
      
      // WebRTC соединения будут автоматически очищены при закрытии peer connection
      console.log('🚪 RoomView: Participant removed from UI, WebRTC cleanup will happen automatically');
    };

    const handleRoomJoined = (message: any) => {
      console.log('🎵 RoomView: Room joined event received:', message);
      
      // Устанавливаем флаг что пользователь успешно подключился к комнате
      // Используем roomId из URL для sessionStorage (для совместимости с RoomPage)
      const sessionKey = `room_session_${urlRoomKey}`;
      sessionStorage.setItem(sessionKey, 'true');
      console.log('🎵 RoomView: Set session storage for roomId:', urlRoomKey);
      
      // Обновляем список участников из сообщения
      if (message.participants && Array.isArray(message.participants)) {
        console.log('🎵 RoomView: Updating participants from room_joined:', message.participants);
        
        // Обновляем участников, сохраняя уже добавленных через participant_joined
        setParticipants(prev => {
          const newParticipants = [...prev];
          
          message.participants.forEach((serverParticipant: any) => {
            // Извлекаем username из разных форматов (строчные и заглавные)
            const username = serverParticipant.username || serverParticipant.Username;
            const userId = serverParticipant.userId || serverParticipant.UserId;
            const isMuted = serverParticipant.isMuted || serverParticipant.IsMuted || false;
            const isOwner = serverParticipant.isOwner || serverParticipant.IsOwner || false;
            const joinedAt = serverParticipant.joinedAt || serverParticipant.JoinedAt;
            
            // Пропускаем участников без username
            if (!username || username.trim() === '') {
              console.warn('RoomView: No username in room_joined participant, skipping:', serverParticipant);
              return;
            }
            
            const existingIndex = newParticipants.findIndex(p => p.userId === userId);
            if (existingIndex >= 0) {
              // Обновляем существующего участника с данными сервера
              newParticipants[existingIndex] = {
                ...newParticipants[existingIndex],
                userId,
                username,
                isMuted,
                isOwner,
                joinedAt
              };
            } else {
              // Добавляем нового участника
              newParticipants.push({
                userId,
                username,
                isMuted,
                isOwner,
                joinedAt
              });
            }
          });
          
          return newParticipants;
        });
        
        // Для каждого существующего участника (кроме себя) инициируем WebRTC соединение
        // Но только после того, как WebRTC будет инициализирован
        const realUserId = getUserIdFromToken();
        const existingParticipants = message.participants.filter((p: RoomParticipant) => p.userId && p.userId !== realUserId);
        
        if (existingParticipants.length > 0) {
          console.log('🎵 RoomView: Found existing participants:', existingParticipants.map((p: RoomParticipant) => p.userId));
          
          // Сохраняем участников для подключения после инициализации WebRTC
          if (webRTCInitialized) {
            existingParticipants.forEach((participant: RoomParticipant) => {
              console.log('🎵 RoomView: Initiating WebRTC connection to existing participant:', participant.userId);
              webRTCService.createOfferForUser(participant.userId);
            });
          } else {
            // Если WebRTC еще не инициализирован, сохраняем участников для последующего подключения
            console.log('🎵 RoomView: WebRTC not initialized yet, saving participants for later connection');
            setPendingParticipants(existingParticipants);
          }
        }
      }
    };

    const handleHeartbeatAck = (message: any) => {
      console.log('Heartbeat acknowledged');
    };

    const handleJoinRoomError = (message: any) => {
      console.warn('🎵 RoomView: Join room error (may be duplicate request):', message.message);
      
      // Не показываем ошибку пользователю, если это дублирующий запрос
      // Основная функциональность работает, это минорная проблема
      if (message.message?.includes('дублирование') || message.message?.includes('уже участвует')) {
        console.log('🎵 RoomView: Ignoring duplicate join request error');
        return;
      }
      
      // Обрабатываем специфические ошибки
      const errorMessage = message.message || 'Ошибка при подключении к комнате';
      
      if (errorMessage.includes('не найдена') || errorMessage.includes('неактивна')) {
        console.error('🎵 RoomView: Room not found or inactive, redirecting to rooms list');
        setErrorType('room-not-found');
        setError('Комната не найдена или была удалена из-за неактивности. Перенаправление на список комнат...');
        
        // Автоматически перенаправляем на список комнат через 3 секунды
        setTimeout(() => {
          onLeave();
        }, 3000);
        return;
      }
      
      // Показываем ошибку только если это серьезная проблема
      setErrorType('general');
      setError(errorMessage);
    };

    const handleAudioBitrateChanged = (message: any) => {
      console.log('🎵 RoomView: Audio bitrate changed event received:', message);
      
      const { audioBitrate, changedBy } = message;
      
      if (audioBitrate && typeof audioBitrate === 'number') {
        // Обновляем локальное состояние комнаты
        setRoom(prev => ({ ...prev, audioBitrate }));
        
        console.log('🎵 RoomView: Audio bitrate updated to:', audioBitrate, 'by user:', changedBy);
        
        // Показываем уведомление если изменение сделал не текущий пользователь
        const currentUserId = getUserIdFromToken();
        if (changedBy && changedBy !== currentUserId) {
          // Можно добавить toast уведомление
          console.log('🎵 RoomView: Bitrate changed by another user');
        }
      }
    };

    // Регистрируем обработчики
    roomWebSocketService.on('participant_joined', handleParticipantJoined);
    roomWebSocketService.on('participant_left', handleParticipantLeft);
    roomWebSocketService.on('room_joined', handleRoomJoined);
    roomWebSocketService.on('heartbeat_ack', handleHeartbeatAck);
    roomWebSocketService.on('join_room_error', handleJoinRoomError);
    roomWebSocketService.on('audio_bitrate_changed', handleAudioBitrateChanged);

    // Heartbeat каждые 30 секунд через WebSocket
    const startHeartbeat = () => {
      heartbeatRef.current = setInterval(() => {
        if (roomWebSocketService.isConnected()) {
          roomWebSocketService.sendHeartbeat(room.roomKey);
        } else {
          // Fallback на REST API если WebSocket недоступен
          roomAPI.heartbeat(room.roomKey).catch(error => {
            console.error('Heartbeat failed:', error);
          });
        }
      }, 30000);
    };

    startHeartbeat();

    // Обработчик закрытия окна/вкладки
    const handleBeforeUnload = () => {
      const sessionKey = `room_session_${urlRoomKey}`;
      sessionStorage.removeItem(sessionKey);
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      // Очищаем обработчики
      roomWebSocketService.off('participant_joined', handleParticipantJoined);
      roomWebSocketService.off('participant_left', handleParticipantLeft);
      roomWebSocketService.off('room_joined', handleRoomJoined);
      roomWebSocketService.off('heartbeat_ack', handleHeartbeatAck);
      roomWebSocketService.off('join_room_error', handleJoinRoomError);
      roomWebSocketService.off('audio_bitrate_changed', handleAudioBitrateChanged);
      
      // Покидаем комнату
      const actualRoomKey = room.roomKey;
      roomWebSocketService.leaveRoom(actualRoomKey);
      
      // Очищаем sessionStorage
      const sessionKey = `room_session_${urlRoomKey}`;
      sessionStorage.removeItem(sessionKey);
      
      // Очищаем heartbeat
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
      }
      
      // Сбрасываем флаг инициализации
      isInitializedRef.current = false;
      
      // Cleanup WebRTC
      if (webRTCInitialized) {
        console.log('🔧 RoomView: Starting WebRTC cleanup...');
        console.log('🔧 RoomView: WebRTC state before cleanup:', webRTCService.getState());
        
        // Disconnect WebRTC service
        webRTCService.disconnect();
        
        // Remove all audio elements
        console.log('🔧 RoomView: Removing audio elements:', audioElementsRef.current.size);
        audioElementsRef.current.forEach((audioElement, userId) => {
          console.log('🔧 RoomView: Removing audio element for user:', userId);
          audioElement.pause();
          audioElement.srcObject = null;
          if (document.body.contains(audioElement)) {
            document.body.removeChild(audioElement);
          }
        });
        audioElementsRef.current.clear();
        
        // Reset WebRTC initialization flag
        setWebRTCInitialized(false);
        
        console.log('🔧 RoomView: WebRTC cleanup completed');
        console.log('🔧 RoomView: WebRTC state after cleanup:', webRTCService.getState());
      }

      // Останавливаем таймер очистки audio элементов
      if (audioCleanupTimerRef.current) {
        console.log('🧹 RoomView: Stopping audio cleanup timer...');
        clearInterval(audioCleanupTimerRef.current);
        audioCleanupTimerRef.current = null;
      }

      // Очищаем звуковой кэш
      console.log('🔊 Clearing sound cache...');
      clearSoundCache();

      // Убираем обработчик beforeunload
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []) // Убираем зависимости, чтобы useEffect выполнился только один раз

  // Подключаемся к участникам, которые были в комнате до нашего подключения
  useEffect(() => {
    if (webRTCInitialized && pendingParticipants.length > 0) {
      console.log('🎵 RoomView: WebRTC initialized, connecting to pending participants:', pendingParticipants.map(p => p.userId));
      
      pendingParticipants.forEach((participant: RoomParticipant) => {
        if (participant.userId) {
          console.log('🎵 RoomView: Creating offer for pending participant:', participant.userId);
          webRTCService.createOfferForUser(participant.userId);
        }
      });
      
      // Очищаем список ожидающих участников
      setPendingParticipants([]);
    }
  }, [webRTCInitialized, pendingParticipants]);

  const handleLeaveRoom = async () => {
    if (confirm('Вы уверены, что хотите покинуть комнату?')) {
      console.log('RoomView: Starting leave room process...')
      
      // Сначала отправляем WebSocket уведомление для реал-тайм обновления
      try {
        console.log('RoomView: Sending WebSocket leave room message...')
        roomWebSocketService.leaveRoom(room.roomKey)
      } catch (error: any) {
        console.warn('RoomView: Error sending WebSocket leave message:', error.message)
      }
      
      // Затем вызываем API для обновления базы данных (может быть уже обновлена через WebSocket)
      try {
        console.log('RoomView: Calling API leave room...')
        await roomAPI.leaveRoom(room.roomKey)
        console.log('RoomView: Successfully left room via API')
      } catch (error: any) {
        console.warn('RoomView: API leave room failed (this is normal if WebSocket already processed the leave):', error.message)
        // Это нормально - WebSocket уже мог обновить БД, поэтому API возвращает ошибку
        // Не показываем ошибку пользователю, так как выход через WebSocket уже сработал
      }
      
      // Всегда вызываем onLeave для очистки состояния и выхода из комнаты
      onLeave()
    }
  }

  const handleMuteParticipant = async (participantId: string) => {
    if (!isOwner) return

    try {
      await roomAPI.muteParticipant(room.roomKey, participantId)
      // Обновляем локальное состояние
      setParticipants(prev => 
        prev.map(p => 
          p.userId === participantId 
            ? { ...p, isMuted: !p.isMuted }
            : p
        )
      )
    } catch (error: any) {
      setErrorType('general');
      setError('Ошибка при изменении статуса участника')
    }
  }

  const handleKickParticipant = async (participantId: string) => {
    if (!isOwner) return

    if (confirm('Вы уверены, что хотите исключить этого участника?')) {
      try {
        await roomAPI.kickParticipant(room.roomKey, participantId)
        setParticipants(prev => prev.filter(p => p.userId !== participantId))
      } catch (error: any) {
        setErrorType('general');
        setError('Ошибка при исключении участника')
      }
    }
  }

  const copyRoomKey = () => {
    navigator.clipboard.writeText(room.roomKey)
    alert('Ключ комнаты скопирован!')
  }

  const toggleMute = () => {
    const newMutedState = !isMuted;
    setIsMuted(newMutedState);
    
    if (webRTCInitialized) {
      webRTCService.setMuted(newMutedState);
      console.log('RoomView: Microphone', newMutedState ? 'muted' : 'unmuted');
    }
  }

  const toggleDeafen = () => {
    const newDeafenedState = !isDeafened;
    setIsDeafened(newDeafenedState);
    
    if (webRTCInitialized) {
      webRTCService.setDeafened(newDeafenedState);
      console.log('RoomView: Audio', newDeafenedState ? 'deafened' : 'undeafened');
    }
  }

  const handleBitrateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newBitrate = parseInt(e.target.value);
    setBitrate(newBitrate);
  };

  const setBitrate = async (bitrate: number) => {
    if (!isOwner) {
      console.warn('Only room owner can change bitrate');
      return;
    }

    try {
      console.log('🎵 RoomView: Updating audio bitrate to:', bitrate);
      await roomAPI.updateAudioBitrate(room.roomKey, bitrate);
      
      // Обновляем локальное состояние комнаты
      setRoom(prev => ({ ...prev, audioBitrate: bitrate }));
      
      console.log('🎵 RoomView: Audio bitrate updated successfully');
    } catch (error) {
      console.error('🎵 RoomView: Failed to update audio bitrate:', error);
      setError('Не удалось обновить битрейт аудио');
    }
  };

  return (
    <div className="room-view">
      <div className="room-header">
        <div className="room-info">
          <h1>{room.name}</h1>
          <div className="room-meta">
            <span className="participant-count">
              <Users size={16} />
              {participants.length}/{room.maxParticipants}
            </span>
            <button onClick={copyRoomKey} className="copy-key-btn">
              <Copy size={16} />
              Скопировать ключ
            </button>
          </div>
        </div>

        <div className="room-actions">
          <button 
            onClick={() => setShowSettings(!showSettings)}
            className="settings-btn"
          >
            <Settings size={20} />
          </button>
          <button onClick={handleLeaveRoom} className="leave-btn">
            <LogOut size={20} />
            Покинуть
          </button>
        </div>
      </div>

      {showSettings && (
        <div className="room-settings">
          <div className="setting-item">
            <span>Ключ комнаты:</span>
            <code>{room.roomKey}</code>
          </div>
          <div className="setting-item">
            <span>Владелец:</span>
            <span>{room.ownerUsername}</span>
          </div>
          <div className="setting-item">
            <span>Создана:</span>
            <span>{new Date(room.createdAt).toLocaleString()}</span>
          </div>
          
          {isOwner && (
            <div className="setting-item bitrate-setting">
              <div className="bitrate-header">
                <span>Битрейт аудио:</span>
                <span className="bitrate-value">{room.audioBitrate}kbps</span>
              </div>
              <div className="bitrate-slider-container">
                <span className="bitrate-label">8kbps</span>
                <input
                  type="range"
                  min="8"
                  max="320"
                  step="8"
                  value={room.audioBitrate}
                  onChange={handleBitrateChange}
                  className="bitrate-slider"
                />
                <span className="bitrate-label">320kbps</span>
              </div>
              <div className="bitrate-presets">
                <button onClick={() => setBitrate(64)} className={room.audioBitrate === 64 ? 'active' : ''}>64kbps</button>
                <button onClick={() => setBitrate(128)} className={room.audioBitrate === 128 ? 'active' : ''}>128kbps</button>
                <button onClick={() => setBitrate(192)} className={room.audioBitrate === 192 ? 'active' : ''}>192kbps</button>
              </div>
              <p className="bitrate-warning">
                ВНИМАНИЕ! Не поднимайте битрейт выше 64 kbps, чтобы не создать проблемы людям с низкой скоростью соединения.
              </p>
            </div>
          )}
          
          {/* Секция звуковых уведомлений */}
          <div className="setting-item sound-settings">
            <div className="sound-header">
              <span>🔊 Звуковые уведомления</span>
            </div>
            <div className="sound-controls">
              <button 
                onClick={() => playJoinSound()}
                className="sound-test-btn join-sound"
              >
                🎵 Тест звука входа
              </button>
              <button 
                onClick={() => playLeaveSound()}
                className="sound-test-btn leave-sound"
              >
                🚪 Тест звука выхода
              </button>
            </div>
            <div className="sound-volume">
              <span>Громкость:</span>
              <input
                type="range"
                min="0"
                max="100"
                defaultValue="60"
                onChange={(e) => setSoundVolume(parseInt(e.target.value) / 100)}
                className="volume-slider"
              />
            </div>
            <p className="sound-info">
              Звуки проигрываются при входе и выходе участников из комнаты
            </p>
          </div>
        </div>
      )}

      {error && (
        <div className={`error-message ${errorType}`}>
          {error}
          {errorType === 'room-not-found' && (
            <small>Комнаты автоматически удаляются через 20 минут неактивности</small>
          )}
        </div>
      )}

      <div className="voice-area">
        <div className="participants-grid">
          {participants.map((participant, index) => (
            <div 
              key={participant.userId || `participant-${index}`} 
              className={`participant-card ${participant.userId === user?.id ? 'current-user' : ''}`}
            >
              <div className="participant-avatar">
                <div className="avatar-circle">
                  {participant.username?.charAt(0)?.toUpperCase() || '?'}
                </div>
                {participant.isMuted && (
                  <div className="mute-indicator">
                    <MicOff size={12} />
                  </div>
                )}
              </div>

              <div className="participant-info">
                <span className="participant-name">
                  {participant.username || 'Неизвестный пользователь'}
                  {participant.isOwner && (
                    <Crown size={14} className="owner-icon" />
                  )}
                </span>
                <span className="participant-status">
                  {participant.userId === user?.id ? 'Вы' : 
                   participant.isMuted ? 'Заглушен' : 'Активен'}
                </span>
              </div>

              {isOwner && participant.userId !== user?.id && (
                <div className="participant-controls">
                  <button 
                    onClick={() => handleMuteParticipant(participant.userId)}
                    className={`control-btn ${participant.isMuted ? 'active' : ''}`}
                    title={participant.isMuted ? 'Разглушить' : 'Заглушить'}
                  >
                    {participant.isMuted ? <Mic size={16} /> : <MicOff size={16} />}
                  </button>
                  <button 
                    onClick={() => handleKickParticipant(participant.userId)}
                    className="control-btn kick-btn"
                    title="Исключить"
                  >
                    <UserX size={16} />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="voice-controls">
          <button 
            onClick={toggleMute}
            className={`voice-btn ${isMuted ? 'muted' : ''}`}
            title={isMuted ? 'Включить микрофон' : 'Выключить микрофон'}
          >
            {isMuted ? <MicOff size={24} /> : <Mic size={24} />}
            <span>{isMuted ? 'Включить микрофон' : 'Выключить микрофон'}</span>
          </button>

          <button 
            onClick={toggleDeafen}
            className={`voice-btn ${isDeafened ? 'deafened' : ''}`}
            title={isDeafened ? 'Включить звук' : 'Выключить звук'}
          >
            {isDeafened ? <VolumeX size={24} /> : <Volume2 size={24} />}
            <span>{isDeafened ? 'Включить звук' : 'Выключить звук'}</span>
          </button>

          {/* Кнопка для диагностики аудио */}
          <button 
            onClick={async () => {
              console.log('🔊 === AUDIO DIAGNOSTICS ===');
              
              // Проверяем аудио устройства
              try {
                const devices = await navigator.mediaDevices.enumerateDevices();
                const audioOutputs = devices.filter(d => d.kind === 'audiooutput');
                const audioInputs = devices.filter(d => d.kind === 'audioinput');
                
                console.log('🔊 Audio output devices:', audioOutputs);
                console.log('🔊 Audio input devices:', audioInputs);
                
                // Проверяем все аудио элементы
                const audioElements = document.querySelectorAll('audio');
                console.log('🔊 Audio elements in DOM:', audioElements.length);
                
                audioElements.forEach((audio, index) => {
                  console.log(`🔊 Audio element ${index}:`, {
                    src: audio.src,
                    srcObject: audio.srcObject,
                    volume: audio.volume,
                    muted: audio.muted,
                    paused: audio.paused,
                    readyState: audio.readyState,
                    userId: audio.getAttribute('data-user-id')
                  });
                  
                  // Пытаемся воспроизвести
                  if (audio.paused) {
                    audio.play().catch(err => console.error('🔊 Failed to play audio:', err));
                  }
                });
                
                // Проверяем remote streams
                console.log('🔊 Remote streams:', remoteStreams);
                
              } catch (error) {
                console.error('🔊 Audio diagnostics error:', error);
              }
            }}
            className="voice-btn"
            title="Диагностика аудио"
            style={{ backgroundColor: '#4CAF50', color: 'white' }}
          >
            🔊 <span>Диагностика</span>
          </button>

        </div>
      </div>

      <div className="room-footer">
        <div className="connection-status">
          <div className={`status-indicator ${webRTCInitialized ? 'connected' : 'connecting'}`}></div>
          <span>
            {webRTCInitialized 
              ? 'Подключено к голосовой комнате' 
              : 'Подключение к голосовой комнате...'
            }
          </span>
        </div>
        
        <div className="room-info-footer">
          <span>Комната будет автоматически удалена через 20 минут неактивности</span>
          {remoteStreams.size > 0 && (
            <span> • Активных соединений: {remoteStreams.size}</span>
          )}
        </div>
      </div>
    </div>
  )
}

export default RoomView
