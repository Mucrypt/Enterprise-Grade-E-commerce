/**
 * ALERTS CONTROLLER
 * Manages alert retrieval, acknowledgment, and dismissal
 */

import { Response } from 'express';
import { query } from '../../../database/connection';
import logger from '../../../utils/logger';
import { AuthRequest } from '../../../middleware/auth';
import { webSocketService } from '../../../services/websocket.service';

export const getActiveAlerts = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { severity, limit = 10, offset = 0 } = req.query;

    let queryText = `
      SELECT
        id, alert_type, severity, title, message,
        current_value, threshold_value, baseline_value,
        resource_type, resource_id,
        is_active, triggered_at, acknowledged_at, resolved_at
      FROM alerts
      WHERE is_active = true
    `;

    const params: any[] = [];

    if (severity) {
      queryText += ` AND severity = $${params.length + 1}`;
      params.push(severity);
    }

    queryText += `
      ORDER BY
        CASE severity
          WHEN 'critical' THEN 1
          WHEN 'high' THEN 2
          WHEN 'medium' THEN 3
          WHEN 'low' THEN 4
        END,
        triggered_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2};
    `;

    params.push(limit, offset);

    const result = await query(queryText, params);

    res.json({
      alerts: result.rows.map(row => ({
        id: row.id,
        alertType: row.alert_type,
        severity: row.severity,
        title: row.title,
        message: row.message,
        currentValue: parseFloat(row.current_value),
        thresholdValue: parseFloat(row.threshold_value),
        baselineValue: row.baseline_value ? parseFloat(row.baseline_value) : null,
        resourceType: row.resource_type,
        resourceId: row.resource_id,
        isActive: row.is_active,
        triggeredAt: row.triggered_at,
        acknowledgedAt: row.acknowledged_at,
        resolvedAt: row.resolved_at,
      })),
      total: result.rowCount,
    });
  } catch (error) {
    logger.error('Error fetching active alerts:', error);
    res.status(500).json({ error: 'Failed to fetch alerts' });
  }
};

export const getAlertById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const queryText = `
      SELECT
        id, alert_type, severity, title, message,
        current_value, threshold_value, baseline_value,
        resource_type, resource_id,
        is_active, triggered_at, acknowledged_at, resolved_at, acknowledged_by
      FROM alerts
      WHERE id = $1;
    `;

    const result = await query(queryText, [id]);

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Alert not found' });
      return;
    }

    const row = result.rows[0];

    res.json({
      id: row.id,
      alertType: row.alert_type,
      severity: row.severity,
      title: row.title,
      message: row.message,
      currentValue: parseFloat(row.current_value),
      thresholdValue: parseFloat(row.threshold_value),
      baselineValue: row.baseline_value ? parseFloat(row.baseline_value) : null,
      resourceType: row.resource_type,
      resourceId: row.resource_id,
      isActive: row.is_active,
      triggeredAt: row.triggered_at,
      acknowledgedAt: row.acknowledged_at,
      resolvedAt: row.resolved_at,
      acknowledgedBy: row.acknowledged_by,
    });
  } catch (error) {
    logger.error('Error fetching alert:', error);
    res.status(500).json({ error: 'Failed to fetch alert' });
  }
};

export const acknowledgeAlert = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const adminId = req.user?.id;

    if (!adminId) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const queryText = `
      UPDATE alerts
      SET acknowledged_at = CURRENT_TIMESTAMP, acknowledged_by = $2, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND is_active = true
      RETURNING
        id, alert_type, severity, title, message,
        current_value, threshold_value, baseline_value,
        resource_type, resource_id,
        is_active, triggered_at, acknowledged_at, resolved_at;
    `;

    const result = await query(queryText, [id, adminId]);

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Alert not found or already processed' });
      return;
    }

    const row = result.rows[0];

    logger.info(`Alert acknowledged: ${id} by admin ${adminId}`);
    webSocketService.broadcastAlertAcknowledged(row.id, adminId);

    res.json({
      id: row.id,
      alertType: row.alert_type,
      severity: row.severity,
      title: row.title,
      message: row.message,
      currentValue: parseFloat(row.current_value),
      thresholdValue: parseFloat(row.threshold_value),
      isActive: row.is_active,
      triggeredAt: row.triggered_at,
      acknowledgedAt: row.acknowledged_at,
      resolvedAt: row.resolved_at,
    });
  } catch (error) {
    logger.error('Error acknowledging alert:', error);
    res.status(500).json({ error: 'Failed to acknowledge alert' });
  }
};

export const dismissAlert = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const adminId = req.user?.id;

    if (!adminId) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const queryText = `
      UPDATE alerts
      SET is_active = false, resolved_at = CURRENT_TIMESTAMP, acknowledged_by = $2, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING
        id, alert_type, severity, title, message,
        current_value, threshold_value,
        resource_type, resource_id,
        is_active, triggered_at, resolved_at;
    `;

    const result = await query(queryText, [id, adminId]);

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Alert not found' });
      return;
    }

    const row = result.rows[0];

    logger.info(`Alert dismissed: ${id} by admin ${adminId}`);
    webSocketService.broadcastAlertDismissed(row.id);

    res.json({
      id: row.id,
      alertType: row.alert_type,
      severity: row.severity,
      isActive: row.is_active,
      resolvedAt: row.resolved_at,
      message: 'Alert dismissed successfully',
    });
  } catch (error) {
    logger.error('Error dismissing alert:', error);
    res.status(500).json({ error: 'Failed to dismiss alert' });
  }
};

export const getAlertStats = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const queryText = `
      SELECT
        COUNT(*) FILTER (WHERE is_active = true AND severity = 'critical') as critical_alerts,
        COUNT(*) FILTER (WHERE is_active = true AND severity = 'high') as high_alerts,
        COUNT(*) FILTER (WHERE is_active = true AND severity = 'medium') as medium_alerts,
        COUNT(*) FILTER (WHERE is_active = true AND severity = 'low') as low_alerts,
        COUNT(*) FILTER (WHERE is_active = true) as total_active,
        COUNT(*) FILTER (WHERE resolved_at >= NOW() - INTERVAL '24 hours') as resolved_last_24h
      FROM alerts;
    `;

    const result = await query(queryText);
    const row = result.rows[0];

    res.json({
      critical: parseInt(row.critical_alerts) || 0,
      high: parseInt(row.high_alerts) || 0,
      medium: parseInt(row.medium_alerts) || 0,
      low: parseInt(row.low_alerts) || 0,
      totalActive: parseInt(row.total_active) || 0,
      resolvedLast24h: parseInt(row.resolved_last_24h) || 0,
    });
  } catch (error) {
    logger.error('Error fetching alert stats:', error);
    res.status(500).json({ error: 'Failed to fetch alert stats' });
  }
};
