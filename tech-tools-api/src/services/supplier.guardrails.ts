import { query } from '../database/connection'
import logger from '../utils/logger'

const ECONOMICS_INTERVAL_MS = Number.parseInt(
  process.env.PRODUCT_ECONOMICS_INTERVAL_MS || `${60 * 60 * 1000}`,
  10,
)

const DEFAULT_PAYMENT_FEE = Number.parseFloat(
  process.env.DEFAULT_PAYMENT_FEE_PER_ORDER || '0',
)
const DEFAULT_AD_COST = Number.parseFloat(
  process.env.DEFAULT_AD_COST_PER_ORDER || '0',
)
const DEFAULT_REFUND_COST = Number.parseFloat(
  process.env.DEFAULT_EXPECTED_REFUND_COST || '0',
)
const AUTO_PAUSE_MARGIN_FLOOR = Number.parseFloat(
  process.env.AUTO_PAUSE_MARGIN_FLOOR_PERCENT || '10',
)

let guardrailsStarted = false
let guardrailsTimer: NodeJS.Timeout | null = null
let guardrailsBusy = false

async function recomputeEconomicsForAllProducts(): Promise<void> {
  await query(
    `WITH best_offer AS (
      SELECT DISTINCT ON (sp.product_id)
        sp.product_id,
        sp.cost_price,
        sp.shipping_cost
      FROM supplier_products sp
      WHERE sp.is_available = true
      ORDER BY sp.product_id, sp.is_primary DESC, sp.cost_price ASC, sp.shipping_cost ASC
    ),
    economics AS (
      SELECT
        p.id AS product_id,
        COALESCE(p.sale_price, p.base_price, 0)::decimal AS sell_price,
        (
          COALESCE(bo.cost_price, p.cost_price, 0) +
          COALESCE(bo.shipping_cost, 0)
        )::decimal AS landed_cost
      FROM products p
      LEFT JOIN best_offer bo ON bo.product_id = p.id
      WHERE p.deleted_at IS NULL
        AND p.is_active = true
    )
    INSERT INTO product_unit_economics
      (product_id, sell_price, landed_cost, payment_fee, ad_cost_per_order, expected_refund_cost, gross_margin, contribution_margin, margin_percent, updated_at)
    SELECT
      e.product_id,
      e.sell_price,
      e.landed_cost,
      $1,
      $2,
      $3,
      (e.sell_price - e.landed_cost) AS gross_margin,
      (e.sell_price - e.landed_cost - $1 - $2 - $3) AS contribution_margin,
      CASE
        WHEN e.sell_price > 0
          THEN ((e.sell_price - e.landed_cost - $1 - $2 - $3) / e.sell_price) * 100
        ELSE 0
      END AS margin_percent,
      CURRENT_TIMESTAMP
    FROM economics e
    ON CONFLICT (product_id)
    DO UPDATE SET
      sell_price = EXCLUDED.sell_price,
      landed_cost = EXCLUDED.landed_cost,
      payment_fee = EXCLUDED.payment_fee,
      ad_cost_per_order = EXCLUDED.ad_cost_per_order,
      expected_refund_cost = EXCLUDED.expected_refund_cost,
      gross_margin = EXCLUDED.gross_margin,
      contribution_margin = EXCLUDED.contribution_margin,
      margin_percent = EXCLUDED.margin_percent,
      updated_at = CURRENT_TIMESTAMP`,
    [DEFAULT_PAYMENT_FEE, DEFAULT_AD_COST, DEFAULT_REFUND_COST],
  )
}

async function applyAutoPauseGuard(): Promise<void> {
  await query(
    `INSERT INTO product_operational_flags
      (product_id, auto_pause, pause_reason, updated_at)
     SELECT
       pue.product_id,
       CASE
         WHEN pue.contribution_margin <= 0 OR pue.margin_percent < $1 THEN true
         ELSE false
       END AS auto_pause,
       CASE
         WHEN pue.contribution_margin <= 0 OR pue.margin_percent < $1
         THEN 'Auto paused by margin guardrail'
         ELSE NULL
       END AS pause_reason,
       CURRENT_TIMESTAMP
     FROM product_unit_economics pue
     ON CONFLICT (product_id)
     DO UPDATE SET
       auto_pause = EXCLUDED.auto_pause,
       pause_reason = EXCLUDED.pause_reason,
       updated_at = CURRENT_TIMESTAMP`,
    [AUTO_PAUSE_MARGIN_FLOOR],
  )
}

async function processGuardrailsTick(): Promise<void> {
  if (guardrailsBusy) return
  guardrailsBusy = true

  try {
    await recomputeEconomicsForAllProducts()
    await applyAutoPauseGuard()
  } catch (error) {
    logger.error('[SupplierGuardrails] Worker tick failed', error)
  } finally {
    guardrailsBusy = false
  }
}

export function startSupplierGuardrailsWorker(): void {
  if (guardrailsStarted) return

  guardrailsStarted = true
  logger.info('[SupplierGuardrails] Starting worker', {
    intervalMs: ECONOMICS_INTERVAL_MS,
    autoPauseMarginFloor: AUTO_PAUSE_MARGIN_FLOOR,
  })

  void processGuardrailsTick()

  guardrailsTimer = setInterval(() => {
    void processGuardrailsTick()
  }, ECONOMICS_INTERVAL_MS)
}

export function stopSupplierGuardrailsWorker(): void {
  if (!guardrailsStarted) return
  guardrailsStarted = false

  if (guardrailsTimer) {
    clearInterval(guardrailsTimer)
    guardrailsTimer = null
  }

  logger.info('[SupplierGuardrails] Worker stopped')
}
