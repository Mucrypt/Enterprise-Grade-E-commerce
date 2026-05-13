/**
 * EVENT TRACKING SERVICE
 * Centralized service for publishing and managing events
 * Used by API, webhooks, background workers, and other services
 */

import { Pool, QueryResult } from 'pg';
import { AnyEvent, EventContext, EventType, EventSource } from '../types/events';
import logger from '../utils/logger';

export class EventService {
  constructor(private db: Pool) {}

  /**
   * Publish an event to the analytics system
   * All events flow through this single entry point
   */
  async publishEvent(
    event: AnyEvent,
    context?: EventContext
  ): Promise<string> {
    try {
      const eventId = await this.insertEvent(event, context);
      logger.debug(`Event published: ${event.eventType} (${eventId})`);
      
      // Trigger async processing (aggregation, anomaly detection)
      this.processEventAsync(eventId, event).catch(err => 
        logger.error('Error processing event', { eventId, error: err })
      );
      
      return eventId;
    } catch (error) {
      logger.error('Failed to publish event', {
        eventType: event.eventType,
        error,
      });
      throw error;
    }
  }

  /**
   * Insert event into events_core table
   */
  private async insertEvent(
    event: AnyEvent,
    context?: EventContext
  ): Promise<string> {
    const query = `
      INSERT INTO events_core (
        event_type,
        user_id,
        session_id,
        source,
        device_type,
        product_id,
        sku,
        category_id,
        order_id,
        supplier_id,
        campaign_id,
        payload,
        value,
        duration_ms,
        event_time,
        created_at
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, CURRENT_TIMESTAMP
      )
      RETURNING id;
    `;

    // Extract context from event payload
    const eventPayload = event.payload || {};
    const productId = this.extractId(eventPayload, 'productId');
    const orderId = this.extractId(eventPayload, 'orderId');
    const supplierId = this.extractId(eventPayload, 'supplierId');
    const categoryId = this.extractId(eventPayload, 'categoryId');
    const sku = this.extractId(eventPayload, 'sku');

    const result = await this.db.query(query, [
      event.eventType,
      event.userId || null,
      event.sessionId || null,
      event.source,
      event.deviceType || 'unknown',
      productId,
      sku,
      categoryId,
      orderId,
      supplierId,
      null, // campaign_id - can be enhanced if event includes it
      JSON.stringify(eventPayload),
      this.extractValue(eventPayload),
      this.extractDuration(eventPayload),
      event.timestamp,
    ]);

    return result.rows[0].id;
  }

  /**
   * Create or update user session
   */
  async createOrUpdateSession(
    sessionId: string,
    userId: string | undefined,
    source: EventSource,
    context?: EventContext
  ): Promise<void> {
    try {
      const query = `
        INSERT INTO user_sessions (
          session_id, user_id, source, device_type, os_name, browser_name,
          ip_address, referrer, utm_source, utm_medium, utm_campaign,
          utm_content, utm_term, start_time, last_activity_time
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT (session_id) DO UPDATE
        SET last_activity_time = CURRENT_TIMESTAMP
        WHERE user_sessions.session_id = $1;
      `;

      const deviceType = this.parseDeviceType(context?.userAgent);
      const { browser, os } = this.parseUserAgent(context?.userAgent);

      await this.db.query(query, [
        sessionId,
        userId || null,
        source,
        deviceType,
        os.name,
        browser.name,
        context?.ipAddress || null,
        context?.referrer || null,
        context?.utmSource || null,
        context?.utmMedium || null,
        context?.utmCampaign || null,
        context?.utmContent || null,
        context?.utmTerm || null,
      ]);
    } catch (error) {
      logger.error('Failed to create/update session', { sessionId, error });
    }
  }

  /**
   * Get event aggregates for a time range
   */
  async getEventAggregates(
    eventType?: EventType,
    source?: EventSource,
    startTime?: Date,
    endTime?: Date
  ): Promise<any[]> {
    let query = 'SELECT * FROM event_aggregates_hourly WHERE 1=1';
    const params: any[] = [];
    let paramIndex = 1;

    if (eventType) {
      query += ` AND event_type = $${paramIndex++}`;
      params.push(eventType);
    }

    if (source) {
      query += ` AND source = $${paramIndex++}`;
      params.push(source);
    }

    if (startTime) {
      query += ` AND hour_timestamp >= $${paramIndex++}`;
      params.push(startTime);
    }

    if (endTime) {
      query += ` AND hour_timestamp <= $${paramIndex++}`;
      params.push(endTime);
    }

    query += ' ORDER BY hour_timestamp DESC';

    const result = await this.db.query(query, params);
    return result.rows;
  }

  /**
   * Refresh hourly aggregates (call this periodically, e.g., every 5 minutes)
   */
  async refreshHourlyAggregates(): Promise<void> {
    try {
      const query = `
        INSERT INTO event_aggregates_hourly (
          event_type, source, hour_timestamp, event_count, unique_users, unique_sessions, total_value, avg_duration_ms
        )
        SELECT
          event_type,
          source,
          DATE_TRUNC('hour', event_time) as hour_timestamp,
          COUNT(*) as event_count,
          COUNT(DISTINCT user_id) as unique_users,
          COUNT(DISTINCT session_id) as unique_sessions,
          COALESCE(SUM(value), 0) as total_value,
          ROUND(AVG(COALESCE(duration_ms, 0))) as avg_duration_ms
        FROM events_core
        WHERE event_time > NOW() - INTERVAL '2 hours'
        GROUP BY event_type, source, DATE_TRUNC('hour', event_time)
        ON CONFLICT (event_type, source, hour_timestamp)
        DO UPDATE SET
          event_count = EXCLUDED.event_count,
          unique_users = EXCLUDED.unique_users,
          unique_sessions = EXCLUDED.unique_sessions,
          total_value = EXCLUDED.total_value,
          avg_duration_ms = EXCLUDED.avg_duration_ms,
          created_at = NOW();
      `;

      await this.db.query(query);
      logger.debug('Hourly aggregates refreshed');
    } catch (error) {
      logger.error('Failed to refresh hourly aggregates', { error });
    }
  }

  /**
   * Private helper: async processing after event insertion
   */
  private async processEventAsync(eventId: string, event: AnyEvent): Promise<void> {
    // This can trigger:
    // 1. Anomaly detection rules
    // 2. Real-time dashboards updates (via WebSocket)
    // 3. Business logic rules (e.g., loyalty rewards)
    // Implementation in separate workers
  }

  /**
   * Helper: Extract ID from payload safely
   */
  private extractId(payload: Record<string, any>, key: string): string | null {
    const value = payload[key];
    return value && typeof value === 'string' ? value : null;
  }

  /**
   * Helper: Extract numeric value from payload
   */
  private extractValue(payload: Record<string, any>): number | null {
    const valueKeys = ['value', 'price', 'amount', 'orderValue', 'cartValue', 'refundAmount'];
    for (const key of valueKeys) {
      if (key in payload && typeof payload[key] === 'number') {
        return payload[key];
      }
    }
    return null;
  }

  /**
   * Helper: Extract duration from payload
   */
  private extractDuration(payload: Record<string, any>): number | null {
    const durationKeys = ['duration', 'duration_ms', 'durationMs', 'timeOnProduct', 'processingTime'];
    for (const key of durationKeys) {
      if (key in payload && typeof payload[key] === 'number') {
        return payload[key];
      }
    }
    return null;
  }

  /**
   * Helper: Parse device type from user agent
   */
  private parseDeviceType(userAgent?: string): string {
    if (!userAgent) return 'unknown';
    
    if (/mobile|android|iphone|ipod/i.test(userAgent)) return 'mobile';
    if (/tablet|ipad/i.test(userAgent)) return 'tablet';
    if (/windows|mac|linux/i.test(userAgent)) return 'desktop';
    
    return 'unknown';
  }

  /**
   * Helper: Parse browser and OS from user agent
   */
  private parseUserAgent(userAgent?: string): { browser: { name: string; version?: string }; os: { name: string; version?: string } } {
    const defaultResult = {
      browser: { name: 'Unknown' },
      os: { name: 'Unknown' },
    };

    if (!userAgent) return defaultResult;

    let browser = 'Unknown';
    let browserVersion: string | undefined;
    let os = 'Unknown';
    let osVersion: string | undefined;

    // Parse browser
    if (/edge/i.test(userAgent)) {
      browser = 'Edge';
      const match = userAgent.match(/edge\/(\d+\.\d+)/i);
      browserVersion = match?.[1];
    } else if (/chrome/i.test(userAgent)) {
      browser = 'Chrome';
      const match = userAgent.match(/chrome\/(\d+\.\d+)/i);
      browserVersion = match?.[1];
    } else if (/firefox/i.test(userAgent)) {
      browser = 'Firefox';
      const match = userAgent.match(/firefox\/(\d+\.\d+)/i);
      browserVersion = match?.[1];
    } else if (/safari/i.test(userAgent)) {
      browser = 'Safari';
      const match = userAgent.match(/version\/(\d+\.\d+)/i);
      browserVersion = match?.[1];
    }

    // Parse OS
    if (/windows/i.test(userAgent)) {
      os = 'Windows';
      const match = userAgent.match(/windows nt ([\d.]+)/i);
      osVersion = match?.[1];
    } else if (/mac/i.test(userAgent)) {
      os = 'macOS';
      const match = userAgent.match(/os x ([\d_]+)/i);
      osVersion = match?.[1]?.replace(/_/g, '.');
    } else if (/linux/i.test(userAgent)) {
      os = 'Linux';
    } else if (/iphone|ipad|ipod/i.test(userAgent)) {
      os = 'iOS';
      const match = userAgent.match(/os ([\d_]+)/i);
      osVersion = match?.[1]?.replace(/_/g, '.');
    } else if (/android/i.test(userAgent)) {
      os = 'Android';
      const match = userAgent.match(/android ([\d.]+)/i);
      osVersion = match?.[1];
    }

    return {
      browser: { name: browser, version: browserVersion },
      os: { name: os, version: osVersion },
    };
  }
}

// Export singleton instance factory
export function createEventService(db: Pool): EventService {
  return new EventService(db);
}
