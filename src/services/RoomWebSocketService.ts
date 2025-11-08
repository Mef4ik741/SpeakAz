// Константы для управления памятью WebSocket
const MAX_WEBRTC_BUFFER_SIZE = 50
const MAX_EVENT_HANDLERS_PER_TYPE = 10
const BUFFER_CLEANUP_INTERVAL = 60000 // 1 минута

class RoomWebSocketService {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private currentRoom: string | null = null;
  private eventHandlers: Map<string, Function[]> = new Map();
  
  // Буфер для WebRTC сообщений, полученных до регистрации обработчиков
  private webrtcMessageBuffer: any[] = [];
  private bufferCleanupTimer: NodeJS.Timeout | null = null;

  constructor() {
    this.connect();
  }

  private connect() {
    const token = localStorage.getItem('token');
    if (!token) {
      console.error('RoomWebSocket: No auth token found');
      return;
    }

    try {
      // WebSocket URL с авторизацией через query parameter
      const wsUrl = `wss://speakaz-backend.onrender.com/ws/rooms?token=${encodeURIComponent(token)}`;
      console.log('RoomWebSocket: Attempting to connect to:', wsUrl);
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('RoomWebSocket: Connected successfully');
        this.reconnectAttempts = 0;
        
        // Если были подключены к комнате, переподключаемся с задержкой
        if (this.currentRoom) {
          console.log('RoomWebSocket: Rejoining room after reconnection:', this.currentRoom);
          // Добавляем небольшую задержку, чтобы дать серверу время на очистку предыдущего соединения
          setTimeout(() => {
            this.joinRequestSent = false; // Сбрасываем флаг для переподключения
            this.joinRoom(this.currentRoom!);
          }, 1000);
        }
      };

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          this.handleMessage(message);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      this.ws.onclose = (event) => {
        console.log('RoomWebSocket: Disconnected', event.code, event.reason);
        this.ws = null;
        this.attemptReconnect();
      };

      this.ws.onerror = (error) => {
        console.error('RoomWebSocket: Connection error:', error);
      };
    } catch (error) {
      console.error('Error creating WebSocket connection:', error);
      this.attemptReconnect();
    }
  }

  private attemptReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`Attempting to reconnect... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
      
      setTimeout(() => {
        this.connect();
      }, this.reconnectDelay * this.reconnectAttempts);
    } else {
      console.error('Max reconnection attempts reached');
    }
  }

  private handleMessage(message: any) {
    // Логируем только важные сообщения, не WebRTC signaling
    if (!message.type?.startsWith('webrtc_')) {
      console.log('🎵 RoomWebSocket: Message received:', message);
    }
    
    const handlers = this.eventHandlers.get(message.type) || [];
    
    // Логируем только если нет обработчиков или это важное событие
    if (handlers.length === 0 || ['room_joined', 'participant_joined', 'participant_left'].includes(message.type)) {
      console.log('🎵 RoomWebSocket: Found', handlers.length, 'handlers for event:', message.type);
    }
    
    if (handlers.length === 0 && message.type?.startsWith('webrtc_')) {
      console.log('🎵 RoomWebSocket: Buffering WebRTC message (normal behavior):', message.type);
      this.addToWebRTCBuffer(message);
      console.log('🎵 RoomWebSocket: Buffered messages count:', this.webrtcMessageBuffer.length);
      return;
    }
    
    // Проверяем, есть ли обработчики для обычных сообщений
    if (handlers.length === 0) {
      console.warn('🎵 RoomWebSocket: Available handlers:', Array.from(this.eventHandlers.keys()));
      console.warn('🎵 RoomWebSocket: Total registered events:', this.eventHandlers.size);
    }
    
    handlers.forEach((handler, index) => {
      try {
        console.log('🎵 RoomWebSocket: Calling handler', index + 1, 'for event:', message.type);
        handler(message);
        console.log('🎵 RoomWebSocket: Handler', index + 1, 'completed successfully');
      } catch (error) {
        console.error('🎵 RoomWebSocket: Error in event handler', index + 1, ':', error);
      }
    });
  }

  private joinRequestSent = false;
  
  public joinRoom(roomKey: string) {
    console.log('RoomWebSocket: Joining room:', roomKey);
    
    // Предотвращаем дублирование запросов к той же комнате
    if (this.joinRequestSent && this.currentRoom === roomKey) {
      console.warn('RoomWebSocket: Join request already sent for room', roomKey, ', skipping duplicate');
      return;
    }
    
    // Если это новая комната, сбрасываем флаг
    if (this.currentRoom !== roomKey) {
      this.joinRequestSent = false;
    }
    
    this.currentRoom = roomKey;
    
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const message = {
        type: 'join_room',
        roomKey: roomKey
      };
      console.log('RoomWebSocket: Sending join_room message:', message);
      this.ws.send(JSON.stringify(message));
      this.joinRequestSent = true;
    } else {
      console.warn('RoomWebSocket: Cannot join room, WebSocket not connected. State:', this.ws?.readyState);
    }
  }

  public leaveRoom(roomKey: string) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'leave_room',
        roomKey: roomKey
      }));
    }
    
    if (this.currentRoom === roomKey) {
      this.currentRoom = null;
      this.joinRequestSent = false; // Сбрасываем флаг
    }
  }

  public sendHeartbeat(roomKey: string) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'heartbeat',
        roomKey: roomKey
      }));
    }
  }

  public sendMessage(message: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      console.log('RoomWebSocket: Sending message:', message);
      this.ws.send(JSON.stringify(message));
    } else {
      console.warn('RoomWebSocket: Cannot send message, WebSocket not connected');
    }
  }

  public on(eventType: string, handler: Function) {
    console.log('🎵 RoomWebSocket: Registering handler for event:', eventType);
    if (!this.eventHandlers.has(eventType)) {
      this.eventHandlers.set(eventType, []);
    }
    this.eventHandlers.get(eventType)!.push(handler);
    console.log('🎵 RoomWebSocket: Total handlers for', eventType, ':', this.eventHandlers.get(eventType)!.length);
    console.log('🎵 RoomWebSocket: All registered events:', Array.from(this.eventHandlers.keys()));
    
    // Если это WebRTC обработчик, проверяем буферизованные сообщения
    if (eventType.startsWith('webrtc_') && this.webrtcMessageBuffer.length > 0) {
      console.log('🎵 RoomWebSocket: Processing buffered WebRTC messages for:', eventType);
      const messagesToProcess = this.webrtcMessageBuffer.filter(msg => msg.type === eventType);
      
      messagesToProcess.forEach(message => {
        console.log('🎵 RoomWebSocket: Processing buffered message:', message.type);
        try {
          handler(message);
          console.log('🎵 RoomWebSocket: Buffered message processed successfully');
        } catch (error) {
          console.error('🎵 RoomWebSocket: Error processing buffered message:', error);
        }
      });
      
      // Удаляем обработанные сообщения из буфера
      this.webrtcMessageBuffer = this.webrtcMessageBuffer.filter(msg => msg.type !== eventType);
      console.log('🎵 RoomWebSocket: Remaining buffered messages:', this.webrtcMessageBuffer.length);
    }
  }

  public off(eventType: string, handler: Function) {
    const handlers = this.eventHandlers.get(eventType);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  public isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  public reconnect() {
    console.log('RoomWebSocket: Manual reconnect requested');
    this.disconnect(false); // Не очищаем обработчики при переподключении
    this.reconnectAttempts = 0;
    this.connect();
  }

  public disconnect(clearHandlers: boolean = true) {
    if (this.currentRoom) {
      this.leaveRoom(this.currentRoom);
    }
    
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    
    // Очищаем обработчики только при полном отключении, не при переподключении
    if (clearHandlers) {
      this.eventHandlers.clear();
    }
    this.currentRoom = null;
    this.joinRequestSent = false; // Сбрасываем флаг при отключении
  }

  // Управление памятью для WebRTC буфера
  private addToWebRTCBuffer(message: any): void {
    this.webrtcMessageBuffer.push(message);
    
    // Ограничиваем размер буфера
    if (this.webrtcMessageBuffer.length > MAX_WEBRTC_BUFFER_SIZE) {
      console.log('🧹 RoomWebSocket: Trimming WebRTC buffer from', this.webrtcMessageBuffer.length, 'to', MAX_WEBRTC_BUFFER_SIZE);
      this.webrtcMessageBuffer = this.webrtcMessageBuffer.slice(-MAX_WEBRTC_BUFFER_SIZE);
    }
  }

  // Очистка старых буферизованных сообщений
  private startBufferCleanup(): void {
    if (this.bufferCleanupTimer) {
      clearInterval(this.bufferCleanupTimer);
    }
    
    this.bufferCleanupTimer = setInterval(() => {
      this.performBufferCleanup();
    }, BUFFER_CLEANUP_INTERVAL);
  }

  private performBufferCleanup(): void {
    console.log('🧹 RoomWebSocket: Performing buffer cleanup...');
    
    // Очищаем старые WebRTC сообщения (старше 5 минут)
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
    const initialLength = this.webrtcMessageBuffer.length;
    
    this.webrtcMessageBuffer = this.webrtcMessageBuffer.filter(msg => {
      return !msg.timestamp || msg.timestamp > fiveMinutesAgo;
    });

    if (this.webrtcMessageBuffer.length !== initialLength) {
      console.log('🧹 RoomWebSocket: Cleaned up', initialLength - this.webrtcMessageBuffer.length, 'old messages');
    }

    // Проверяем количество обработчиков событий
    let totalHandlers = 0;
    this.eventHandlers.forEach((handlers, eventType) => {
      totalHandlers += handlers.length;
      if (handlers.length > MAX_EVENT_HANDLERS_PER_TYPE) {
        console.warn('🧹 RoomWebSocket: Too many handlers for event:', eventType, handlers.length);
      }
    });

    console.log('🧹 RoomWebSocket: Total event handlers:', totalHandlers);
  }

  // Получить статистику использования памяти
  getMemoryStats(): any {
    let totalHandlers = 0;
    const handlersByType: { [key: string]: number } = {};
    
    this.eventHandlers.forEach((handlers, eventType) => {
      totalHandlers += handlers.length;
      handlersByType[eventType] = handlers.length;
    });

    return {
      webrtcBufferSize: this.webrtcMessageBuffer.length,
      maxWebrtcBufferSize: MAX_WEBRTC_BUFFER_SIZE,
      totalEventHandlers: totalHandlers,
      handlersByType,
      bufferCleanupActive: !!this.bufferCleanupTimer,
      isConnected: this.ws?.readyState === WebSocket.OPEN
    };
  }
}

// Создаем singleton instance
export const roomWebSocketService = new RoomWebSocketService();

// Make it globally available for WebRTC service
(window as any).roomWebSocketService = roomWebSocketService;

export default roomWebSocketService;
