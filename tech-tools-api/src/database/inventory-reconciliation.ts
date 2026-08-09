import { Pool } from 'pg'
import dotenv from 'dotenv'

dotenv.config()

// READ-ONLY inventory reconciliation report.
//
// Compares products.stock_quantity (a display-only column that is never
// read by checkout) against the real inventory table (the table checkout
// actually trusts) and reports every product where they disagree, or where
// no inventory row exists at all.
//
// This script only ever runs SELECT statements against the database. The
// --repair-dry-run flag prints proposed SQL to fix *missing* inventory rows
// (the one case with an unambiguous, safe fix) -- it never executes
// anything. Running the printed statements against production is a manual,
// explicit decision for whoever is authorized to make it; this script does
// not do it for them.

export interface ReconciliationRow {
  productId: string
  sku: string
  productStockQuantity: number
  inventoryCurrentStock: number | null
  inventoryReservedStock: number | null
  inventoryAvailableStock: number | null
  missingInventoryRow: boolean
}

export interface ReconciliationResult extends ReconciliationRow {
  discrepancy: number | null
  hasDiscrepancy: boolean
}

export function reconcile(
  rows: ReconciliationRow[],
): ReconciliationResult[] {
  return rows.map((row) => {
    if (row.missingInventoryRow) {
      return { ...row, discrepancy: null, hasDiscrepancy: true }
    }

    const discrepancy =
      row.productStockQuantity - (row.inventoryAvailableStock ?? 0)

    return { ...row, discrepancy, hasDiscrepancy: discrepancy !== 0 }
  })
}

// Proposed repair SQL for the one case with a safe, unambiguous fix: a
// product with no inventory row at all. Deliberately does NOT propose
// "fixing" a stock_quantity/available_stock mismatch where an inventory row
// already exists -- inventory is the operational source of truth there, so
// overwriting it from the stale products.stock_quantity column would be the
// wrong direction of repair.
export function buildRepairStatements(
  results: ReconciliationResult[],
): string[] {
  return results
    .filter((r) => r.missingInventoryRow)
    .map(
      (r) =>
        `INSERT INTO inventory (product_id, current_stock, reserved_stock) VALUES ('${r.productId}', ${r.productStockQuantity}, 0); -- SKU ${r.sku}`,
    )
}

const READ_ONLY_QUERY = `
  SELECT
    p.id AS product_id,
    p.sku,
    p.stock_quantity AS product_stock_quantity,
    inv.current_stock,
    inv.reserved_stock,
    inv.available_stock,
    (inv.product_id IS NULL) AS missing_inventory_row
  FROM products p
  LEFT JOIN (
    SELECT
      product_id,
      SUM(current_stock) AS current_stock,
      SUM(reserved_stock) AS reserved_stock,
      SUM(available_stock) AS available_stock
    FROM inventory
    GROUP BY product_id
  ) inv ON inv.product_id = p.id
  WHERE p.deleted_at IS NULL
  ORDER BY p.sku
`

function toRow(dbRow: any): ReconciliationRow {
  return {
    productId: dbRow.product_id,
    sku: dbRow.sku,
    productStockQuantity: Number(dbRow.product_stock_quantity ?? 0),
    inventoryCurrentStock:
      dbRow.current_stock === null ? null : Number(dbRow.current_stock),
    inventoryReservedStock:
      dbRow.reserved_stock === null ? null : Number(dbRow.reserved_stock),
    inventoryAvailableStock:
      dbRow.available_stock === null ? null : Number(dbRow.available_stock),
    missingInventoryRow: Boolean(dbRow.missing_inventory_row),
  }
}

async function main() {
  const repairDryRun = process.argv.includes('--repair-dry-run')
  const asJson = process.argv.includes('--json')

  const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'techtools',
    user: process.env.DB_USER || 'techtools_user',
    password: process.env.DB_PASSWORD || 'password',
  })

  try {
    const { rows } = await pool.query(READ_ONLY_QUERY)
    const results = reconcile(rows.map(toRow))
    const withDiscrepancy = results.filter((r) => r.hasDiscrepancy)

    if (asJson) {
      console.log(JSON.stringify(results, null, 2))
    } else {
      console.log('\nInventory Reconciliation Report')
      console.log('='.repeat(60))
      console.log(`Total products checked: ${results.length}`)
      console.log(`Products with a discrepancy: ${withDiscrepancy.length}`)
      console.log(
        `  - missing inventory row: ${
          results.filter((r) => r.missingInventoryRow).length
        }`,
      )
      console.log(
        `  - stock_quantity vs available_stock mismatch: ${
          withDiscrepancy.filter((r) => !r.missingInventoryRow).length
        }\n`,
      )

      for (const r of withDiscrepancy) {
        const detail = r.missingInventoryRow
          ? '[NO INVENTORY ROW -- checkout sees 0 available_stock]'
          : `current_stock=${r.inventoryCurrentStock} reserved_stock=${r.inventoryReservedStock} available_stock=${r.inventoryAvailableStock} (diff=${r.discrepancy})`

        console.log(
          `${r.sku.padEnd(24)} product_id=${r.productId} stock_quantity=${
            r.productStockQuantity
          } ${detail}`,
        )
      }
    }

    if (repairDryRun) {
      const statements = buildRepairStatements(results)
      console.log('\n--- Proposed repair (DRY RUN -- nothing executed) ---')
      console.log(
        'Review each statement, then run it manually against production only after explicit founder approval.\n',
      )
      if (statements.length === 0) {
        console.log('No missing-inventory-row repairs to propose.')
      } else {
        statements.forEach((s) => console.log(s))
      }
      console.log(
        '\nNote: stock_quantity vs available_stock mismatches where an inventory row already ' +
          'exists are NOT proposed for repair -- inventory is the operational source of truth, ' +
          'so these are reported for manual review, not "fixed" by overwriting real stock.',
      )
    }
  } finally {
    await pool.end()
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error('Inventory reconciliation failed:', error)
    process.exit(1)
  })
}
