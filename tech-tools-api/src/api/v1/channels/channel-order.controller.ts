/**
 * Imported TikTok Shop orders -- read-only list/detail, a manual "import
 * now" trigger (and an explicit backfill mode) for the same reconciliation
 * logic the background worker runs automatically, and the order-import
 * reconciliation queue (Production Review Round 1 §5/§33). No fulfilment/
 * status-write actions live here this phase -- see
 * channel-order-import.worker.ts's header comment for why import stays
 * polling-based rather than webhook-driven.
 *
 * Market-scope IDOR guard (Production Review Round 1 §38): channel_orders
 * has no country column of its own -- it's scoped by its parent channel
 * account's market_country (see middleware/staff.ts's
 * RESOURCE_COUNTRY_EXPRESSIONS['channel_orders']). Every query here joins
 * commerce_channel_accounts (aliased `ca`) so applyMarketScope()/
 * isCountryInScope() have a real country value to check against, exactly
 * like order.controller.ts's existing orders/shipping_address pattern.
 */
import { Response } from 'express'
import { query } from '../../../database/connection'
import logger from '../../../utils/logger'
import { StaffAuthRequest, applyMarketScope, isCountryInScope } from '../../../middleware/staff'
import { recordStaffAuditEvent } from '../../../services/staff-audit.service'
import { importOrders } from '../../../services/channels/channel-sync.service'

async function loadChannelAccountCountry(channelAccountId: string): Promise<string | null> {
  const result = await query(`SELECT market_country FROM commerce_channel_accounts WHERE id = $1`, [channelAccountId])
  return result.rows[0]?.market_country ?? null
}

export const listChannelOrders = async (req: StaffAuthRequest, res: Response): Promise<void> => {
  try {
    const { channelAccountId, needsMapping } = req.query
    const conditions: string[] = []
    const values: unknown[] = []
    if (typeof channelAccountId === 'string') {
      conditions.push(`co.channel_account_id = $${values.length + 1}`)
      values.push(channelAccountId)
    }
    if (needsMapping === 'true') {
      conditions.push(`EXISTS (SELECT 1 FROM channel_order_items coi WHERE coi.channel_order_id = co.id AND coi.channel_product_mapping_id IS NULL)`)
    }

    const scope = applyMarketScope(req, 'channel_orders', values.length + 1)
    values.push(...scope.params)

    const whereClause = `WHERE 1=1 ${conditions.length > 0 ? `AND ${conditions.join(' AND ')}` : ''} ${scope.clause}`

    const result = await query(
      `SELECT co.id, co.channel_account_id, co.channel_order_id, co.channel_order_status, co.buyer_display_name,
              co.buyer_country, co.currency, co.gross_amount, co.shipping_fee_amount, co.tax_amount,
              co.imported_at, co.last_synced_at, co.external_updated_at,
              EXISTS (SELECT 1 FROM channel_order_items coi WHERE coi.channel_order_id = co.id AND coi.channel_product_mapping_id IS NULL) AS needs_mapping
       FROM channel_orders co
       JOIN commerce_channel_accounts ca ON ca.id = co.channel_account_id
       ${whereClause}
       ORDER BY co.imported_at DESC
       LIMIT 200`,
      values,
    )
    res.json({ success: true, orders: result.rows })
  } catch (error) {
    logger.error('Error listing channel orders:', error)
    res.status(500).json({ success: false, error: 'Failed to list channel orders' })
  }
}

export const getChannelOrder = async (req: StaffAuthRequest, res: Response): Promise<void> => {
  try {
    const { orderId } = req.params
    const orderResult = await query(
      `SELECT co.*, ca.market_country
       FROM channel_orders co
       JOIN commerce_channel_accounts ca ON ca.id = co.channel_account_id
       WHERE co.id = $1`,
      [orderId],
    )
    const order = orderResult.rows[0]
    if (!order) {
      res.status(404).json({ success: false, error: 'Channel order not found' })
      return
    }

    // IDOR guard -- a market-scoped staff member must not fetch an order
    // belonging to another market's channel account just by knowing its
    // ID. Same 404 (not 403) as "not found," matching this codebase's
    // existing convention (order.controller.ts's getAdminOrderById).
    if (!isCountryInScope(req, order.market_country)) {
      recordStaffAuditEvent({
        action: 'PERMISSION_DENIED',
        actorUserId: req.user?.userId,
        metadata: { check: 'market_scope', resourceType: 'channel_order', resourceId: orderId, requestedCountry: order.market_country || null },
      })
      res.status(404).json({ success: false, error: 'Channel order not found' })
      return
    }
    delete order.market_country

    const itemsResult = await query(
      `SELECT coi.id, coi.channel_product_mapping_id, coi.channel_sku, coi.quantity, coi.unit_price, coi.line_total,
              p.name AS product_name
       FROM channel_order_items coi
       LEFT JOIN channel_product_mappings cpm ON cpm.id = coi.channel_product_mapping_id
       LEFT JOIN products p ON p.id = cpm.product_id
       WHERE coi.channel_order_id = $1`,
      [orderId],
    )
    res.json({ success: true, order, items: itemsResult.rows })
  } catch (error) {
    logger.error('Error fetching channel order:', error)
    res.status(500).json({ success: false, error: 'Failed to fetch channel order' })
  }
}

async function assertAccountInScope(req: StaffAuthRequest, channelAccountId: string): Promise<boolean> {
  const country = await loadChannelAccountCountry(channelAccountId)
  if (!country) return false // account doesn't exist -- caller 404s
  return isCountryInScope(req, country)
}

export const runOrderImport = async (req: StaffAuthRequest, res: Response): Promise<void> => {
  try {
    const { channelAccountId, fromDate } = req.body
    if (typeof channelAccountId !== 'string' || !channelAccountId) {
      res.status(400).json({ success: false, error: '"channelAccountId" is required' })
      return
    }
    if (!(await assertAccountInScope(req, channelAccountId))) {
      res.status(404).json({ success: false, error: 'Channel account not found' })
      return
    }

    let parsedFromDate: Date | undefined
    if (fromDate !== undefined) {
      // Backfill mode (Production Review Round 1 §25) -- an explicit,
      // deliberate historical import, never triggered implicitly. Rejects
      // an unparseable date rather than silently falling back to the
      // regular checkpoint-based window.
      const candidate = new Date(fromDate)
      if (Number.isNaN(candidate.getTime())) {
        res.status(400).json({ success: false, error: '"fromDate" is not a valid date' })
        return
      }
      parsedFromDate = candidate
    }

    const summary = await importOrders(channelAccountId, req.user?.userId ?? null, parsedFromDate ? { fromDate: parsedFromDate } : {})
    res.status(201).json({ success: true, data: summary })
  } catch (error: any) {
    logger.error('Error running order import:', error)
    res.status(400).json({ success: false, error: error?.message || 'Failed to import orders' })
  }
}

export const listOrderImportIssues = async (req: StaffAuthRequest, res: Response): Promise<void> => {
  try {
    const { channelAccountId, includeResolved } = req.query
    const conditions: string[] = []
    const values: unknown[] = []
    if (typeof channelAccountId === 'string') {
      conditions.push(`coii.channel_account_id = $${values.length + 1}`)
      values.push(channelAccountId)
    }
    if (includeResolved !== 'true') {
      conditions.push(`coii.resolved_at IS NULL`)
    }

    const scope = applyMarketScope(req, 'channel_orders', values.length + 1)
    values.push(...scope.params)
    // applyMarketScope() emits `ca.market_country` -- reuse the same join
    // alias here even though this query's base table is
    // channel_order_import_issues, not channel_orders.
    const whereClause = `WHERE 1=1 ${conditions.length > 0 ? `AND ${conditions.join(' AND ')}` : ''} ${scope.clause}`

    const result = await query(
      `SELECT coii.id, coii.channel_account_id, coii.external_order_id, coii.external_updated_at, coii.reason_code,
              coii.reason_detail, coii.discovered_at, coii.resolved_at, coii.resolution_note
       FROM channel_order_import_issues coii
       JOIN commerce_channel_accounts ca ON ca.id = coii.channel_account_id
       ${whereClause}
       ORDER BY coii.discovered_at DESC
       LIMIT 200`,
      values,
    )
    res.json({ success: true, issues: result.rows })
  } catch (error) {
    logger.error('Error listing channel order import issues:', error)
    res.status(500).json({ success: false, error: 'Failed to list order import issues' })
  }
}

export const resolveOrderImportIssue = async (req: StaffAuthRequest, res: Response): Promise<void> => {
  try {
    const { issueId } = req.params
    const { note } = req.body

    const issueResult = await query(
      `SELECT coii.id, coii.resolved_at, ca.market_country
       FROM channel_order_import_issues coii
       JOIN commerce_channel_accounts ca ON ca.id = coii.channel_account_id
       WHERE coii.id = $1`,
      [issueId],
    )
    const issue = issueResult.rows[0]
    if (!issue) {
      res.status(404).json({ success: false, error: 'Import issue not found' })
      return
    }
    if (!isCountryInScope(req, issue.market_country)) {
      res.status(404).json({ success: false, error: 'Import issue not found' })
      return
    }
    if (issue.resolved_at) {
      res.status(400).json({ success: false, error: 'This issue is already resolved.' })
      return
    }

    // Marking resolved here is a human bookkeeping action only -- it does
    // NOT retroactively create the channel_orders row. The underlying
    // problem (e.g. TikTok never supplying a valid amount) still needs a
    // real fix before the next import run will succeed for this order;
    // this just tells the team "we've seen this and dealt with it,"
    // e.g. after manually reconciling the order outside TechTools.
    await query(
      `UPDATE channel_order_import_issues SET resolved_at = now(), resolved_by = $2, resolution_note = $3 WHERE id = $1`,
      [issueId, req.user?.userId ?? null, typeof note === 'string' ? note : null],
    )
    res.json({ success: true })
  } catch (error) {
    logger.error('Error resolving channel order import issue:', error)
    res.status(500).json({ success: false, error: 'Failed to resolve import issue' })
  }
}
