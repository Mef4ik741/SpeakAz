export interface P2PRoom {
  id: number
  name: string
  roomKey: string
  ownerUsername: string
  serverAddress: string
  maxParticipants: number
  currentParticipants: number
  isActive: boolean
  requirePassword: boolean
  description?: string
  createdAt: string
  lastActivity: string
  isFull: boolean
  canJoin: boolean
  connections: P2PConnection[]
}

export interface P2PConnection {
  id: number
  username: string
  userIP: string
  connectedAt: string
  isActive: boolean
  isMuted: boolean
  lastPing: string
  latency?: number
  connectionQuality: number
  connectionStatus: string
  connectionDuration: string
}

export interface CreateP2PRoomRequest {
  name: string
  serverPort: number
  maxParticipants?: number
  requirePassword?: boolean
  password?: string
  description?: string
}

export interface JoinP2PRoomRequest {
  roomKey: string
  password?: string
}

export interface P2PServerStatus {
  roomKey: string
  isRunning: boolean
  status: 'running' | 'stopped'
}

export interface P2PServerInfo {
  roomKey: string
  port: number
  serverAddress: string
  message: string
}
