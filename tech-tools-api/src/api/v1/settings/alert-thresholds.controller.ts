/**
 * ALERT THRESHOLDS CONFIGURATION SERVICE
 * Manages anomaly detection threshold settings for admins
 */

import { query } from '../database/connection'
import { Response } from 'express'
import logger from '../utils/logger'
import { AuthRequest } from '../middleware/auth'

interface AlertThreshold {
  id: string
  thresholdType: string
  thresholdValue: number
  baselineValue?: number
  unit: string
  severity: 'critical' | 'high' | 'medium' | 'low'
  isActive: boolean
  description: string
  createdAt: Date
  updatedAt: Date
}

/**
 * Get all alert thresholds
 */
export const getAlertThresholds = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const queryText = `
      SELECT
        id, threshold_type, threshold_value, baseline_value,
        unit, severity, is_active, description,
        created_at, updated_at
      FROM alert_thresholds
      ORDER BY severity DESC, threshold_type ASC;
    `

    const result = await query(queryText)

    res.json({
      thresholds: result.rows.map((row) => ({
        id: row.id,
        thresholdType: row.threshold_type,
        thresholdValue: parseFloat(row.threshold_value),
        baselineValue: row.baseline_value ? parseFloat(row.baseline_value) : null,
        unit: row.unit,
        severity: row.severity,
        isActive: row.is_active,
        description: row.description,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      })),
      total: result.rowCount,
    })
  } catch (error) {
    logger.error('Error fetching alert thresholds:', error)
    res.status(500).json({ error: 'Failed to fetch alert thresholds' })
  }
}

/**
 * Get single alert threshold
 */
export const getAlertThreshold = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params

    const queryText = `
      SELECT
        id, threshold_type, threshold_value, baseline_value,
        unit, severity, is_active, description,
        created_at, updated_at
      FROM alert_thresholds
      WHERE id = $1;
    `

    const result = await query(queryText, [id])

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Alert threshold not found' })
      return
    }

    const row = result.rows[0]

    res.json({
      id: row.id,
      thresholdType: row.threshold_type,
      thresholdValue: parseFloat(row.threshold_value),
      baselineValue: row.baseline_value ? parseFloat(row.baseline_value) : null,
      unit: row.unit,
      severity: row.severity,
      isActive: row.is_active,
      description: row.description,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    })
  } catch (error) {
    logger.error('Error fetching alert threshold:', error)
    res.status(500).json({ error: 'Failed to fetch alert threshold' })
  }
}

/**
 * Update alert threshold
 */
export const updateAlertThreshold = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params
    const { thresholdValue, severity, isActive, description } = req.body

    // Validation
    if (thresholdValue === undefined || severity === undefined) {
      res.status(400).json({ error: 'Missing required fields' })
      return
    }

    const queryText = `
      UPDATE alert_thresholds
      SET
        threshold_value = $2,
        severity = $3,
        is_active = $4,
        description = $5,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING
        id, threshold_type, threshold_value, baseline_value,
        unit, severity, is_active, description,
        created_at, updated_at;
    `

    const result = await query(queryText, [
      id,
      thresholdValue,
      severity,
      isActive ?? true,
      description || '',
    ])

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Alert threshold not found' })
      return
    }

    const row = result.rows[0]

    logger.info(`Alert threshold updated: ${id}`)

    res.json({
      id: row.id,
      thresholdType: row.threshold_type,
      thresholdValue: parseFloat(row.threshold_value),
      baselineValue: row.baseline_value ? parseFloat(row.baseline_value) : null,
      unit: row.unit,
      severity: row.severity,
      isActive: row.is_active,
      description: row.description,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    })
  } catch (error) {
    logger.error('Error updating alert threshold:', error)
    res.status(500).json({ error: 'Failed to update alert threshold' })
  }
}

/**
 * Reset threshold to default
 */
export const resetAlertThreshold = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params

    // Default thresholds (can be parameterized)
    const defaultThresholds: Record<string, { value: number; severity: string }> = {
      revenue_drop: { value: 20, severity: 'high' },
      refund_rate: { value: 5, severity: 'high' },
      return_rate: { value: 3, severity: 'medium' },
      checkout_abandonment: { value: 40, severity: 'medium' },
      search_zero_results: { value: 10, severity: 'medium' },
      supplier_late_rate: { value: 10, severity: 'high' },
    }

    const queryText = `
      SELECT threshold_type FROM alert_thresholds WHERE id = $1;
    `

    const typeResult = await query(queryText, [id])

    if (typeResult.rows.length === 0) {
      res.status(404).json({ error: 'Alert threshold not found' })
      return
    }

    const thresholdType = typeResult.rows[0].threshold_type
    const defaults = defaultThresholds[thresholdType]

    if (!defaults) {
      res.status(400).json({ error: 'No default values for this threshold type' })
      return
    }

    const updateText = `
      UPDATE alert_thresholds
      SET
        threshold_value = $2,
        severity = $3,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING
        id, threshold_type, threshold_value, baseline_value,
        unit, severity, is_active, description,
        created_at, updated_at;
    `

    const result = await query(updateText, [id, defaults.value, defaults.severity])

    const row = result.rows[0]

    logger.info(`Alert threshold reset to defaults: ${id}`)

    res.json({
      id: row.id,
      thresholdType: row.threshold_type,
      thresholdValue: parseFloat(row.threshold_value),
      baselineValue: row.baseline_value ? parseFloat(row.baseline_value) : null,
      unit: row.unit,
      severity: row.severity,
      isActive: row.is_active,
      description: row.description,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    })
  } catch (error) {
    logger.error('Error resetting alert threshold:', error)
    res.status(500).json({ error: 'Failed to reset alert threshold' })
  }
}
