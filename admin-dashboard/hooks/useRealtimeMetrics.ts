/**
 * useRealtimeMetrics Hook
 * Connects to WebSocket and streams real-time analytics metrics
 */

import { useEffect, useState, useCallback } from 'react'
import { io, Socket } from 'socket.io-client'

interface DashboardMetrics {
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

/**
 * What the server told us about this connection's right to see GLOBAL
 * dashboard metrics (see websocket.service.ts's resolveDashboardAccess) --
 * 'pending' until the 'registered' response arrives. 'global' is the only
 * status that will ever actually receive a metrics-update event; 'scoped'
 * (a market-scoped staff member, e.g. MARKET_MANAGER) and 'denied'
 * (unauthenticated/no analytics access) are told apart so the UI can show
 * an honest "not available for your role" notice instead of an endless
 * loading state that looks like a bug.
 */
export type DashboardAccess = 'pending' | 'global' | 'scoped' | 'denied'

interface UseRealtimeMetricsReturn {
  metrics: DashboardMetrics | null
  isConnected: boolean
  error: string | null
  access: DashboardAccess
}

// NEXT_PUBLIC_API_URL includes the /api/v1 path suffix (e.g. https://techtoolstore.com/api/v1);
// Socket.IO needs the bare origin, otherwise it treats /api/v1 as a namespace and never connects.
const API_URL = (
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:9000/api/v1'
).replace(/\/api\/v1\/?$/, '')

export function useRealtimeMetrics(): UseRealtimeMetricsReturn {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [access, setAccess] = useState<DashboardAccess>('pending')
  const [socket, setSocket] = useState<Socket | null>(null)

  useEffect(() => {
    try {
      // Create socket connection -- the JWT travels in the handshake `auth`
      // payload (not a header, since browsers can't set custom headers on
      // a websocket upgrade request); the server verifies it before ever
      // joining this socket to the 'dashboard' room.
      const newSocket = io(API_URL, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: 5,
        auth: { token: typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null },
      })

      // Handle connection
      newSocket.on('connect', () => {
        setIsConnected(true)
        setError(null)

        // Register as dashboard client
        newSocket.emit('register', {
          type: 'dashboard',
        })
      })

      newSocket.on('registered', (data: { access?: DashboardAccess }) => {
        if (data.access) setAccess(data.access)
      })

      // Handle metrics updates
      newSocket.on('metrics-update', (data: DashboardMetrics) => {
        setMetrics(data)
      })

      // Handle alerts
      newSocket.on('alert-triggered', (alert: any) => {
        // Alert will be handled by separate alert subscription
        console.log('New alert triggered:', alert)
      })

      // Handle connection errors
      newSocket.on('connect_error', (err) => {
        setError(`Connection error: ${err.message}`)
        setIsConnected(false)
      })

      // Handle disconnect
      newSocket.on('disconnect', () => {
        setIsConnected(false)
      })

      setSocket(newSocket)

      return () => {
        newSocket.close()
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to connect to WebSocket'
      setError(message)
    }
  }, [])

  // Keep-alive ping
  useEffect(() => {
    if (!socket || !isConnected) return

    const pingInterval = setInterval(() => {
      socket.emit('ping')
    }, 30000) // Ping every 30 seconds

    return () => clearInterval(pingInterval)
  }, [socket, isConnected])

  return { metrics, isConnected, error, access }
}

/**
 * useRealtimeAlerts Hook
 * Subscribes to real-time alert events
 */

interface Alert {
  id: string
  alertType: string
  severity: 'critical' | 'high' | 'medium' | 'low'
  title: string
  message: string
  triggeredAt: string
}

interface UseRealtimeAlertsReturn {
  newAlert: Alert | null
  acknowledgedAlert: { alertId: string; acknowledgedBy: string } | null
  dismissedAlert: { alertId: string } | null
  isConnected: boolean
  error: string | null
  access: DashboardAccess
}

export function useRealtimeAlerts(): UseRealtimeAlertsReturn {
  const [newAlert, setNewAlert] = useState<Alert | null>(null)
  const [acknowledgedAlert, setAcknowledgedAlert] = useState<{ alertId: string; acknowledgedBy: string } | null>(null)
  const [dismissedAlert, setDismissedAlert] = useState<{ alertId: string } | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [access, setAccess] = useState<DashboardAccess>('pending')
  const [socket, setSocket] = useState<Socket | null>(null)

  useEffect(() => {
    try {
      // Create socket connection -- same handshake-auth token as
      // useRealtimeMetrics; alert-* broadcasts are equally global-only.
      const newSocket = io(API_URL, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: 5,
        auth: { token: typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null },
      })

      // Handle connection
      newSocket.on('connect', () => {
        setIsConnected(true)
        setError(null)

        // Register as dashboard client
        newSocket.emit('register', {
          type: 'dashboard',
        })
      })

      newSocket.on('registered', (data: { access?: DashboardAccess }) => {
        if (data.access) setAccess(data.access)
      })

      // Handle new alerts
      newSocket.on('alert-triggered', (alert: Alert) => {
        setNewAlert(alert)
      })

      // Handle alert acknowledgment
      newSocket.on('alert-acknowledged', (data: { alertId: string; acknowledgedBy: string }) => {
        setAcknowledgedAlert(data)
      })

      // Handle alert dismissal
      newSocket.on('alert-dismissed', (data: { alertId: string }) => {
        setDismissedAlert(data)
      })

      // Handle connection errors
      newSocket.on('connect_error', (err) => {
        setError(`Connection error: ${err.message}`)
        setIsConnected(false)
      })

      // Handle disconnect
      newSocket.on('disconnect', () => {
        setIsConnected(false)
      })

      setSocket(newSocket)

      return () => {
        newSocket.close()
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to connect to WebSocket'
      setError(message)
    }
  }, [])

  return { newAlert, acknowledgedAlert, dismissedAlert, isConnected, error, access }
}

/**
 * useWebSocketBroadcast Hook
 * Sends events through WebSocket to all connected clients
 */

export function useWebSocketBroadcast() {
  const [socket, setSocket] = useState<Socket | null>(null)

  useEffect(() => {
    const newSocket = io(API_URL, {
      transports: ['websocket', 'polling'],
    })

    setSocket(newSocket)

    return () => {
      newSocket.close()
    }
  }, [])

  const broadcast = useCallback(
    (event: string, data: any) => {
      if (socket?.connected) {
        socket.emit(event, data)
      }
    },
    [socket]
  )

  return { broadcast, isConnected: socket?.connected || false }
}
