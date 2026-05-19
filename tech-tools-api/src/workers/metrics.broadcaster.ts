/**
 * REAL-TIME METRICS BROADCASTER
 * Periodically fetches analytics and broadcasts updates to connected dashboard clients
 * Runs every 30 seconds to provide near real-time insights
 */

import { query } from '../database/connection'
import {
  webSocketService,
  type DashboardMetrics,
} from '../services/websocket.service'
import logger from '../utils/logger'

let metricsInterval: NodeJS.Timeout | null = null

/**
 * Calculate current active users (sessions in last 5 minutes)
 */
async function getActiveUsers(): Promise<number> {
  try {
    const result = await query(
      `SELECT COUNT(DISTINCT user_id) as active_users 
       FROM user_sessions 
       WHERE end_time IS NULL OR end_time > NOW() - INTERVAL '5 minutes'`,
    )
    return result.rows[0]?.active_users || 0
  } catch (error) {
    logger.error('Error calculating active users:', error)
    return 0
  }
}

/**
 * Calculate events per second (last minute)
 */
async function getEventsPerSecond(): Promise<number> {
  try {
    const result = await query(
      `SELECT COUNT(*) as event_count 
       FROM events_core 
       WHERE event_time > NOW() - INTERVAL '1 minute'`,
    )
    const eventCount = result.rows[0]?.event_count || 0
    return Number((eventCount / 60).toFixed(2))
  } catch (error) {
    logger.error('Error calculating events per second:', error)
    return 0
  }
}

/**
 * Calculate last hour revenue
 */
async function getLastHourRevenue(): Promise<number> {
  try {
    const result = await query(
      `SELECT SUM(o.grand_total) as revenue
       FROM orders o
       WHERE o.created_at > NOW() - INTERVAL '1 hour'
      AND o.order_status IN ('confirmed', 'processing', 'ready_to_ship', 'shipped', 'delivered')`,
    )
    return result.rows[0]?.revenue ? Number(result.rows[0].revenue) : 0
  } catch (error) {
    logger.error('Error calculating last hour revenue:', error)
    return 0
  }
}

/**
 * Calculate last hour order count
 */
async function getLastHourOrders(): Promise<number> {
  try {
    const result = await query(
      `SELECT COUNT(*) as order_count
       FROM orders
       WHERE created_at > NOW() - INTERVAL '1 hour'
      AND order_status IN ('confirmed', 'processing', 'ready_to_ship', 'shipped', 'delivered')`,
    )
    return result.rows[0]?.order_count || 0
  } catch (error) {
    logger.error('Error calculating last hour orders:', error)
    return 0
  }
}

/**
 * Calculate conversion rate (last 24 hours)
 */
async function getConversionRate(): Promise<number> {
  try {
    const result = await query(
      `SELECT 
        COUNT(DISTINCT CASE WHEN event_type = 'product_view' THEN user_id END) as viewers,
        COUNT(DISTINCT CASE WHEN event_type = 'payment_success' THEN user_id END) as buyers
       FROM events_core
       WHERE event_time > NOW() - INTERVAL '24 hours'`,
    )
    const { viewers = 0, buyers = 0 } = result.rows[0] || {}
    if (viewers === 0) return 0
    return Number(((buyers / viewers) * 100).toFixed(2))
  } catch (error) {
    logger.error('Error calculating conversion rate:', error)
    return 0
  }
}

/**
 * Get active alerts count by severity
 */
async function getActiveAlertStats(): Promise<{
  critical: number
  high: number
  medium: number
  low: number
}> {
  try {
    const result = await query(
      `SELECT 
        COUNT(*) FILTER (WHERE severity = 'critical') as critical,
        COUNT(*) FILTER (WHERE severity = 'high') as high,
        COUNT(*) FILTER (WHERE severity = 'medium') as medium,
        COUNT(*) FILTER (WHERE severity = 'low') as low
       FROM alerts
       WHERE is_active = true`,
    )
    const row = result.rows[0] || {}
    return {
      critical: row.critical || 0,
      high: row.high || 0,
      medium: row.medium || 0,
      low: row.low || 0,
    }
  } catch (error: any) {
    // Gracefully handle missing alerts table
    if (error?.code === '42P01') {
      logger.warn('Skipping alert stats: alerts table is missing')
      return { critical: 0, high: 0, medium: 0, low: 0 }
    }
    logger.error('Error getting alert stats:', error)
    return { critical: 0, high: 0, medium: 0, low: 0 }
  }
}

/**
 * Fetch all metrics and broadcast to dashboard
 */
async function fetchAndBroadcastMetrics(): Promise<void> {
  try {
    const [
      activeUsers,
      eventsPerSecond,
      lastHourRevenue,
      lastHourOrders,
      conversionRate,
      activeAlerts,
    ] = await Promise.all([
      getActiveUsers(),
      getEventsPerSecond(),
      getLastHourRevenue(),
      getLastHourOrders(),
      getConversionRate(),
      getActiveAlertStats(),
    ])

    const metrics: DashboardMetrics = {
      activeUsers,
      eventsPerSecond,
      lastHourRevenue,
      lastHourOrders,
      conversionRate,
      activeAlerts,
    }

    webSocketService.broadcastMetrics(metrics)
    logger.debug('Real-time metrics broadcasted', metrics)
  } catch (error) {
    logger.error('Error broadcasting metrics:', error)
  }
}

/**
 * Start the real-time metrics broadcaster
 * Broadcasts every 30 seconds
 */
export function startMetricsBroadcaster(): void {
  try {
    // Broadcast immediately
    fetchAndBroadcastMetrics().catch((err) =>
      logger.error('Error in initial metrics broadcast:', err),
    )

    // Then broadcast periodically
    metricsInterval = setInterval(async () => {
      await fetchAndBroadcastMetrics()
    }, 30 * 1000) // Every 30 seconds

    logger.info(
      '✅ Real-time metrics broadcaster started (updates every 30 seconds)',
    )
  } catch (error) {
    logger.error('Failed to start metrics broadcaster:', error)
  }
}

/**
 * Stop the metrics broadcaster
 */
export function stopMetricsBroadcaster(): void {
  if (metricsInterval) {
    clearInterval(metricsInterval)
    metricsInterval = null
    logger.info('Real-time metrics broadcaster stopped')
  }
}

/**
 * Manually trigger metrics broadcast
 */
export async function triggerMetricsBroadcast(): Promise<void> {
  await fetchAndBroadcastMetrics()
}
