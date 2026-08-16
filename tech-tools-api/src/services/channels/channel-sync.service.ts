/**
 * Shared preview/commit sync logic -- product sync today, the same shape
 * order-import and inventory-diff (later build steps) reuse. Modeled
 * directly on suppliers/supplier-import.controller.ts's preview/commit
 * split: a preview run computes and stores planned changes without
 * touching any live table except channel_sync_runs itself; commit reads
 * that stored plan back and applies it, inside one transaction.
 */
import { query, getClient } from '../../database/connection'
import logger from '../../utils/logger'
import { getChannelAdapter } from './registry'
import { channelTokenCipher } from '../../utils/secret-encryption'
import { ChannelConnectionCreds, ChannelOrder, ChannelProductSku, ChannelType } from './channel-account.types'

interface PlannedMappingChange {
  channelProductId: string
  channelSku: string
  productTitle: string
  channelPrice: number | null
  channelCurrency: string | null
  channelStock: number | null
  /** The TechTools product this SKU will be linked to, if a real SKU match was found -- never guessed beyond an exact sellerSku === products.sku match. */
  matchedProductId: string | null
  mappingStatus: 'MAPPED' | 'CHANNEL_ONLY'
  /** Only set for a SKU that already has a mapping row -- the price/stock/title delta since the last sync, surfaced to the ops UI. */
  diff: Record<string, { previous: unknown; current: unknown }> | null
  existingMappingId: string | null
}

async function loadDecryptedCreds(channelAccountId: string): Promise<{ creds: ChannelConnectionCreds; channelType: ChannelType } | null> {
  const result = await query(
    `SELECT id, channel_type, access_token_encrypted, external_shop_id, shop_cipher, status
     FROM commerce_channel_accounts WHERE id = $1 AND disabled_by_admin = false`,
    [channelAccountId],
  )
  const row = result.rows[0]
  if (!row || !row.access_token_encrypted || row.status !== 'CONNECTED') return null
  return {
    channelType: row.channel_type,
    creds: {
      channelAccountId: row.id,
      accessToken: channelTokenCipher.decryptSecret(row.access_token_encrypted),
      externalShopId: row.external_shop_id,
      shopCipher: row.shop_cipher,
    },
  }
}

/**
 * READ + DIFF only -- fetches real products from the channel, compares
 * against existing channel_product_mappings and real TechTools products
 * (by exact SKU match, never fuzzy), and stores the plan in a new
 * channel_sync_runs row with status='preview'. Writes nothing to
 * channel_product_mappings itself -- see commitProductSync().
 */
export async function previewProductSync(
  channelAccountId: string,
  triggeredBy: string | null,
): Promise<{ runId: string; totalItems: number; toCreate: number; toUpdate: number; unmapped: number }> {
  const loaded = await loadDecryptedCreds(channelAccountId)
  if (!loaded) {
    throw new Error('Channel account is not connected -- cannot preview a product sync.')
  }

  const adapter = getChannelAdapter(loaded.channelType)
  const fetchedSkus: ChannelProductSku[] = await adapter.fetchProducts(loaded.creds)

  const existingMappingsResult = await query(
    `SELECT id, channel_product_id, channel_sku, product_id, mapping_status, last_diff
     FROM channel_product_mappings WHERE channel_account_id = $1`,
    [channelAccountId],
  )
  const existingByKey = new Map<string, any>(
    existingMappingsResult.rows.map((row: any) => [`${row.channel_product_id}::${row.channel_sku}`, row]),
  )

  const sellerSkus = fetchedSkus.map((s) => s.sellerSku).filter(Boolean)
  const matchedProductsResult =
    sellerSkus.length > 0 ? await query(`SELECT id, sku FROM products WHERE sku = ANY($1::text[])`, [sellerSkus]) : { rows: [] }
  const productIdBySku = new Map<string, string>(matchedProductsResult.rows.map((row: any) => [row.sku, row.id]))

  const plan: PlannedMappingChange[] = []
  let toCreate = 0
  let toUpdate = 0
  let unmapped = 0

  for (const sku of fetchedSkus) {
    const key = `${sku.channelProductId}::${sku.sellerSku}`
    const existing = existingByKey.get(key)
    const matchedProductId = existing?.product_id ?? productIdBySku.get(sku.sellerSku) ?? null
    const mappingStatus: 'MAPPED' | 'CHANNEL_ONLY' = matchedProductId ? 'MAPPED' : 'CHANNEL_ONLY'

    let diff: PlannedMappingChange['diff'] = null
    if (existing) {
      const previousDiff = existing.last_diff || {}
      const changed: Record<string, { previous: unknown; current: unknown }> = {}
      if (previousDiff.price?.current !== sku.price) changed.price = { previous: previousDiff.price?.current ?? null, current: sku.price }
      if (previousDiff.stock?.current !== sku.stock) changed.stock = { previous: previousDiff.stock?.current ?? null, current: sku.stock }
      if (previousDiff.title?.current !== sku.productTitle) changed.title = { previous: previousDiff.title?.current ?? null, current: sku.productTitle }
      diff = Object.keys(changed).length > 0 ? changed : null
      toUpdate += 1
    } else {
      toCreate += 1
    }
    if (mappingStatus === 'CHANNEL_ONLY') unmapped += 1

    plan.push({
      channelProductId: sku.channelProductId,
      channelSku: sku.sellerSku,
      productTitle: sku.productTitle,
      channelPrice: sku.price,
      channelCurrency: sku.currency,
      channelStock: sku.stock,
      matchedProductId,
      mappingStatus,
      diff,
      existingMappingId: existing?.id ?? null,
    })
  }

  const runResult = await query(
    `INSERT INTO channel_sync_runs
       (channel_account_id, run_type, status, total_items, created_count, updated_count, unmapped_count, parsed_items, triggered_by)
     VALUES ($1, 'PRODUCT_SYNC', 'preview', $2, $3, $4, $5, $6::jsonb, $7)
     RETURNING id`,
    [channelAccountId, plan.length, toCreate, toUpdate, unmapped, JSON.stringify(plan), triggeredBy],
  )

  return { runId: runResult.rows[0].id, totalItems: plan.length, toCreate, toUpdate, unmapped }
}

/**
 * Applies a previously-computed preview plan -- upserts
 * channel_product_mappings rows inside one transaction, then marks the
 * run committed. Idempotent: re-committing an already-committed run is
 * rejected outright (see the status check below), never silently re-applied.
 */
export async function commitProductSync(
  channelAccountId: string,
  runId: string,
  actorUserId: string,
): Promise<{ createdCount: number; updatedCount: number }> {
  const runResult = await query(
    `SELECT id, status, parsed_items FROM channel_sync_runs WHERE id = $1 AND channel_account_id = $2 AND run_type = 'PRODUCT_SYNC'`,
    [runId, channelAccountId],
  )
  const run = runResult.rows[0]
  if (!run) {
    throw new Error('Sync run not found for this channel account.')
  }
  if (run.status !== 'preview') {
    throw new Error(`This sync run is already "${run.status}" and cannot be committed again.`)
  }

  const plan: PlannedMappingChange[] = run.parsed_items || []
  const client = await getClient()
  let createdCount = 0
  let updatedCount = 0

  try {
    await client.query('BEGIN')

    for (const item of plan) {
      const result = await client.query(
        `INSERT INTO channel_product_mappings
           (channel_account_id, product_id, channel_product_id, channel_sku, mapping_status, last_synced_at, last_diff)
         VALUES ($1, $2, $3, $4, $5, now(), $6::jsonb)
         ON CONFLICT (channel_account_id, channel_product_id, channel_sku) DO UPDATE SET
           product_id = EXCLUDED.product_id,
           mapping_status = EXCLUDED.mapping_status,
           last_synced_at = now(),
           last_diff = EXCLUDED.last_diff,
           updated_at = now()
         RETURNING (xmax = 0) AS inserted`,
        [
          channelAccountId,
          item.matchedProductId,
          item.channelProductId,
          item.channelSku,
          item.mappingStatus,
          JSON.stringify({
            price: { current: item.channelPrice },
            stock: { current: item.channelStock },
            title: { current: item.productTitle },
          }),
        ],
      )
      if (result.rows[0]?.inserted) {
        createdCount += 1
      } else {
        updatedCount += 1
      }
    }

    await client.query(
      `UPDATE channel_sync_runs SET status = 'committed', created_count = $2, updated_count = $3, committed_at = now() WHERE id = $1`,
      [runId, createdCount, updatedCount],
    )
    await client.query(
      `INSERT INTO channel_activity_log (channel_account_id, sync_run_id, actor_user_id, action, metadata)
       VALUES ($1, $2, $3, 'PRODUCT_SYNC_COMMITTED', $4)`,
      [channelAccountId, runId, actorUserId, JSON.stringify({ createdCount, updatedCount })],
    )

    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    logger.error('Commit product sync error:', error)
    throw error
  } finally {
    client.release()
  }

  return { createdCount, updatedCount }
}

/**
 * Read-only inventory comparison -- TechTools inventory.available_stock
 * (the only authoritative stock this codebase has ever decremented) versus
 * what the channel currently reports. Unlike product sync, there is no
 * separate "commit" step: a diff IS the terminal output (a report), not a
 * plan waiting to be applied -- so the channel_sync_runs row this creates
 * goes straight to 'committed'. This function never writes to
 * inventory.current_stock/reserved_stock, and never calls a channel write
 * endpoint -- action_taken on every row it produces is NONE or FLAGGED,
 * matching the schema's own comment that WRITTEN_TO_CHANNEL is
 * unreachable by any code this phase ships.
 */
export async function runInventoryDiff(
  channelAccountId: string,
  triggeredBy: string | null,
): Promise<{ runId: string; comparedCount: number; flaggedCount: number }> {
  const loaded = await loadDecryptedCreds(channelAccountId)
  if (!loaded) {
    throw new Error('Channel account is not connected -- cannot run an inventory diff.')
  }

  const mappingsResult = await query(
    `SELECT cpm.id, cpm.channel_product_id, cpm.channel_sku, cpm.product_id, i.available_stock
     FROM channel_product_mappings cpm
     JOIN inventory i ON i.product_id = cpm.product_id
     WHERE cpm.channel_account_id = $1 AND cpm.mapping_status = 'MAPPED' AND cpm.product_id IS NOT NULL`,
    [channelAccountId],
  )
  if (mappingsResult.rows.length === 0) {
    const emptyRun = await query(
      `INSERT INTO channel_sync_runs (channel_account_id, run_type, status, total_items, triggered_by, committed_at)
       VALUES ($1, 'INVENTORY_DIFF', 'committed', 0, $2, now()) RETURNING id`,
      [channelAccountId, triggeredBy],
    )
    return { runId: emptyRun.rows[0].id, comparedCount: 0, flaggedCount: 0 }
  }

  const adapter = getChannelAdapter(loaded.channelType)
  const fetchedSkus: ChannelProductSku[] = await adapter.fetchProducts(loaded.creds)
  const stockBySkuKey = new Map<string, number | null>(fetchedSkus.map((s) => [`${s.channelProductId}::${s.sellerSku}`, s.stock]))

  const client = await getClient()
  let flaggedCount = 0

  try {
    await client.query('BEGIN')

    const runResult = await client.query(
      `INSERT INTO channel_sync_runs (channel_account_id, run_type, status, total_items, triggered_by, started_at)
       VALUES ($1, 'INVENTORY_DIFF', 'preview', $2, $3, now()) RETURNING id`,
      [channelAccountId, mappingsResult.rows.length, triggeredBy],
    )
    const runId = runResult.rows[0].id

    for (const mapping of mappingsResult.rows) {
      const key = `${mapping.channel_product_id}::${mapping.channel_sku}`
      const channelStock = stockBySkuKey.get(key) ?? null
      const techtoolsStock: number | null = mapping.available_stock
      const delta = channelStock !== null && techtoolsStock !== null ? techtoolsStock - channelStock : null
      const flagged = delta !== null && delta !== 0
      if (flagged) flaggedCount += 1

      await client.query(
        `INSERT INTO channel_inventory_diffs
           (run_id, channel_product_mapping_id, techtools_available_stock, channel_reported_stock, delta, action_taken)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [runId, mapping.id, techtoolsStock, channelStock, delta, flagged ? 'FLAGGED' : 'NONE'],
      )
    }

    // flaggedCount has no dedicated column on this generic-across-run-types
    // table (unmapped_count/created_count/updated_count are product-sync
    // concepts, not inventory-diff ones) -- stored in error_report's
    // free-form JSONB instead of overloading a column whose name would be
    // misleading for this run_type.
    await client.query(
      `UPDATE channel_sync_runs SET status = 'committed', error_report = $2::jsonb, committed_at = now() WHERE id = $1`,
      [runId, JSON.stringify({ flaggedCount })],
    )

    await client.query('COMMIT')
    return { runId, comparedCount: mappingsResult.rows.length, flaggedCount }
  } catch (error) {
    await client.query('ROLLBACK')
    logger.error('Inventory diff run error:', error)
    throw error
  } finally {
    client.release()
  }
}

// Rolling reconciliation window -- used only when a channel account has no
// persisted watermark yet (its first-ever import). Once a run completes
// fully, order_import_watermark takes over as the checkpoint (see below).
const ORDER_IMPORT_LOOKBACK_MS = 7 * 24 * 60 * 60 * 1000

// Applied on top of the persisted watermark, not the rolling-window
// default -- absorbs clock skew and any order whose remote record briefly
// lags its own timestamp, so a checkpoint-based poll never has a hard edge
// where a late-appearing order falls just before the fetched window.
const ORDER_IMPORT_WATERMARK_OVERLAP_MS = 2 * 60 * 60 * 1000

interface ImportOrdersOptions {
  /**
   * Explicit backfill start date (Production Review Round 1 §25) --
   * bypasses the persisted watermark/rolling-window default entirely and,
   * deliberately, never advances the watermark itself. A backfill is a
   * one-off, human-requested historical import; it must never interfere
   * with the ongoing incremental checkpoint a scheduled poll relies on.
   */
  fromDate?: Date
}

interface ImportOrdersResult {
  runId: string
  totalFetched: number
  importedCount: number
  updatedCount: number
  /** A fetched order was older (by the channel's own external_updated_at) than what's already stored -- ignored, not applied, to avoid regressing a known-newer status. See §8. */
  staleIgnoredCount: number
  /** Could not be safely normalized into a channel_orders row -- recorded in channel_order_import_issues instead of silently dropped. See §5. */
  issueCount: number
  failedCount: number
  /** false if pagination failed partway -- see FetchOrdersResult. The checkpoint is never advanced when this is false. */
  complete: boolean
}

/**
 * Idempotent order-import reconciliation -- fetches real orders from the
 * channel and upserts them into channel_orders/channel_order_items via the
 * table's own (channel_account_id, channel_order_id) uniqueness, exactly
 * like commitProductSync()'s mapping upsert. Re-running with the same
 * orders updates rows in place; it never creates duplicates (§9's "a
 * TikTok order/webhook must never create duplicate TechTools orders" --
 * this is the mechanism that guarantees it, independent of anything the
 * webhook receiver does, and independent of polling/webhook races -- see
 * Production Review Round 1 §6/§7).
 *
 * Three Production Review Round 1 hardenings on top of the original
 * build: (1) a persisted per-account watermark replaces the fixed rolling
 * window once a run has fully succeeded, so a poll doesn't re-download the
 * same days forever (§24); (2) an order whose channel-reported
 * external_updated_at is older than what's already stored is ignored
 * rather than applied, so a delayed/out-of-order event can't regress a
 * newer known status (§8); (3) an order that cannot be safely normalized
 * (bad amount, missing currency, malformed payload) is recorded in
 * channel_order_import_issues instead of silently skipped -- a real order
 * must never disappear without a trace (§5).
 *
 * Deliberately does NOT populate channel_orders.techtools_order_id or
 * touch the canonical orders/inventory tables -- materializing a real
 * TechTools order per TikTok sale requires deciding checkout/reservation/
 * fulfilment semantics for a channel-originated order, which this phase
 * does not invent speculatively (see the plan's explicit deferral).
 */
export async function importOrders(
  channelAccountId: string,
  triggeredBy: string | null,
  options: ImportOrdersOptions = {},
): Promise<ImportOrdersResult> {
  const loaded = await loadDecryptedCreds(channelAccountId)
  if (!loaded) {
    throw new Error('Channel account is not connected -- cannot import orders.')
  }

  const isBackfill = !!options.fromDate
  let sinceDate: Date
  if (isBackfill) {
    sinceDate = options.fromDate!
  } else {
    const accountResult = await query(`SELECT order_import_watermark FROM commerce_channel_accounts WHERE id = $1`, [channelAccountId])
    const watermark: Date | null = accountResult.rows[0]?.order_import_watermark ?? null
    sinceDate = watermark ? new Date(watermark.getTime() - ORDER_IMPORT_WATERMARK_OVERLAP_MS) : new Date(Date.now() - ORDER_IMPORT_LOOKBACK_MS)
  }
  const fetchStartedAt = new Date()

  const adapter = getChannelAdapter(loaded.channelType)
  const fetchResult = await adapter.fetchOrders(loaded.creds, sinceDate)
  const fetchedOrders = fetchResult.orders

  const mappingsResult = await query(
    `SELECT id, channel_product_id, channel_sku FROM channel_product_mappings WHERE channel_account_id = $1`,
    [channelAccountId],
  )
  const mappingIdByKey = new Map<string, string>(
    mappingsResult.rows.map((row: any) => [`${row.channel_product_id}::${row.channel_sku}`, row.id]),
  )

  const client = await getClient()
  let importedCount = 0
  let updatedCount = 0
  let staleIgnoredCount = 0
  let issueCount = 0
  let failedCount = 0

  try {
    await client.query('BEGIN')

    const runResult = await client.query(
      `INSERT INTO channel_sync_runs (channel_account_id, run_type, status, total_items, triggered_by, started_at)
       VALUES ($1, 'ORDER_IMPORT', 'preview', $2, $3, now()) RETURNING id`,
      [channelAccountId, fetchedOrders.length, triggeredBy],
    )
    const runId = runResult.rows[0].id

    for (const order of fetchedOrders) {
      try {
        const issue = classifyUnimportableOrder(order)
        if (issue) {
          issueCount += 1
          // Partial unique index (resolved_at IS NULL) -- re-detecting the
          // same broken order on a later poll updates the one open issue
          // row in place rather than accumulating duplicates.
          await client.query(
            `INSERT INTO channel_order_import_issues
               (channel_account_id, sync_run_id, external_order_id, external_updated_at, reason_code, reason_detail)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT (channel_account_id, external_order_id) WHERE resolved_at IS NULL DO UPDATE SET
               sync_run_id = EXCLUDED.sync_run_id,
               external_updated_at = EXCLUDED.external_updated_at,
               reason_code = EXCLUDED.reason_code,
               reason_detail = EXCLUDED.reason_detail`,
            [channelAccountId, runId, order.channelOrderId || '(missing external order id)', order.externalUpdatedAt, issue.code, issue.detail],
          )
          continue
        }

        const orderResult = await client.query(
          `INSERT INTO channel_orders
             (channel_account_id, channel_order_id, channel_order_status, buyer_display_name, buyer_country,
              currency, gross_amount, shipping_fee_amount, tax_amount, external_updated_at, raw_payload, last_synced_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, now())
           ON CONFLICT (channel_account_id, channel_order_id) DO UPDATE SET
             channel_order_status = EXCLUDED.channel_order_status,
             buyer_display_name = EXCLUDED.buyer_display_name,
             buyer_country = EXCLUDED.buyer_country,
             gross_amount = EXCLUDED.gross_amount,
             shipping_fee_amount = EXCLUDED.shipping_fee_amount,
             tax_amount = EXCLUDED.tax_amount,
             external_updated_at = EXCLUDED.external_updated_at,
             raw_payload = EXCLUDED.raw_payload,
             last_synced_at = now(),
             updated_at = now()
           WHERE EXCLUDED.external_updated_at IS NULL
              OR channel_orders.external_updated_at IS NULL
              OR EXCLUDED.external_updated_at >= channel_orders.external_updated_at
           RETURNING id, (xmax = 0) AS inserted`,
          [
            channelAccountId,
            order.channelOrderId,
            order.channelOrderStatus,
            order.buyerDisplayName,
            order.buyerCountry,
            order.currency,
            order.grossAmount,
            order.shippingFeeAmount,
            order.taxAmount,
            order.externalUpdatedAt,
            JSON.stringify(order.rawPayload),
          ],
        )

        if (orderResult.rows.length === 0) {
          // The WHERE clause rejected the update -- a stale/out-of-order
          // event arrived after a newer one was already recorded. Line
          // items are deliberately left untouched too: the incoming
          // payload represents an older moment in time than what's
          // already stored, so applying its items would be its own kind
          // of regression.
          staleIgnoredCount += 1
          await client.query(
            `INSERT INTO channel_activity_log (channel_account_id, sync_run_id, actor_user_id, action, metadata)
             VALUES ($1, $2, NULL, 'ORDER_IMPORT_STALE_EVENT_IGNORED', $3)`,
            [channelAccountId, runId, JSON.stringify({ channelOrderId: order.channelOrderId })],
          )
          continue
        }

        const orderRow = orderResult.rows[0]
        if (orderRow.inserted) importedCount += 1
        else updatedCount += 1

        // Replace line items wholesale on every (re-)import -- simpler and
        // safer than diffing individual lines, and a channel order's line
        // items don't change composition after creation in practice.
        await client.query(`DELETE FROM channel_order_items WHERE channel_order_id = $1`, [orderRow.id])
        for (const item of order.items) {
          const mappingId = mappingIdByKey.get(`${item.channelProductId}::${item.channelSku}`) ?? null
          await client.query(
            `INSERT INTO channel_order_items
               (channel_order_id, channel_product_mapping_id, channel_sku, quantity, unit_price, line_total, raw_payload)
             VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)`,
            [orderRow.id, mappingId, item.channelSku, item.quantity, item.unitPrice, item.lineTotal, JSON.stringify(item)],
          )
        }
      } catch (orderError) {
        failedCount += 1
        logger.error(`[ChannelOrderImport] Unexpected error importing one order for channel account ${channelAccountId}`, orderError)
      }
    }

    const runStatus = fetchResult.complete ? 'committed' : 'failed'
    await client.query(
      `UPDATE channel_sync_runs SET status = $2, created_count = $3, updated_count = $4, failed_count = $5, unmapped_count = $6, error_report = $7::jsonb, committed_at = now() WHERE id = $1`,
      [
        runId,
        runStatus,
        importedCount,
        updatedCount,
        failedCount,
        issueCount,
        fetchResult.complete ? null : JSON.stringify({ paginationError: fetchResult.error, staleIgnoredCount }),
      ],
    )

    // Only a fully-successful, non-backfill run advances the checkpoint.
    // Advancing it after a partial pagination failure could permanently
    // skip whatever page never got fetched (§24) -- the next poll must
    // retry from the same (pre-run) starting point, not move forward.
    if (fetchResult.complete && !isBackfill) {
      await client.query(`UPDATE commerce_channel_accounts SET order_import_watermark = $2 WHERE id = $1`, [channelAccountId, fetchStartedAt])
    }

    await client.query('COMMIT')
    return { runId, totalFetched: fetchedOrders.length, importedCount, updatedCount, staleIgnoredCount, issueCount, failedCount, complete: fetchResult.complete }
  } catch (error) {
    await client.query('ROLLBACK')
    logger.error('Order import run error:', error)
    throw error
  } finally {
    client.release()
  }
}

/**
 * An order that cannot become a valid channel_orders row at all --
 * channel_orders.gross_amount/currency are NOT NULL, and a guessed value
 * would misrepresent a real sale. Distinct from an *unmapped SKU*, which
 * is NOT an import failure (§14) -- that order is still imported normally,
 * just with a NULL channel_product_mapping_id on the affected line, and is
 * surfaced to the ops UI via a derived query, not this function.
 */
function classifyUnimportableOrder(order: ChannelOrder): { code: string; detail: string } | null {
  if (!order.channelOrderId) {
    return { code: 'MALFORMED_REMOTE_ORDER', detail: 'Order payload is missing its own external order ID.' }
  }
  if (!Number.isFinite(order.grossAmount)) {
    return { code: 'INVALID_ORDER_AMOUNT', detail: 'Gross amount was missing or not a parseable number.' }
  }
  if (!order.currency) {
    return { code: 'MISSING_CURRENCY', detail: 'Order currency was missing.' }
  }
  return null
}
