/**
 * Product/SKU mapping management -- list, preview a product sync, and
 * commit a previewed run. Read-only against the external channel
 * (fetchProducts()); writes only ever land in channel_product_mappings
 * and channel_sync_runs, never on TikTok Shop itself.
 */
import { Response } from 'express'
import { query } from '../../../database/connection'
import logger from '../../../utils/logger'
import { StaffAuthRequest } from '../../../middleware/staff'
import { previewProductSync, commitProductSync, runInventoryDiff } from '../../../services/channels/channel-sync.service'

export const listProductMappings = async (req: StaffAuthRequest, res: Response): Promise<void> => {
  try {
    const { channelAccountId } = req.query
    const conditions: string[] = []
    const values: unknown[] = []
    if (typeof channelAccountId === 'string') {
      conditions.push(`channel_account_id = $${values.length + 1}`)
      values.push(channelAccountId)
    }
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    const result = await query(
      `SELECT cpm.id, cpm.channel_account_id, cpm.product_id, cpm.channel_product_id, cpm.channel_sku,
              cpm.channel_variation_id, cpm.mapping_status, cpm.last_synced_at, cpm.last_diff,
              p.name AS product_name, p.sku AS product_sku
       FROM channel_product_mappings cpm
       LEFT JOIN products p ON p.id = cpm.product_id
       ${whereClause}
       ORDER BY cpm.updated_at DESC
       LIMIT 200`,
      values,
    )
    res.json({ success: true, mappings: result.rows })
  } catch (error) {
    logger.error('Error listing channel product mappings:', error)
    res.status(500).json({ success: false, error: 'Failed to list product mappings' })
  }
}

export const previewSync = async (req: StaffAuthRequest, res: Response): Promise<void> => {
  try {
    const { channelAccountId } = req.body
    if (typeof channelAccountId !== 'string' || !channelAccountId) {
      res.status(400).json({ success: false, error: '"channelAccountId" is required' })
      return
    }
    const summary = await previewProductSync(channelAccountId, req.user?.userId ?? null)
    res.status(201).json({
      success: true,
      message: 'Product sync preview generated. Review the planned changes, then commit to apply them.',
      data: summary,
    })
  } catch (error: any) {
    logger.error('Error previewing product sync:', error)
    res.status(400).json({ success: false, error: error?.message || 'Failed to preview product sync' })
  }
}

export const commitSync = async (req: StaffAuthRequest, res: Response): Promise<void> => {
  try {
    const { channelAccountId, runId } = req.body
    if (typeof channelAccountId !== 'string' || typeof runId !== 'string') {
      res.status(400).json({ success: false, error: '"channelAccountId" and "runId" are required' })
      return
    }
    const result = await commitProductSync(channelAccountId, runId, req.user!.userId)
    res.json({
      success: true,
      message: `Sync committed: ${result.createdCount} mapping(s) created, ${result.updatedCount} updated.`,
      data: result,
    })
  } catch (error: any) {
    logger.error('Error committing product sync:', error)
    res.status(400).json({ success: false, error: error?.message || 'Failed to commit product sync' })
  }
}

export const listInventoryDiffs = async (req: StaffAuthRequest, res: Response): Promise<void> => {
  try {
    const { channelAccountId } = req.query
    const conditions: string[] = ["csr.run_type = 'INVENTORY_DIFF'"]
    const values: unknown[] = []
    if (typeof channelAccountId === 'string') {
      conditions.push(`csr.channel_account_id = $${values.length + 1}`)
      values.push(channelAccountId)
    }

    const result = await query(
      `SELECT cid.id, cid.run_id, cid.channel_product_mapping_id, cid.techtools_available_stock,
              cid.channel_reported_stock, cid.delta, cid.action_taken, cid.created_at,
              cpm.channel_product_id, cpm.channel_sku, p.name AS product_name
       FROM channel_inventory_diffs cid
       JOIN channel_sync_runs csr ON csr.id = cid.run_id
       JOIN channel_product_mappings cpm ON cpm.id = cid.channel_product_mapping_id
       LEFT JOIN products p ON p.id = cpm.product_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY cid.created_at DESC
       LIMIT 200`,
      values,
    )
    res.json({ success: true, diffs: result.rows })
  } catch (error) {
    logger.error('Error listing channel inventory diffs:', error)
    res.status(500).json({ success: false, error: 'Failed to list inventory diffs' })
  }
}

export const runDiff = async (req: StaffAuthRequest, res: Response): Promise<void> => {
  try {
    const { channelAccountId } = req.body
    if (typeof channelAccountId !== 'string' || !channelAccountId) {
      res.status(400).json({ success: false, error: '"channelAccountId" is required' })
      return
    }
    const summary = await runInventoryDiff(channelAccountId, req.user?.userId ?? null)
    res.status(201).json({ success: true, data: summary })
  } catch (error: any) {
    logger.error('Error running inventory diff:', error)
    res.status(400).json({ success: false, error: error?.message || 'Failed to run inventory diff' })
  }
}
