/** CRUD for sourcing_pricing_rules (SOURCING-1) -- gated sourcing.manage throughout. */
import { Response } from 'express'
import { AuthRequest } from '../../../middleware/auth'
import { query } from '../../../database/connection'
import logger from '../../../utils/logger'

export const listPricingRules = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await query(
      `SELECT id, name, rule_type, margin_percent, fixed_markup, rounding_mode, is_default, created_at
       FROM sourcing_pricing_rules ORDER BY is_default DESC, created_at ASC`,
    )
    res.json({ success: true, rules: result.rows })
  } catch (error) {
    logger.error('Error listing sourcing pricing rules:', error)
    res.status(500).json({ success: false, error: 'Failed to list pricing rules' })
  }
}

export const createPricingRule = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, ruleType, marginPercent, fixedMarkup, roundingMode, isDefault } = req.body
    if (!name || !['margin_percent', 'cost_plus_fixed'].includes(ruleType)) {
      res.status(400).json({ success: false, error: '"name" and a valid "ruleType" are required' })
      return
    }

    if (isDefault) {
      await query(`UPDATE sourcing_pricing_rules SET is_default = false WHERE is_default = true`)
    }

    const result = await query(
      `INSERT INTO sourcing_pricing_rules (name, rule_type, margin_percent, fixed_markup, rounding_mode, is_default, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [name, ruleType, marginPercent ?? null, fixedMarkup ?? null, roundingMode || 'charm', !!isDefault, req.user!.userId],
    )
    res.status(201).json({ success: true, data: { id: result.rows[0].id } })
  } catch (error) {
    logger.error('Error creating sourcing pricing rule:', error)
    res.status(500).json({ success: false, error: 'Failed to create pricing rule' })
  }
}

export const updatePricingRule = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params
    const { name, marginPercent, fixedMarkup, roundingMode, isDefault } = req.body

    if (isDefault) {
      await query(`UPDATE sourcing_pricing_rules SET is_default = false WHERE is_default = true AND id != $1`, [id])
    }

    await query(
      `UPDATE sourcing_pricing_rules
       SET name = COALESCE($2, name), margin_percent = COALESCE($3, margin_percent),
           fixed_markup = COALESCE($4, fixed_markup), rounding_mode = COALESCE($5, rounding_mode),
           is_default = COALESCE($6, is_default), updated_at = now()
       WHERE id = $1`,
      [id, name ?? null, marginPercent ?? null, fixedMarkup ?? null, roundingMode ?? null, isDefault ?? null],
    )
    res.json({ success: true })
  } catch (error) {
    logger.error('Error updating sourcing pricing rule:', error)
    res.status(500).json({ success: false, error: 'Failed to update pricing rule' })
  }
}
