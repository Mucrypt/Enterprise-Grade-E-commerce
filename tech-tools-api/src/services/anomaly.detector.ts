/**
 * ANOMALY DETECTION SERVICE
 * Detects operational anomalies based on thresholds and patterns
 * Rules: revenue drop, high refund rate, high return rate, checkout abandonment, etc.
 */

import { query } from '../database/connection';
import { webSocketService } from './websocket.service';
import { notificationDispatcher } from './notification-dispatcher.service';
import logger from '../utils/logger';

export interface AnomalyThresholds {
  revenueDropPercentage: number; // e.g., 20% drop from 7-day average
  refundRatePercentage: number; // e.g., 5%
  returnRatePercentage: number; // e.g., 3%
  checkoutAbandonmentPercentage: number; // e.g., 40%
  searchZeroResultPercentage: number; // e.g., 10%
  supplierLateRatePercentage: number; // e.g., 10%
  productMarginErosion: number; // e.g., 2%
}

export const DEFAULT_THRESHOLDS: AnomalyThresholds = {
  revenueDropPercentage: 20,
  refundRatePercentage: 5,
  returnRatePercentage: 3,
  checkoutAbandonmentPercentage: 40,
  searchZeroResultPercentage: 10,
  supplierLateRatePercentage: 10,
  productMarginErosion: 2,
};

export class AnomalyDetector {
  private thresholds: AnomalyThresholds;

  constructor(thresholds: Partial<AnomalyThresholds> = {}) {
    this.thresholds = { ...DEFAULT_THRESHOLDS, ...thresholds };
  }

  /**
   * Run all anomaly detection checks
   * Called periodically (e.g., every 15 minutes)
   */
  async detectAnomalies(): Promise<void> {
    try {
      logger.info('Starting anomaly detection checks...');

      await Promise.all([
        this.checkRevenueDropAnomaly(),
        this.checkRefundRateAnomaly(),
        this.checkReturnRateAnomaly(),
        this.checkCheckoutAbandonmentAnomaly(),
        this.checkSearchZeroResultsAnomaly(),
        this.checkSupplierLateRateAnomaly(),
      ]);

      logger.info('Anomaly detection checks completed');
    } catch (error) {
      logger.error('Error during anomaly detection:', error);
    }
  }

  /**
   * Check for revenue drop anomaly
   */
  private async checkRevenueDropAnomaly(): Promise<void> {
    try {
      const queryText = `
        WITH revenue_trend AS (
          SELECT
            DATE(o.created_at) as date,
            SUM(o.total_amount) as daily_revenue
          FROM orders o
          WHERE o.created_at >= NOW() - INTERVAL '8 days'
          AND o.status IN ('completed', 'shipped', 'delivered')
          GROUP BY DATE(o.created_at)
        ),
        baseline AS (
          SELECT AVG(daily_revenue) as avg_revenue FROM revenue_trend
          WHERE date < NOW()::DATE - INTERVAL '1 day'
        ),
        today AS (
          SELECT daily_revenue FROM revenue_trend WHERE date = NOW()::DATE
        )
        SELECT
          COALESCE(b.avg_revenue, 0) as baseline_revenue,
          COALESCE(t.daily_revenue, 0) as today_revenue,
          CASE WHEN b.avg_revenue > 0
            THEN ROUND(((b.avg_revenue - COALESCE(t.daily_revenue, 0)) / b.avg_revenue * 100)::NUMERIC, 2)
            ELSE 0
          END as drop_percentage
        FROM baseline b, today t;
      `;

      const result = await query(queryText);
      const row = result.rows[0];

      if (row && row.drop_percentage >= this.thresholds.revenueDropPercentage) {
        await this.createAlert({
          alertType: 'revenue_drop',
          severity: row.drop_percentage > 40 ? 'critical' : 'high',
          title: `Revenue Drop Alert: ${row.drop_percentage}% below baseline`,
          message: `Today's revenue ($${row.today_revenue}) is ${row.drop_percentage}% below the 7-day average ($${row.baseline_revenue})`,
          currentValue: row.today_revenue,
          thresholdValue: row.baseline_revenue * (1 - this.thresholds.revenueDropPercentage / 100),
          baselineValue: row.baseline_revenue,
          resourceType: 'revenue',
        });
      }
    } catch (error) {
      logger.warn('Error checking revenue drop anomaly:', error);
    }
  }

  /**
   * Check for high refund rate anomaly
   */
  private async checkRefundRateAnomaly(): Promise<void> {
    try {
      const queryText = `
        WITH metrics AS (
          SELECT
            COUNT(*) as total_orders,
            COUNT(CASE WHEN r.id IS NOT NULL THEN 1 END) as total_refunds,
            ROUND(
              (COUNT(CASE WHEN r.id IS NOT NULL THEN 1 END)::NUMERIC / COUNT(*)) * 100,
              2
            ) as refund_rate
          FROM orders o
          LEFT JOIN refunds r ON o.id = r.order_id AND r.status = 'completed'
          WHERE o.created_at >= NOW() - INTERVAL '24 hours'
          AND o.status IN ('completed', 'shipped', 'delivered')
        )
        SELECT * FROM metrics;
      `;

      const result = await query(queryText);
      const row = result.rows[0];

      if (row && row.refund_rate >= this.thresholds.refundRatePercentage) {
        await this.createAlert({
          alertType: 'high_refund_rate',
          severity: row.refund_rate > 10 ? 'critical' : 'high',
          title: `High Refund Rate Alert: ${row.refund_rate}%`,
          message: `Refund rate in last 24 hours is ${row.refund_rate}% (${row.total_refunds}/${row.total_orders} orders). Threshold: ${this.thresholds.refundRatePercentage}%`,
          currentValue: row.refund_rate,
          thresholdValue: this.thresholds.refundRatePercentage,
          resourceType: 'refund',
        });
      }
    } catch (error) {
      logger.warn('Error checking refund rate anomaly:', error);
    }
  }

  /**
   * Check for high return rate anomaly
   */
  private async checkReturnRateAnomaly(): Promise<void> {
    try {
      const queryText = `
        WITH metrics AS (
          SELECT
            COUNT(DISTINCT o.id) as total_shipped,
            COUNT(DISTINCT rt.id) as total_returns,
            ROUND(
              (COUNT(DISTINCT rt.id)::NUMERIC / COUNT(DISTINCT o.id)) * 100,
              2
            ) as return_rate
          FROM orders o
          LEFT JOIN returns rt ON o.id = rt.order_id
          WHERE o.created_at >= NOW() - INTERVAL '7 days'
          AND o.status IN ('shipped', 'delivered')
        )
        SELECT * FROM metrics;
      `;

      const result = await query(queryText);
      const row = result.rows[0];

      if (row && row.return_rate >= this.thresholds.returnRatePercentage) {
        await this.createAlert({
          alertType: 'high_return_rate',
          severity: row.return_rate > 7 ? 'critical' : 'high',
          title: `High Return Rate Alert: ${row.return_rate}%`,
          message: `Return rate in last 7 days is ${row.return_rate}% (${row.total_returns}/${row.total_shipped} orders). Threshold: ${this.thresholds.returnRatePercentage}%`,
          currentValue: row.return_rate,
          thresholdValue: this.thresholds.returnRatePercentage,
          resourceType: 'return',
        });
      }
    } catch (error) {
      logger.warn('Error checking return rate anomaly:', error);
    }
  }

  /**
   * Check for high checkout abandonment anomaly
   */
  private async checkCheckoutAbandonmentAnomaly(): Promise<void> {
    try {
      const queryText = `
        WITH metrics AS (
          SELECT
            COUNT(CASE WHEN event_type = 'checkout_start' THEN 1 END) as checkout_starts,
            COUNT(CASE WHEN event_type = 'payment_success' THEN 1 END) as payment_success,
            CASE WHEN COUNT(CASE WHEN event_type = 'checkout_start' THEN 1 END) > 0
              THEN ROUND(
                ((COUNT(CASE WHEN event_type = 'checkout_start' THEN 1 END) - 
                  COUNT(CASE WHEN event_type = 'payment_success' THEN 1 END))::NUMERIC / 
                  COUNT(CASE WHEN event_type = 'checkout_start' THEN 1 END)) * 100,
                2
              )
              ELSE 0
            END as abandonment_rate
          FROM events_core
          WHERE event_time >= NOW() - INTERVAL '24 hours'
        )
        SELECT * FROM metrics;
      `;

      const result = await query(queryText);
      const row = result.rows[0];

      if (row && row.abandonment_rate >= this.thresholds.checkoutAbandonmentPercentage) {
        await this.createAlert({
          alertType: 'checkout_abandonment',
          severity: row.abandonment_rate > 60 ? 'critical' : 'high',
          title: `High Checkout Abandonment Alert: ${row.abandonment_rate}%`,
          message: `Checkout abandonment rate in last 24 hours is ${row.abandonment_rate}% (${row.checkout_starts - row.payment_success}/${row.checkout_starts}). Threshold: ${this.thresholds.checkoutAbandonmentPercentage}%`,
          currentValue: row.abandonment_rate,
          thresholdValue: this.thresholds.checkoutAbandonmentPercentage,
          resourceType: 'checkout',
        });
      }
    } catch (error) {
      logger.warn('Error checking checkout abandonment anomaly:', error);
    }
  }

  /**
   * Check for high search zero-results rate
   */
  private async checkSearchZeroResultsAnomaly(): Promise<void> {
    try {
      const queryText = `
        WITH metrics AS (
          SELECT
            COUNT(*) as total_searches,
            COUNT(CASE WHEN payload->>'resultsCount' = '0' THEN 1 END) as zero_results,
            ROUND(
              (COUNT(CASE WHEN payload->>'resultsCount' = '0' THEN 1 END)::NUMERIC / COUNT(*)) * 100,
              2
            ) as zero_result_rate
          FROM events_core
          WHERE event_type = 'search'
          AND event_time >= NOW() - INTERVAL '24 hours'
        )
        SELECT * FROM metrics WHERE total_searches > 0;
      `;

      const result = await query(queryText);
      const row = result.rows[0];

      if (row && row.zero_result_rate >= this.thresholds.searchZeroResultPercentage) {
        await this.createAlert({
          alertType: 'search_zero_results',
          severity: 'medium',
          title: `Search Quality Alert: ${row.zero_result_rate}% zero-result searches`,
          message: `${row.zero_result_rate}% of searches in last 24 hours returned no results (${row.zero_results}/${row.total_searches}). Threshold: ${this.thresholds.searchZeroResultPercentage}%`,
          currentValue: row.zero_result_rate,
          thresholdValue: this.thresholds.searchZeroResultPercentage,
          resourceType: 'search',
        });
      }
    } catch (error) {
      logger.warn('Error checking search zero-results anomaly:', error);
    }
  }

  /**
   * Check for supplier late delivery rate anomaly
   */
  private async checkSupplierLateRateAnomaly(): Promise<void> {
    try {
      const queryText = `
        WITH supplier_metrics AS (
          SELECT
            s.id,
            s.company_name,
            COUNT(*) as total_orders,
            COUNT(CASE WHEN o.created_at + INTERVAL '1 day' * s.lead_time_days < o.shipped_at THEN 1 END) as late_orders,
            ROUND(
              (COUNT(CASE WHEN o.created_at + INTERVAL '1 day' * s.lead_time_days < o.shipped_at THEN 1 END)::NUMERIC / COUNT(*)) * 100,
              2
            ) as late_rate
          FROM suppliers s
          JOIN order_items oi ON s.id = oi.supplier_id
          JOIN orders o ON oi.order_id = o.id
          WHERE s.status = 'active'
          AND o.created_at >= NOW() - INTERVAL '30 days'
          GROUP BY s.id, s.company_name
        )
        SELECT * FROM supplier_metrics WHERE late_rate >= $1;
      `;

      const result = await query(queryText, [this.thresholds.supplierLateRatePercentage]);

      for (const row of result.rows) {
        await this.createAlert({
          alertType: 'supplier_late_delivery',
          severity: row.late_rate > 20 ? 'high' : 'medium',
          title: `Supplier Late Delivery Alert: ${row.company_name} - ${row.late_rate}%`,
          message: `${row.company_name} has a ${row.late_rate}% late delivery rate (${row.late_orders}/${row.total_orders} orders in last 30 days)`,
          currentValue: row.late_rate,
          thresholdValue: this.thresholds.supplierLateRatePercentage,
          resourceType: 'supplier',
          resourceId: row.id,
        });
      }
    } catch (error) {
      logger.warn('Error checking supplier late rate anomaly:', error);
    }
  }

  /**
   * Helper: Create an alert
   */
  private async createAlert(alert: {
    alertType: string;
    severity: string;
    title: string;
    message: string;
    currentValue: number;
    thresholdValue: number;
    baselineValue?: number;
    resourceType?: string;
    resourceId?: string;
  }): Promise<void> {
    try {
      // Check if similar active alert exists
      const existingQuery = `
        SELECT id FROM alerts
        WHERE alert_type = $1
        AND resource_type = $2
        AND resource_id = $3
        AND is_active = true
        AND triggered_at > NOW() - INTERVAL '1 hour'
        LIMIT 1;
      `;

      const existing = await query(existingQuery, [
        alert.alertType,
        alert.resourceType || null,
        alert.resourceId || null,
      ]);

      // Skip if recent alert exists
      if (existing.rows.length > 0) {
        return;
      }

      // Insert new alert
      const insertQuery = `
        INSERT INTO alerts (
          alert_type, severity, title, message,
          current_value, threshold_value, baseline_value,
          resource_type, resource_id, is_active, triggered_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true, CURRENT_TIMESTAMP);
      `;

      await query(insertQuery, [
        alert.alertType,
        alert.severity,
        alert.title,
        alert.message,
        alert.currentValue,
        alert.thresholdValue,
        alert.baselineValue || null,
        alert.resourceType,
        alert.resourceId || null,
      ]);

      logger.info(`Alert created: ${alert.alertType} - ${alert.title}`);

      // Dispatch notifications to all admins
      try {
        await notificationDispatcher.dispatchAlertToAllAdmins({
          alertId: `${alert.alertType}-${Date.now()}`,
          alertType: alert.alertType,
          severity: alert.severity as 'critical' | 'high' | 'medium' | 'low',
          title: alert.title,
          message: alert.message,
          currentValue: alert.currentValue,
          thresholdValue: alert.thresholdValue,
          triggeredAt: new Date(),
        });
      } catch (error) {
        logger.error('Error dispatching alert notifications:', error);
      }
    } catch (error) {
      logger.error('Error creating alert:', error);
    }
  }
}

export function createAnomalyDetector(thresholds?: Partial<AnomalyThresholds>): AnomalyDetector {
  return new AnomalyDetector(thresholds);
}
