/**
 * WEBSOCKET SERVICE
 * Handles real-time analytics and alerts broadcasting via Socket.io
 */

import { Server as SocketIOServer, Socket } from 'socket.io'
import { Server as HTTPServer } from 'http'
import jwt from 'jsonwebtoken'
import logger from '../utils/logger'
import { JWT_SECRET } from '../config/jwt.config'
import { loadStaffContext } from '../middleware/staff'
import { DASHBOARD_ORIGINS } from '../config/cors.config'

/**
 * Who may join the 'dashboard' room and therefore receive
 * metrics-update/alert-* broadcasts -- these are GLOBAL, unscoped figures
 * by construction (see metrics.broadcaster.ts), the real-time equivalent
 * of the legacy analytics.controller.ts endpoints, not a market-scoped
 * feed. There is no per-market realtime stream to join instead (out of
 * scope for ADMIN-2B per its own "do not redesign Analytics" instruction)
 * -- a scoped caller gets 'scoped' back (not silently 'denied', so the
 * frontend can render an honest notice instead of a connection error) and
 * is never added to the room.
 *
 * Historically this checked nothing at all: any socket, authenticated or
 * not, could `emit('register', {type:'dashboard'})` and receive live
 * global revenue/orders/conversion/alerts/visitor-country data. Found and
 * fixed in ADMIN-2B Production Review Round 1 -- see
 * docs/ADMIN-2B-ANALYTICS-2-IMPLEMENTATION-REPORT.md.
 */
export type DashboardAccess = 'global' | 'scoped' | 'denied'

export async function resolveDashboardAccess(token: unknown): Promise<DashboardAccess> {
  if (typeof token !== 'string' || !token) return 'denied'

  let decoded: jwt.JwtPayload
  try {
    decoded = jwt.verify(token, JWT_SECRET) as jwt.JwtPayload
  } catch {
    return 'denied'
  }

  const userType = decoded.userType
  if (userType === 'admin' || userType === 'super_admin') return 'global'

  const userId = decoded.userId
  if (!userId) return 'denied'

  try {
    const staff = await loadStaffContext(userId)
    const hasGlobalMembership = staff.memberships.some((m) => m.marketScope === null)
    if (hasGlobalMembership) return 'global'
    if (staff.permissions.has('analytics.view_market')) return 'scoped'
    return 'denied'
  } catch (error) {
    logger.error('resolveDashboardAccess: failed to load staff context', error)
    return 'denied'
  }
}

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
  topCountries: {
    countryCode: string
    countryName: string
    count: number
  }[]
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
      // Reuse the same allowlist as the REST API's CORS policy (CORS_ORIGIN)
      // rather than the ADMIN_DASHBOARD_URL/WEB_STORE_URL/MOBILE_APP_URL email-
      // link vars: those are full page URLs (e.g. ".../admin/dashboard"), not
      // bare origins, so they never match a browser's Origin header, and they
      // weren't even being forwarded into the api container's env in prod --
      // both independently broke the dashboard's websocket handshake.
      cors: {
        origin: DASHBOARD_ORIGINS,
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
        async (data: { type: 'dashboard' | 'mobile' | 'web'; userId?: string }) => {
          const client: ConnectedClient = {
            id: socket.id,
            type: data.type,
            userId: data.userId,
            connectedAt: new Date(),
          }

          this.connectedClients.set(socket.id, client)

          // Join room based on client type
          if (data.type === 'dashboard') {
            // metrics-update/alert-* are GLOBAL, unscoped broadcasts (see
            // resolveDashboardAccess's doc comment above) -- only join the
            // room if the caller actually holds global access. A scoped
            // (MARKET_MANAGER-shaped) or unauthenticated caller is told
            // their status via 'registered' but never added to 'dashboard',
            // so they structurally cannot receive a single global metric,
            // regardless of what the frontend chooses to render.
            const access = await resolveDashboardAccess(socket.handshake.auth?.token)
            if (access === 'global') {
              socket.join('dashboard')
              logger.info(`Dashboard connected (global): ${socket.id}`)
            } else {
              logger.info(`Dashboard registration without global access (${access}): ${socket.id}`)
            }
            socket.emit('registered', { clientId: socket.id, type: data.type, access })
            return
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
