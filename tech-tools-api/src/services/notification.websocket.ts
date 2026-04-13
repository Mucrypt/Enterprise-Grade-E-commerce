import type { Server as HTTPServer } from 'http'
import logger from '../utils/logger'

// socket.io types - import at runtime if needed
// Use any types since socket.io is optional dependency
type Socket = any
type Server = any

let io: any = null
try {
  const socketIO = require('socket.io')
  io = socketIO.Server
} catch (e) {
  logger.warn('socket.io not installed - WebSocket notifications disabled')
}

export interface SocketUser {
  id: string
  role: string
  isAdmin: boolean
}

export class NotificationWebSocket {
  private io: any
  private userSockets: Map<string, string[]> = new Map() // userId -> [socketIds]
  private socketUsers: Map<string, SocketUser> = new Map() // socketId -> user

  constructor(httpServer: HTTPServer) {
    if (!io) {
      logger.warn('Socket.io not available - WebSocket notifications disabled')
      return
    }

    this.io = new io(httpServer, {
      cors: {
        origin: [
          process.env.ADMIN_URL || 'http://localhost:3000',
          process.env.WEBSTORE_URL || 'http://localhost:5173',
        ],
        credentials: true,
      },
      transports: ['websocket', 'polling'],
    })

    this.setupMiddleware()
    this.setupEventHandlers()
  }

  /**
   * Setup middleware for authentication
   */
  private setupMiddleware() {
    if (!this.io) return

    this.io.use((socket, next) => {
      try {
        // Get token from handshake auth
        const token = socket.handshake.auth?.token
        if (!token) {
          return next(new Error('Authentication error: no token'))
        }

        // TODO: Verify JWT token and extract user data
        // For now, just extract from socket data
        const user = socket.handshake.auth?.user as SocketUser
        if (!user) {
          return next(new Error('Authentication error: no user'))
        }

        socket.data.user = user
        next()
      } catch (error) {
        next(new Error('Authentication error'))
      }
    })
  }

  /**
   * Setup event handlers
   */
  private setupEventHandlers() {
    if (!this.io) return

    this.io.on('connection', (socket: Socket) => {
      const user = socket.data.user as SocketUser
      logger.info(`User connected: ${user.id} (${socket.id})`)

      // Track user socket
      if (!this.userSockets.has(user.id)) {
        this.userSockets.set(user.id, [])
      }
      this.userSockets.get(user.id)!.push(socket.id)
      this.socketUsers.set(socket.id, user)

      // Join user room
      socket.join(`user:${user.id}`)

      // Join admin room if admin
      if (user.isAdmin) {
        socket.join('admin')
      }

      // Handle disconnect
      socket.on('disconnect', () => {
        logger.info(`User disconnected: ${user.id}`)
        const sockets = this.userSockets.get(user.id) || []
        const idx = sockets.indexOf(socket.id)
        if (idx > -1) {
          sockets.splice(idx, 1)
        }
        this.socketUsers.delete(socket.id)
      })

      // Handle notification events
      socket.on('notification:read', (notificationId: string) => {
        this.handleNotificationRead(user, notificationId)
      })

      socket.on('notification:archive', (notificationId: string) => {
        this.handleNotificationArchive(user, notificationId)
      })

      // Send initial connected message
      socket.emit('connected', {
        userId: user.id,
        role: user.role,
        socketId: socket.id,
      })
    })
  }

  /**
   * Send notification to a user
   */
  sendToUser(userId: string, notification: any) {
    if (!this.io) return
    logger.debug(`Sending notification to user ${userId}`)
    this.io.to(`user:${userId}`).emit('notification', notification)
  }

  /**
   * Send notification to all admins
   */
  broadcastToAdmins(notification: any) {
    if (!this.io) return
    logger.debug('Broadcasting notification to all admins')
    this.io.to('admin').emit('admin:notification', notification)
  }

  /**
   * Send real-time admin alert (for things like "new order", "low stock", etc.)
   */
  sendAdminAlert(type: string, data: any) {
    if (!this.io) return
    logger.debug(`Sending admin alert: ${type}`)
    this.io.to('admin').emit('admin:alert', {
      type,
      data,
      timestamp: new Date(),
    })
  }

  /**
   * Update unread count for user
   */
  updateUnreadCount(userId: string, count: number) {
    if (!this.io) return
    this.io.to(`user:${userId}`).emit('notification:unreadCount', count)
  }

  /**
   * Handle notification read event
   */
  private handleNotificationRead(user: SocketUser, notificationId: string) {
    if (!this.io) return
    logger.debug(
      `User ${user.id} marked notification ${notificationId} as read`,
    )
    // Emit to other sockets of same user
    this.io
      .to(`user:${user.id}`)
      .emit('notification:read:confirmed', notificationId)
  }

  /**
   * Handle notification archive event
   */
  private handleNotificationArchive(user: SocketUser, notificationId: string) {
    if (!this.io) return
    logger.debug(`User ${user.id} archived notification ${notificationId}`)
    // Emit to other sockets of same user
    this.io
      .to(`user:${user.id}`)
      .emit('notification:archived:confirmed', notificationId)
  }

  /**
   * Get connected users count
   */
  getConnectedUsers() {
    return this.userSockets.size
  }

  /**
   * Get IO instance
   */
  getIO() {
    return this.io
  }
}

export default NotificationWebSocket
