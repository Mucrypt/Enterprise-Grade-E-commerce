/**
 * WEBSOCKET SERVICE
 * Handles real-time analytics and alerts broadcasting via Socket.io
 */

import { Server as SocketIOServer, Socket } from 'socket.io'
import { Server as HTTPServer } from 'http'
import logger from '../utils/logger'

export interface DashboardMetrics {
  activeUsers: number
  eventsPerSecond: number
  lastHourRevenue: number
  lastHourOrders: number
  conversionRate: number
  activeAlerts: {
    critical: number
    high: number
    medium: number
    low: number
  }
}

interface ConnectedClient {
  id: string
  type: 'dashboard' | 'mobile' | 'web'
  userId?: string
  connectedAt: Date
}

class WebSocketService {
  private io: SocketIOServer | null = null
  private connectedClients: Map<string, ConnectedClient> = new Map()

  /**
   * Initialize Socket.io server
   */
  initialize(httpServer: HTTPServer): SocketIOServer {
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: [
          process.env.ADMIN_DASHBOARD_URL || 'http://localhost:3000',
          process.env.WEB_STORE_URL || 'http://localhost:5173',
          process.env.MOBILE_APP_URL || 'exp://localhost:8081',
        ],
        credentials: true,
      },
      transports: ['websocket', 'polling'],
    })

    this.setupConnectionHandlers()
    logger.info('✅ Socket.io server initialized')

    return this.io
  }

  /**
   * Setup connection and event handlers
   */
  private setupConnectionHandlers(): void {
    if (!this.io) return

    this.io.on('connection', (socket: Socket) => {
      logger.info(`Client connected: ${socket.id}`)

      // Store connected client info
      socket.on(
        'register',
        (data: { type: 'dashboard' | 'mobile' | 'web'; userId?: string }) => {
          const client: ConnectedClient = {
            id: socket.id,
            type: data.type,
            userId: data.userId,
            connectedAt: new Date(),
          }

          this.connectedClients.set(socket.id, client)

          // Join room based on client type
          if (data.type === 'dashboard') {
            socket.join('dashboard')
            logger.info(`Dashboard connected: ${socket.id}`)
          } else if (data.type === 'mobile') {
            socket.join('mobile-app')
          } else if (data.type === 'web') {
            socket.join('web-store')
          }

          socket.emit('registered', { clientId: socket.id, type: data.type })
        },
      )

      // Handle disconnect
      socket.on('disconnect', () => {
        this.connectedClients.delete(socket.id)
        logger.info(`Client disconnected: ${socket.id}`)
      })

      // Handle ping/pong for keep-alive
      socket.on('ping', () => {
        socket.emit('pong')
      })

      // Handle client subscribing to specific metrics
      socket.on('subscribe-metrics', (metrics: string[]) => {
        socket.join(`metrics:${metrics.join(',')}`)
      })

      // Handle client unsubscribing from metrics
      socket.on('unsubscribe-metrics', (metrics: string[]) => {
        socket.leave(`metrics:${metrics.join(',')}`)
      })
    })
  }

  /**
   * Broadcast metrics to dashboard clients
   */
  broadcastMetrics(metrics: DashboardMetrics): void {
    if (!this.io) return

    this.io.to('dashboard').emit('metrics-update', metrics)
  }

  /**
   * Broadcast new alert to dashboard
   */
  broadcastAlert(alert: any): void {
    if (!this.io) return

    this.io.to('dashboard').emit('alert-triggered', alert)
  }

  /**
   * Broadcast alert acknowledgment to dashboard
   */
  broadcastAlertAcknowledged(alertId: string, acknowledgedBy: string): void {
    if (!this.io) return

    this.io
      .to('dashboard')
      .emit('alert-acknowledged', { alertId, acknowledgedBy })
  }

  /**
   * Broadcast alert dismissal to dashboard
   */
  broadcastAlertDismissed(alertId: string): void {
    if (!this.io) return

    this.io.to('dashboard').emit('alert-dismissed', { alertId })
  }

  /**
   * Broadcast revenue update
   */
  broadcastRevenueUpdate(revenue: number, orderCount: number): void {
    if (!this.io) return

    this.io.to('dashboard').emit('revenue-update', { revenue, orderCount })
  }

  /**
   * Broadcast conversion rate update
   */
  broadcastConversionRateUpdate(rate: number): void {
    if (!this.io) return

    this.io.to('dashboard').emit('conversion-rate-update', { rate })
  }

  /**
   * Broadcast search quality update
   */
  broadcastSearchQualityUpdate(zeroResultRate: number): void {
    if (!this.io) return

    this.io.to('dashboard').emit('search-quality-update', { zeroResultRate })
  }

  /**
   * Broadcast user activity update
   */
  broadcastUserActivity(activeUsers: number): void {
    if (!this.io) return

    this.io.to('dashboard').emit('user-activity-update', { activeUsers })
  }

  /**
   * Send targeted message to specific room
   */
  sendToRoom(room: string, event: string, data: any): void {
    if (!this.io) return

    this.io.to(room).emit(event, data)
  }

  /**
   * Send targeted message to specific client
   */
  sendToClient(clientId: string, event: string, data: any): void {
    if (!this.io) return

    this.io.to(clientId).emit(event, data)
  }

  /**
   * Get connected clients count
   */
  getConnectedClientsCount(): number {
    return this.connectedClients.size
  }

  /**
   * Get connected clients by type
   */
  getConnectedClientsByType(
    type: 'dashboard' | 'mobile' | 'web',
  ): ConnectedClient[] {
    return Array.from(this.connectedClients.values()).filter(
      (c) => c.type === type,
    )
  }

  /**
   * Get Socket.io instance
   */
  getIO(): SocketIOServer | null {
    return this.io
  }
}

// Export singleton instance
export const webSocketService = new WebSocketService()
