class WebRTCService {
  private localStream: MediaStream | null = null;
  private peerConnections: Map<string, RTCPeerConnection> = new Map();
  private remoteStreams: Map<string, MediaStream> = new Map();
  private roomKey: string | null = null;
  private userId: string | null = null;
  private isInitialized = false;

  // WebRTC configuration
  private config: RTCConfiguration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' }
    ]
  };

  // Event handlers
  private onRemoteStreamHandler: ((userId: string, stream: MediaStream) => void) | null = null;
  private onRemoteStreamRemovedHandler: ((userId: string) => void) | null = null;
  private onConnectionStateChangeHandler: ((userId: string, state: string) => void) | null = null;
  
  // Буфер для WebRTC сообщений, полученных до инициализации
  private messageBuffer: any[] = [];

  constructor() {
    console.log('WebRTCService: Initialized');
  }

  // Initialize WebRTC with room and user info
  async initialize(roomKey: string, userId: string): Promise<void> {
    console.log('🎵 WebRTCService: Starting initialization for room:', roomKey, 'user:', userId);
    
    // Check if already initialized and clean up if necessary
    if (this.isInitialized) {
      console.warn('🎵 WebRTCService: Already initialized, cleaning up first...');
      this.disconnect();
    }
    
    // Ensure clean state
    const currentState = this.getState();
    console.log('🎵 WebRTCService: Current state before initialization:', currentState);
    
    if (currentState.peerConnectionsCount > 0 || currentState.remoteStreamsCount > 0 || currentState.localStreamActive) {
      console.warn('🎵 WebRTCService: Found leftover connections, forcing cleanup...');
      this.disconnect();
    }
    
    this.roomKey = roomKey;
    this.userId = userId;

    try {
      // Get user media (microphone)
      console.log('🎵 WebRTCService: Requesting user media...');
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        },
        video: false
      });

      console.log('🎵 WebRTCService: Local stream obtained successfully');
      console.log('🎵 WebRTCService: Local stream ID:', this.localStream.id);
      console.log('🎵 WebRTCService: Local stream active:', this.localStream.active);
      console.log('🎵 WebRTCService: Local stream tracks:', this.localStream.getTracks().map(t => ({ 
        kind: t.kind, 
        enabled: t.enabled, 
        readyState: t.readyState,
        id: t.id 
      })));
      this.isInitialized = true;

      // Setup WebSocket signaling handlers and wait for completion
      await this.setupSignalingHandlers();
      
      // Обрабатываем буферизованные сообщения
      console.log('🎵 WebRTCService: Processing buffered messages:', this.messageBuffer.length);
      const bufferedMessages = [...this.messageBuffer];
      this.messageBuffer = [];
      
      for (const message of bufferedMessages) {
        console.log('🎵 WebRTCService: Processing buffered message:', message.type);
        await this.processWebRTCMessage(message);
      }
      
      console.log('🎵 WebRTCService: Initialization completed successfully');

    } catch (error) {
      console.error('WebRTCService: Error getting user media:', error);
      throw error;
    }
  }

  // Setup WebSocket signaling handlers
  private async setupSignalingHandlers(): Promise<void> {
    console.log('🎵 WebRTCService: Setting up signaling handlers...');
    
    try {
      // Import the service directly instead of using window
      const { roomWebSocketService } = await import('./RoomWebSocketService');
      console.log('🎵 WebRTCService: RoomWebSocketService imported successfully');
      
      // Handle WebRTC signaling messages with buffering
      roomWebSocketService.on('webrtc_offer', (message: any) => {
        console.log('🎵 WebRTCService: Received webrtc_offer event:', message);
        this.processWebRTCMessage(message);
      });
      
      roomWebSocketService.on('webrtc_answer', (message: any) => {
        console.log('🎵 WebRTCService: Received webrtc_answer event:', message);
        this.processWebRTCMessage(message);
      });
      
      roomWebSocketService.on('webrtc_ice_candidate', (message: any) => {
        console.log('🎵 WebRTCService: Received webrtc_ice_candidate event:', message);
        this.processWebRTCMessage(message);
      });
      
      roomWebSocketService.on('participant_joined', (message: any) => {
        console.log('🎵 WebRTCService: Received participant_joined event:', message);
        this.handleParticipantJoinedInternal(message);
      });
      
      roomWebSocketService.on('participant_left', (message: any) => {
        console.log('🎵 WebRTCService: Received participant_left event:', message);
        this.handleParticipantLeft(message);
      });

      console.log('🎵 WebRTCService: All signaling handlers registered');
      console.log('🎵 WebRTCService: Available handlers:', Array.from(roomWebSocketService['eventHandlers'].keys()));
      console.log('🎵 WebRTCService: Signaling handlers setup complete');
      
    } catch (error) {
      console.error('🎵 WebRTCService: Failed to setup signaling handlers:', error);
      throw error;
    }
  }

  // Create peer connection for a user
  private createPeerConnection(remoteUserId: string): RTCPeerConnection {
    console.log('WebRTCService: Creating peer connection for user:', remoteUserId);
    
    // Check if peer connection already exists
    if (this.peerConnections.has(remoteUserId)) {
      console.warn('WebRTCService: Peer connection already exists for user:', remoteUserId, 'closing old one...');
      const oldPc = this.peerConnections.get(remoteUserId);
      if (oldPc) {
        oldPc.close();
      }
      this.peerConnections.delete(remoteUserId);
    }

    const pc = new RTCPeerConnection(this.config);

    // Add local stream to peer connection
    if (this.localStream) {
      console.log('🎵 WebRTCService: Adding local stream tracks to peer connection for:', remoteUserId);
      console.log('🎵 WebRTCService: Local stream tracks:', this.localStream.getTracks());
      
      this.localStream.getTracks().forEach(track => {
        console.log('🎵 WebRTCService: Adding track:', track.kind, track.enabled, track.readyState);
        const sender = pc.addTrack(track, this.localStream!);
        console.log('🎵 WebRTCService: Track added, sender:', sender);
      });
      
      console.log('🎵 WebRTCService: All local tracks added to peer connection');
    } else {
      console.error('🎵 WebRTCService: No local stream to add to peer connection!');
    }

    // Handle remote stream
    pc.ontrack = (event) => {
      console.log('🎵 WebRTCService: ontrack event received from:', remoteUserId);
      console.log('🎵 WebRTCService: Event streams:', event.streams);
      console.log('🎵 WebRTCService: Event track:', event.track);
      
      const remoteStream = event.streams[0];
      console.log('🎵 WebRTCService: Remote stream:', remoteStream);
      console.log('🎵 WebRTCService: Remote stream tracks:', remoteStream?.getTracks());
      
      if (remoteStream) {
        this.remoteStreams.set(remoteUserId, remoteStream);
        console.log('🎵 WebRTCService: Stream added to remoteStreams map');
        
        if (this.onRemoteStreamHandler) {
          console.log('🎵 WebRTCService: Calling onRemoteStreamHandler');
          this.onRemoteStreamHandler(remoteUserId, remoteStream);
        } else {
          console.warn('🎵 WebRTCService: onRemoteStreamHandler is null!');
        }
      } else {
        console.error('🎵 WebRTCService: No remote stream in ontrack event!');
      }
    };

    // Handle ICE candidates
    pc.onicecandidate = async (event) => {
      if (event.candidate) {
        console.log('WebRTCService: Sending ICE candidate to:', remoteUserId);
        await this.sendSignalingMessage('webrtc_ice_candidate', {
          candidate: event.candidate,
          targetUserId: remoteUserId
        });
      }
    };

    // Handle connection state changes
    pc.onconnectionstatechange = () => {
      console.log('WebRTCService: Connection state changed for', remoteUserId, ':', pc.connectionState);
      if (this.onConnectionStateChangeHandler) {
        this.onConnectionStateChangeHandler(remoteUserId, pc.connectionState);
      }

      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        this.removePeerConnection(remoteUserId);
      }
    };

    this.peerConnections.set(remoteUserId, pc);
    return pc;
  }

  // Public method to handle participant joined from RoomView
  public async handleParticipantJoined(message: any): Promise<void> {
    await this.handleParticipantJoinedInternal(message);
  }

  // Handle new participant joined
  private async handleParticipantJoinedInternal(message: any): Promise<void> {
    console.log('🎵 WebRTCService: handleParticipantJoinedInternal called with message:', message);
    
    // Извлекаем userId из разных возможных структур
    const remoteUserId = message.userId || message.participant?.userId;
    console.log('🎵 WebRTCService: Extracted remoteUserId:', remoteUserId);
    console.log('🎵 WebRTCService: Message.userId:', message.userId);
    console.log('🎵 WebRTCService: Message.participant?.userId:', message.participant?.userId);
    console.log('🎵 WebRTCService: Current userId:', this.userId);
    
    if (!remoteUserId) {
      console.error('🎵 WebRTCService: No remoteUserId found in message!');
      return;
    }
    
    if (remoteUserId === this.userId) {
      console.log('🎵 WebRTCService: Ignoring own join event');
      return;
    }

    console.log('🎵 WebRTCService: Participant joined, creating offer for:', remoteUserId);
    console.log('🎵 WebRTCService: Local stream available:', !!this.localStream);
    console.log('🎵 WebRTCService: Is initialized:', this.isInitialized);

    try {
      const pc = this.createPeerConnection(remoteUserId);
      
      // Create and send offer
      console.log('🎵 WebRTCService: Creating offer for:', remoteUserId);
      const offer = await pc.createOffer();
      console.log('🎵 WebRTCService: Offer created:', offer);
      
      await pc.setLocalDescription(offer);
      console.log('🎵 WebRTCService: Local description set for:', remoteUserId);

      await this.sendSignalingMessage('webrtc_offer', {
        offer: offer,
        targetUserId: remoteUserId
      });
      console.log('🎵 WebRTCService: Offer sent to:', remoteUserId);

    } catch (error) {
      console.error('WebRTCService: Error creating offer:', error);
    }
  }

  // Handle participant left
  private handleParticipantLeft(message: any): void {
    const remoteUserId = message.userId;
    console.log('WebRTCService: Participant left:', remoteUserId);
    
    this.removePeerConnection(remoteUserId);
  }

  // Process WebRTC message (with buffering support)
  private async processWebRTCMessage(message: any): Promise<void> {
    console.log('🎵 WebRTCService: processWebRTCMessage called with:', message);
    
    if (!this.isInitialized) {
      console.log('🎵 WebRTCService: Not initialized, buffering message:', message.type);
      this.messageBuffer.push(message);
      return;
    }
    
    console.log('🎵 WebRTCService: Processing WebRTC message:', message.type);
    console.log('🎵 WebRTCService: Message details:', JSON.stringify(message, null, 2));
    
    switch (message.type) {
      case 'webrtc_offer':
        console.log('🎵 WebRTCService: Handling WebRTC offer...');
        await this.handleOffer(message);
        break;
      case 'webrtc_answer':
        console.log('🎵 WebRTCService: Handling WebRTC answer...');
        await this.handleAnswer(message);
        break;
      case 'webrtc_ice_candidate':
        console.log('🎵 WebRTCService: Handling WebRTC ICE candidate...');
        await this.handleIceCandidate(message);
        break;
      default:
        console.warn('🎵 WebRTCService: Unknown WebRTC message type:', message.type);
        console.warn('🎵 WebRTCService: Full message:', message);
    }
  }

  // Static method to handle WebRTC messages before initialization
  public static handleWebRTCMessage(message: any): void {
    console.log('🎵 WebRTCService: Static handler called for:', message.type);
    
    // Get the singleton instance
    import('./WebRTCService').then(({ webRTCService }) => {
      if (webRTCService) {
        webRTCService.processWebRTCMessage(message);
      } else {
        console.warn('🎵 WebRTCService: Singleton instance not available');
      }
    }).catch(error => {
      console.error('🎵 WebRTCService: Error importing singleton:', error);
    });
  }

  // Handle WebRTC offer
  private async handleOffer(message: any): Promise<void> {
    console.log('🎵 WebRTCService: handleOffer called with message:', message);
    
    const { offer, fromUserId } = message;
    console.log('🎵 WebRTCService: Extracted data - offer:', offer, 'fromUserId:', fromUserId);
    
    if (!offer) {
      console.error('🎵 WebRTCService: No offer found in message!');
      return;
    }
    
    if (!fromUserId) {
      console.error('🎵 WebRTCService: No fromUserId found in message!');
      return;
    }

    console.log('🎵 WebRTCService: Received offer from:', fromUserId);
    console.log('🎵 WebRTCService: Offer SDP:', offer.sdp?.substring(0, 100) + '...');

    try {
      let pc = this.peerConnections.get(fromUserId);
      if (!pc) {
        console.log('🎵 WebRTCService: Creating new peer connection for:', fromUserId);
        pc = this.createPeerConnection(fromUserId);
      } else {
        console.log('🎵 WebRTCService: Using existing peer connection for:', fromUserId);
      }

      console.log('🎵 WebRTCService: Setting remote description...');
      await pc.setRemoteDescription(offer);
      console.log('🎵 WebRTCService: Remote description set successfully');
      
      // Create and send answer
      console.log('🎵 WebRTCService: Creating answer for:', fromUserId);
      const answer = await pc.createAnswer();
      console.log('🎵 WebRTCService: Answer created:', answer);
      console.log('🎵 WebRTCService: Answer SDP:', answer.sdp?.substring(0, 100) + '...');
      
      await pc.setLocalDescription(answer);
      console.log('🎵 WebRTCService: Local description set (answer) for:', fromUserId);

      await this.sendSignalingMessage('webrtc_answer', {
        answer: answer,
        targetUserId: fromUserId
      });
      console.log('🎵 WebRTCService: Answer sent to:', fromUserId);

    } catch (error) {
      console.error('🎵 WebRTCService: Error handling offer:', error);
      console.error('🎵 WebRTCService: Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    }
  }

  // Handle WebRTC answer
  private async handleAnswer(message: any): Promise<void> {
    const { answer, fromUserId } = message;
    console.log('WebRTCService: Received answer from:', fromUserId);

    try {
      const pc = this.peerConnections.get(fromUserId);
      if (pc) {
        await pc.setRemoteDescription(answer);
      }
    } catch (error) {
      console.error('WebRTCService: Error handling answer:', error);
    }
  }

  // Handle ICE candidate
  private async handleIceCandidate(message: any): Promise<void> {
    const { candidate, fromUserId } = message;
    console.log('WebRTCService: Received ICE candidate from:', fromUserId);

    try {
      const pc = this.peerConnections.get(fromUserId);
      if (pc) {
        await pc.addIceCandidate(candidate);
      }
    } catch (error) {
      console.error('WebRTCService: Error handling ICE candidate:', error);
    }
  }

  // Send signaling message via WebSocket
  private async sendSignalingMessage(type: string, data: any): Promise<void> {
    try {
      const { roomWebSocketService } = await import('./RoomWebSocketService');
      if (roomWebSocketService && roomWebSocketService.isConnected()) {
        const message = {
          type: type,
          roomKey: this.roomKey,
          data: data
        };
        console.log('WebRTCService: Sending signaling message:', message);
        roomWebSocketService.sendMessage(message);
      } else {
        console.warn('WebRTCService: Cannot send signaling message - WebSocket not connected');
      }
    } catch (error) {
      console.error('WebRTCService: Error sending signaling message:', error);
    }
  }

  // Remove peer connection
  private removePeerConnection(userId: string): void {
    console.log('WebRTCService: Removing peer connection for:', userId);
    
    const pc = this.peerConnections.get(userId);
    if (pc) {
      pc.close();
      this.peerConnections.delete(userId);
    }

    const stream = this.remoteStreams.get(userId);
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      this.remoteStreams.delete(userId);
    }

    if (this.onRemoteStreamRemovedHandler) {
      this.onRemoteStreamRemovedHandler(userId);
    }
  }

  // Mute/unmute microphone
  setMuted(muted: boolean): void {
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach(track => {
        track.enabled = !muted;
      });
      console.log('WebRTCService: Microphone', muted ? 'muted' : 'unmuted');
    }
  }

  // Set volume for remote streams
  setDeafened(deafened: boolean): void {
    this.remoteStreams.forEach((stream, userId) => {
      const audioElements = document.querySelectorAll(`audio[data-user-id="${userId}"]`);
      audioElements.forEach((audio: any) => {
        audio.muted = deafened;
      });
    });
    console.log('WebRTCService: Remote audio', deafened ? 'deafened' : 'undeafened');
  }

  // Get local stream
  getLocalStream(): MediaStream | null {
    return this.localStream;
  }

  // Get remote stream for user
  getRemoteStream(userId: string): MediaStream | null {
    return this.remoteStreams.get(userId) || null;
  }

  // Create offer for specific user (for reconnection scenarios)
  async createOfferForUser(userId: string): Promise<void> {
    if (!this.isInitialized || !this.localStream) {
      console.warn('WebRTCService: Cannot create offer - not initialized or no local stream');
      return;
    }

    console.log('🎵 WebRTCService: Creating offer for user:', userId);
    
    try {
      // Create peer connection if it doesn't exist
      let pc = this.peerConnections.get(userId);
      if (!pc) {
        pc = this.createPeerConnection(userId);
      }

      // Create and send offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      
      console.log('🎵 WebRTCService: Offer created for user:', userId);
      console.log('🎵 WebRTCService: Offer SDP:', offer.sdp?.substring(0, 100) + '...');

      await this.sendSignalingMessage('webrtc_offer', {
        offer: offer,
        targetUserId: userId
      });
      
      console.log('🎵 WebRTCService: Offer sent to user:', userId);
    } catch (error) {
      console.error('🎵 WebRTCService: Error creating offer for user:', userId, error);
    }
  }

  // Event handlers
  onRemoteStream(handler: (userId: string, stream: MediaStream) => void): void {
    this.onRemoteStreamHandler = handler;
  }

  onRemoteStreamRemoved(handler: (userId: string) => void): void {
    this.onRemoteStreamRemovedHandler = handler;
  }

  onConnectionStateChange(handler: (userId: string, state: string) => void): void {
    this.onConnectionStateChangeHandler = handler;
  }

  // Cleanup
  disconnect(): void {
    console.log('🎵 WebRTCService: Starting complete disconnect and cleanup...');
    console.log('🎵 WebRTCService: Current state before cleanup:', {
      isInitialized: this.isInitialized,
      peerConnections: this.peerConnections.size,
      remoteStreams: this.remoteStreams.size,
      hasLocalStream: !!this.localStream
    });

    // Close all peer connections
    console.log('🎵 WebRTCService: Closing peer connections:', this.peerConnections.size);
    this.peerConnections.forEach((pc, userId) => {
      console.log('🎵 WebRTCService: Closing peer connection for:', userId);
      pc.close();
    });
    this.peerConnections.clear();

    // Stop all remote streams
    console.log('🎵 WebRTCService: Stopping remote streams:', this.remoteStreams.size);
    this.remoteStreams.forEach((stream, userId) => {
      console.log('🎵 WebRTCService: Stopping remote stream for:', userId);
      stream.getTracks().forEach(track => {
        console.log('🎵 WebRTCService: Stopping remote track:', track.kind, track.label);
        track.stop();
      });
    });
    this.remoteStreams.clear();

    // Stop local stream
    if (this.localStream) {
      console.log('🎵 WebRTCService: Stopping local stream tracks...');
      this.localStream.getTracks().forEach(track => {
        console.log('🎵 WebRTCService: Stopping local track:', track.kind, track.label);
        track.stop();
      });
      this.localStream = null;
    }

    // Clear all handlers
    console.log('🎵 WebRTCService: Clearing event handlers...');
    this.onRemoteStreamHandler = null;
    this.onRemoteStreamRemovedHandler = null;
    this.onConnectionStateChangeHandler = null;

    // Clear buffer
    console.log('🎵 WebRTCService: Clearing message buffer...');
    this.messageBuffer = [];

    // Reset state
    this.roomKey = null;
    this.userId = null;
    this.isInitialized = false;

    console.log('🎵 WebRTCService: Complete disconnect finished');
  }

  // Check if initialized
  isReady(): boolean {
    return this.isInitialized && this.localStream !== null;
  }

  // Get current state for debugging
  getState(): any {
    return {
      isInitialized: this.isInitialized,
      roomKey: this.roomKey,
      userId: this.userId,
      localStreamActive: this.localStream?.active,
      localStreamTracks: this.localStream?.getTracks().length || 0,
      peerConnectionsCount: this.peerConnections.size,
      remoteStreamsCount: this.remoteStreams.size,
      bufferedMessagesCount: this.messageBuffer.length,
      hasHandlers: {
        onRemoteStream: !!this.onRemoteStreamHandler,
        onRemoteStreamRemoved: !!this.onRemoteStreamRemovedHandler,
        onConnectionStateChange: !!this.onConnectionStateChangeHandler
      }
    };
  }
}

// Create singleton instance
export const webRTCService = new WebRTCService();

// Make it globally available for WebSocket handlers
(window as any).webRTCService = webRTCService;

export default webRTCService;
