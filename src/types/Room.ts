export interface Room {
  roomId: string
  roomKey: string
  name: string
  ownerUsername: string
  currentParticipants: number
  maxParticipants: number
  audioBitrate: number
  createdAt: string
  lastActivity: string
  isActive: boolean
  canJoin: boolean
  participants: RoomParticipant[]
}

export interface RoomParticipant {
  userId: string
  username: string
  isMuted: boolean
  isOwner: boolean
  joinedAt: string
}

export interface CreateRoomRequest {
  name: string
  maxParticipants: number
  audioBitrate: number
}

export interface JoinRoomRequest {
  roomKey: string
}

export interface User {
  id: string
  username: string
  token: string
}
