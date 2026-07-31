/**
 * ANALYTICS CONTROLLER
 * Real analytics endpoints for admin dashboard
 * Queries actual events and orders from database
 */

import { Request, Response } from 'express'
import { query } from '../../../database/connection'
import pool from '../../../config/database'
import logger from '../../../utils/logger'
import { AuthRequest } from '../../../middleware/auth'
import { getClientIp } from '../../../utils/helpers'
import { createEventService } from '../../../services/event.service'
import { EventSource } from '../../../types/events'

const eventService = createEventService(pool)

async function tableExists(tableName: string): Promise<boolean> {
  const result = await query('SELECT to_regclass($1) IS NOT NULL AS exists', [
    tableName,
  ])

  return Boolean(result.rows[0]?.exists)
}

export const getRevenueTrend = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const { days = 7 } = req.query
    const numDays = parseInt(days as string) || 7

    const queryText = `
      SELECT
        DATE(o.created_at) as date,
        COUNT(o.id) as order_count,
        SUM(o.total_amount) as revenue,
        AVG(o.total_amount) as average_order_value
      FROM orders o
      WHERE o.created_at >= NOW() - INTERVAL '${numDays} days'
      AND o.order_status IN ('confirmed', 'processing', 'ready_to_ship', 'shipped', 'delivered')
      GROUP BY DATE(o.created_at)
      ORDER BY DATE(o.created_at) ASC;
    `

    const result = await query(queryText)

    const data = result.rows.map((row) => ({
      date: row.date.toISOString().split('T')[0],
      revenue: parseFloat(row.revenue) || 0,
      orderCount: parseInt(row.order_count) || 0,
      averageOrderValue: parseFloat(row.average_order_value) || 0,
    }))

    res.json({
      period: `${numDays}_days`,
      data,
      summary: {
        totalRevenue: data.reduce((sum, d) => sum + d.revenue, 0),
        totalOrders: data.reduce((sum, d) => sum + d.orderCount, 0),
        averageRevenue:
          data.reduce((sum, d) => sum + d.revenue, 0) / data.length || 0,
      },
    })
  } catch (error) {
    logger.error('Error fetching revenue trend:', error)
    res.status(500).json({ error: 'Failed to fetch revenue trend' })
  }
}

export const getConversionFunnel = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const { days = 7 } = req.query
    const numDays = parseInt(days as string) || 7

    const queryText = `
      WITH event_counts AS (
        SELECT
          event_type,
          COUNT(*) as event_count,
          COUNT(DISTINCT user_id) as unique_users,
          COUNT(DISTINCT session_id) as unique_sessions
        FROM events_core
        WHERE event_time >= NOW() - INTERVAL '${numDays} days'
        AND event_type IN ('product_view', 'add_to_cart', 'checkout_start', 'payment_success')
        GROUP BY event_type
      )
      SELECT
        event_type,
        event_count,
        unique_users,
        unique_sessions
      FROM event_counts
      ORDER BY 
        CASE event_type
          WHEN 'product_view' THEN 1
          WHEN 'add_to_cart' THEN 2
          WHEN 'checkout_start' THEN 3
          WHEN 'payment_success' THEN 4
        END;
    `

    const result = await query(queryText)

    const steps = [
      'product_view',
      'add_to_cart',
      'checkout_start',
      'payment_success',
    ]
    const eventMap = new Map()

    result.rows.forEach((row) => {
      eventMap.set(row.event_type, {
        eventCount: parseInt(row.event_count),
        uniqueUsers: parseInt(row.unique_users),
        uniqueSessions: parseInt(row.unique_sessions),
      })
    })

    let previousCount = 0
    const funnelData = steps.map((step) => {
      const data = eventMap.get(step) || {
        eventCount: 0,
        uniqueUsers: 0,
        uniqueSessions: 0,
      }
      const eventCount = data.eventCount
      const conversionRate =
        previousCount > 0 ? (eventCount / previousCount) * 100 : 100
      previousCount = eventCount

      return {
        step,
        eventCount,
        uniqueUsers: data.uniqueUsers,
        conversionRate: Math.round(conversionRate * 100) / 100,
      }
    })

    res.json({
      period: `${numDays}_days`,
      funnel: funnelData,
      summary: {
        topOfFunnelUsers: funnelData[0]?.uniqueUsers || 0,
        paymentSuccessUsers: funnelData[3]?.uniqueUsers || 0,
        overallConversionRate:
          funnelData[3] && funnelData[0].eventCount > 0
            ? (
                (funnelData[3].eventCount / funnelData[0].eventCount) *
                100
              ).toFixed(2)
            : 0,
      },
    })
  } catch (error) {
    logger.error('Error fetching conversion funnel:', error)
    res.status(500).json({ error: 'Failed to fetch conversion funnel' })
  }
}

export const getTopProducts = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const { days = 7, limit = 10 } = req.query
    const numDays = parseInt(days as string) || 7
    const numLimit = parseInt(limit as string) || 10

    const queryText = `
      WITH product_events AS (
        SELECT
          e.product_id,
          p.name as product_name,
          p.sku,
          COUNT(CASE WHEN e.event_type = 'product_view' THEN 1 END) as view_count,
          COUNT(CASE WHEN e.event_type = 'add_to_cart' THEN 1 END) as cart_count,
          COUNT(CASE WHEN e.event_type = 'payment_success' AND o.id IS NOT NULL THEN 1 END) as purchase_count,
          SUM(CASE WHEN e.event_type = 'payment_success' AND o.id IS NOT NULL THEN o.total_amount ELSE 0 END) as revenue
        FROM events_core e
        LEFT JOIN products p ON e.product_id = p.id
        LEFT JOIN orders o ON e.order_id = o.id
        WHERE e.event_time >= NOW() - INTERVAL '${numDays} days'
        AND e.product_id IS NOT NULL
        AND e.event_type IN ('product_view', 'add_to_cart', 'payment_success')
        GROUP BY e.product_id, p.name, p.sku
      )
      SELECT
        product_id,
        product_name,
        sku,
        view_count,
        cart_count,
        purchase_count,
        COALESCE(revenue, 0) as revenue,
        CASE WHEN view_count > 0
          THEN ROUND((cart_count::NUMERIC / view_count) * 100, 2)
          ELSE 0
        END as conversion_rate
      FROM product_events
      WHERE view_count > 0
      ORDER BY view_count DESC
      LIMIT $1;
    `

    const result = await query(queryText, [numLimit])

    const products = result.rows.map((row) => ({
      productId: row.product_id,
      productName: row.product_name,
      sku: row.sku,
      viewCount: parseInt(row.view_count),
      addToCartCount: parseInt(row.cart_count),
      purchaseCount: parseInt(row.purchase_count),
      revenue: parseFloat(row.revenue) || 0,
      conversionRate: parseFloat(row.conversion_rate) || 0,
    }))

    res.json({
      period: `${numDays}_days`,
      topProducts: products,
      summary: {
        totalViews: products.reduce((sum, p) => sum + p.viewCount, 0),
        totalPurchases: products.reduce((sum, p) => sum + p.purchaseCount, 0),
        totalRevenue: products.reduce((sum, p) => sum + p.revenue, 0),
      },
    })
  } catch (error) {
    logger.error('Error fetching top products:', error)
    res.status(500).json({ error: 'Failed to fetch top products' })
  }
}

export const getSearchMetrics = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const { days = 7 } = req.query
    const numDays = parseInt(days as string) || 7

    const queryText = `
      SELECT
        COUNT(*) as total_searches,
        COUNT(CASE WHEN payload->>'resultsCount' = '0' THEN 1 END) as zero_result_searches,
        ROUND(
          COUNT(CASE WHEN payload->>'resultsCount' = '0' THEN 1 END)::NUMERIC
          / NULLIF(COUNT(*), 0)::NUMERIC * 100,
          2
        ) as zero_result_rate,
        COUNT(DISTINCT user_id) as unique_users
      FROM events_core
      WHERE event_type = 'search'
      AND event_time >= NOW() - INTERVAL '${numDays} days';
    `

    const result = await query(queryText)
    const row = result.rows[0]

    res.json({
      period: `${numDays}_days`,
      totalSearches: parseInt(row.total_searches),
      zeroResultSearches: parseInt(row.zero_result_searches),
      zeroResultRate: parseFloat(row.zero_result_rate) || 0,
      uniqueSearchUsers: parseInt(row.unique_users),
    })
  } catch (error) {
    logger.error('Error fetching search metrics:', error)
    res.status(500).json({ error: 'Failed to fetch search metrics' })
  }
}

export const getRefundRate = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const { days = 30 } = req.query
    const numDays = parseInt(days as string) || 30

    const orderResult = await query(
      `SELECT
        COUNT(*) as total_orders,
        COUNT(DISTINCT DATE(created_at)) as days_with_orders
       FROM orders
       WHERE created_at >= NOW() - INTERVAL '${numDays} days'
       AND order_status IN ('confirmed', 'processing', 'ready_to_ship', 'shipped', 'delivered')`,
    )
    const orderRow = orderResult.rows[0]
    const hasRefundsTable = await tableExists('public.refunds')

    if (!hasRefundsTable) {
      res.json({
        period: `${numDays}_days`,
        totalOrders: parseInt(orderRow.total_orders),
        totalRefunds: 0,
        refundRate: 0,
        totalRefundAmount: 0,
        avgRefundAmount: 0,
      })
      return
    }

    const refundResult = await query(
      `SELECT
        COUNT(*) as total_refunds,
        SUM(amount) as total_refund_amount,
        AVG(amount) as avg_refund_amount
       FROM refunds
       WHERE created_at >= NOW() - INTERVAL '${numDays} days'
       AND status = 'completed'`,
    )
    const refundRow = refundResult.rows[0]
    const totalOrders = parseInt(orderRow.total_orders)
    const totalRefunds = parseInt(refundRow.total_refunds)

    res.json({
      period: `${numDays}_days`,
      totalOrders,
      totalRefunds,
      refundRate:
        totalOrders > 0
          ? parseFloat(((totalRefunds / totalOrders) * 100).toFixed(2))
          : 0,
      totalRefundAmount: parseFloat(refundRow.total_refund_amount) || 0,
      avgRefundAmount: parseFloat(refundRow.avg_refund_amount) || 0,
    })
  } catch (error) {
    logger.error('Error fetching refund rate:', error)
    res.status(500).json({ error: 'Failed to fetch refund rate' })
  }
}

export const getReturnRate = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const { days = 30 } = req.query
    const numDays = parseInt(days as string) || 30

    const queryText = `
      SELECT COUNT(*) as total_shipped
      FROM orders
      WHERE created_at >= NOW() - INTERVAL '${numDays} days'
      AND order_status IN ('shipped', 'delivered');
    `

    const result = await query(queryText)
    const row = result.rows[0]
    const hasReturnsTable = await tableExists('public.returns')

    if (!hasReturnsTable) {
      res.json({
        period: `${numDays}_days`,
        totalShipped: parseInt(row.total_shipped),
        totalReturns: 0,
        returnRate: 0,
      })
      return
    }

    const returnsResult = await query(
      `SELECT COUNT(*) as total_returns
       FROM returns
       WHERE created_at >= NOW() - INTERVAL '${numDays} days'
       AND status IN ('initiated', 'approved', 'completed')`,
    )
    const returnsRow = returnsResult.rows[0]

    res.json({
      period: `${numDays}_days`,
      totalShipped: parseInt(row.total_shipped),
      totalReturns: parseInt(returnsRow.total_returns),
      returnRate:
        row.total_shipped > 0
          ? parseFloat(
              (
                (parseInt(returnsRow.total_returns) / row.total_shipped) *
                100
              ).toFixed(2),
            )
          : 0,
    })
  } catch (error) {
    logger.error('Error fetching return rate:', error)
    res.status(500).json({ error: 'Failed to fetch return rate' })
  }
}

export const getCheckoutAbandonment = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const { days = 7 } = req.query
    const numDays = parseInt(days as string) || 7

    const queryText = `
      WITH checkout_events AS (
        SELECT
          COUNT(CASE WHEN event_type = 'checkout_start' THEN 1 END) as checkout_starts,
          COUNT(CASE WHEN event_type = 'payment_success' THEN 1 END) as payment_successes,
          COUNT(DISTINCT CASE WHEN event_type = 'checkout_start' THEN session_id END) as abandoned_sessions
        FROM events_core
        WHERE event_time >= NOW() - INTERVAL '${numDays} days'
        AND event_type IN ('checkout_start', 'payment_success')
      )
      SELECT
        checkout_starts,
        payment_successes,
        abandoned_sessions,
        CASE WHEN checkout_starts > 0
          THEN ROUND(((checkout_starts - payment_successes)::NUMERIC / checkout_starts) * 100, 2)
          ELSE 0
        END as abandonment_rate
      FROM checkout_events;
    `

    const result = await query(queryText)
    const row = result.rows[0]

    res.json({
      period: `${numDays}_days`,
      checkoutStartCount: parseInt(row.checkout_starts),
      paymentSuccessCount: parseInt(row.payment_successes),
      abandonmentCount:
        parseInt(row.checkout_starts) - parseInt(row.payment_successes),
      abandonmentRate: parseFloat(row.abandonment_rate) || 0,
      estimatedAbandonedValue: 0, // Can be calculated if we track cart values
    })
  } catch (error) {
    logger.error('Error fetching checkout abandonment:', error)
    res.status(500).json({ error: 'Failed to fetch checkout abandonment' })
  }
}

export const batchInsertEvents = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { events } = req.body

    if (!Array.isArray(events) || events.length === 0) {
      res.status(400).json({ error: 'Events array required' })
      return
    }

    const ipAddress = getClientIp(req)
    await upsertSessionsForBatch(events, ipAddress)

    const insertedCount = await insertEventsBatch(events)

    res.json({
      success: true,
      insertedCount,
      message: `Successfully inserted ${insertedCount} events`,
    })
  } catch (error) {
    logger.error('Error batch inserting events:', error)
    res.status(500).json({ error: 'Failed to insert events' })
  }
}

/**
 * Ensure every session referenced in this batch exists in user_sessions before the
 * events themselves are inserted (events_core.session_id has a FK to user_sessions).
 * Uses the first event carrying a given session as that session's context source.
 */
async function upsertSessionsForBatch(
  events: any[],
  ipAddress: string,
): Promise<void> {
  const seenSessions = new Set<string>()

  for (const event of events) {
    const sessionId = event.sessionId
    if (!sessionId || seenSessions.has(sessionId)) continue
    seenSessions.add(sessionId)

    const context = event.context || {}
    await eventService.createOrUpdateSession(
      sessionId,
      event.userId || undefined,
      (event.source || 'web_store') as EventSource,
      {
        ipAddress,
        userAgent: context.userAgent,
        referrer: context.referrer,
        utmSource: context.utmSource,
        utmMedium: context.utmMedium,
        utmCampaign: context.utmCampaign,
        utmContent: context.utmContent,
        utmTerm: context.utmTerm,
      },
    )
  }
}

/**
 * Helper: Insert events in batch
 */
async function insertEventsBatch(events: any[]): Promise<number> {
  let insertedCount = 0

  for (const event of events) {
    try {
      const queryText = `
        INSERT INTO events_core (
          event_type, user_id, session_id, source, device_type,
          product_id, sku, category_id, order_id, supplier_id,
          payload, value, duration_ms, event_time, created_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, CURRENT_TIMESTAMP)
        ON CONFLICT DO NOTHING;
      `

      const payload = event.payload || {}
      await query(queryText, [
        event.eventType,
        event.userId || null,
        event.sessionId || null,
        event.source,
        event.deviceType || 'unknown',
        payload.productId || null,
        payload.sku || null,
        payload.categoryId || null,
        payload.orderId || null,
        null,
        JSON.stringify(payload),
        payload.value || payload.price || null,
        payload.duration_ms || null,
        event.timestamp || new Date(),
      ])

      insertedCount++
    } catch (error) {
      logger.warn('Error inserting individual event:', error)
    }
  }

  return insertedCount
}

export const getLiveVisitors = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const { minutes = 5 } = req.query
    const numMinutes = parseInt(minutes as string) || 5

    const visitorsResult = await query(`
      SELECT
        s.session_id,
        s.user_id,
        s.country_code,
        s.country_name,
        s.city,
        s.device_type,
        s.browser_name,
        s.os_name,
        s.source,
        s.utm_source,
        s.utm_medium,
        s.utm_campaign,
        s.referrer,
        s.start_time,
        s.last_activity_time,
        (SELECT COUNT(*) FROM events_core e WHERE e.session_id = s.session_id) as page_views
      FROM user_sessions s
      WHERE s.end_time IS NULL OR s.last_activity_time > NOW() - INTERVAL '${numMinutes} minutes'
      ORDER BY s.last_activity_time DESC
      LIMIT 100;
    `)

    const countResult = await query(`
      SELECT COUNT(DISTINCT session_id) as active_count
      FROM user_sessions
      WHERE end_time IS NULL OR last_activity_time > NOW() - INTERVAL '${numMinutes} minutes';
    `)

    res.json({
      windowMinutes: numMinutes,
      activeCount: parseInt(countResult.rows[0]?.active_count) || 0,
      visitors: visitorsResult.rows.map((row) => ({
        sessionId: row.session_id,
        userId: row.user_id,
        countryCode: row.country_code,
        countryName: row.country_name,
        city: row.city,
        deviceType: row.device_type,
        browserName: row.browser_name,
        osName: row.os_name,
        source: row.source,
        utmSource: row.utm_source,
        utmMedium: row.utm_medium,
        utmCampaign: row.utm_campaign,
        referrer: row.referrer,
        startTime: row.start_time,
        lastActivityTime: row.last_activity_time,
        pageViews: parseInt(row.page_views) || 0,
      })),
    })
  } catch (error) {
    logger.error('Error fetching live visitors:', error)
    res.status(500).json({ error: 'Failed to fetch live visitors' })
  }
}

export const getVisitorsByCountry = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const { days = 7 } = req.query
    const numDays = parseInt(days as string) || 7

    const result = await query(`
      SELECT
        COALESCE(country_code, 'XX') as country_code,
        COALESCE(country_name, 'Unknown') as country_name,
        COUNT(DISTINCT session_id) as session_count,
        COUNT(DISTINCT COALESCE(user_id::text, session_id)) as unique_visitors,
        AVG(session_duration_seconds) as avg_duration_seconds
      FROM user_sessions
      WHERE start_time >= NOW() - INTERVAL '${numDays} days'
      GROUP BY COALESCE(country_code, 'XX'), COALESCE(country_name, 'Unknown')
      ORDER BY session_count DESC;
    `)

    const data = result.rows.map((row) => ({
      countryCode: row.country_code,
      countryName: row.country_name,
      sessionCount: parseInt(row.session_count) || 0,
      uniqueVisitors: parseInt(row.unique_visitors) || 0,
      avgDurationSeconds: Math.round(parseFloat(row.avg_duration_seconds)) || 0,
    }))

    res.json({
      period: `${numDays}_days`,
      data,
      summary: {
        totalSessions: data.reduce((sum, d) => sum + d.sessionCount, 0),
        countryCount: data.filter((d) => d.countryCode !== 'XX').length,
      },
    })
  } catch (error) {
    logger.error('Error fetching visitors by country:', error)
    res.status(500).json({ error: 'Failed to fetch visitors by country' })
  }
}

export const getChannelBreakdown = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const { days = 7 } = req.query
    const numDays = parseInt(days as string) || 7

    const result = await query(`
      SELECT
        COALESCE(s.utm_source, 'direct') as utm_source,
        COALESCE(s.utm_medium, 'none') as utm_medium,
        s.utm_campaign,
        COUNT(DISTINCT s.session_id) as session_count,
        COUNT(DISTINCT o.id) as order_count,
        COALESCE(SUM(o.grand_total), 0) as revenue
      FROM user_sessions s
      LEFT JOIN events_core e
        ON e.session_id = s.session_id AND e.event_type = 'payment_success'
      LEFT JOIN orders o ON o.id = e.order_id
      WHERE s.start_time >= NOW() - INTERVAL '${numDays} days'
      GROUP BY COALESCE(s.utm_source, 'direct'), COALESCE(s.utm_medium, 'none'), s.utm_campaign
      ORDER BY revenue DESC;
    `)

    const data = result.rows.map((row) => {
      const sessionCount = parseInt(row.session_count) || 0
      const orderCount = parseInt(row.order_count) || 0
      return {
        utmSource: row.utm_source,
        utmMedium: row.utm_medium,
        utmCampaign: row.utm_campaign,
        sessionCount,
        orderCount,
        revenue: parseFloat(row.revenue) || 0,
        conversionRate: sessionCount > 0 ? (orderCount / sessionCount) * 100 : 0,
      }
    })

    res.json({
      period: `${numDays}_days`,
      data,
      summary: {
        totalRevenue: data.reduce((sum, d) => sum + d.revenue, 0),
        totalOrders: data.reduce((sum, d) => sum + d.orderCount, 0),
      },
    })
  } catch (error) {
    logger.error('Error fetching channel breakdown:', error)
    res.status(500).json({ error: 'Failed to fetch channel breakdown' })
  }
}
