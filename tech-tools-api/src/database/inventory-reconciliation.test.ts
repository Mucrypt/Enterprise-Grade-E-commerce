import {
  reconcile,
  buildRepairStatements,
  ReconciliationRow,
} from './inventory-reconciliation'

const baseRow = (
  overrides: Partial<ReconciliationRow> = {},
): ReconciliationRow => ({
  productId: 'product-1',
  sku: 'SKU-1',
  productStockQuantity: 10,
  inventoryCurrentStock: 10,
  inventoryReservedStock: 0,
  inventoryAvailableStock: 10,
  missingInventoryRow: false,
  ...overrides,
})

describe('reconcile', () => {
  it('flags no discrepancy when stock_quantity matches available_stock', () => {
    const [result] = reconcile([baseRow()])

    expect(result.hasDiscrepancy).toBe(false)
    expect(result.discrepancy).toBe(0)
  })

  it('flags a discrepancy when stock_quantity and available_stock disagree', () => {
    const [result] = reconcile([
      baseRow({ productStockQuantity: 25, inventoryAvailableStock: 10 }),
    ])

    expect(result.hasDiscrepancy).toBe(true)
    expect(result.discrepancy).toBe(15)
  })

  it('flags a missing inventory row as a discrepancy with a null diff', () => {
    const [result] = reconcile([
      baseRow({
        missingInventoryRow: true,
        inventoryCurrentStock: null,
        inventoryReservedStock: null,
        inventoryAvailableStock: null,
      }),
    ])

    expect(result.hasDiscrepancy).toBe(true)
    expect(result.discrepancy).toBeNull()
  })

  it('is read-only: never mutates the input rows', () => {
    const input = [baseRow({ productStockQuantity: 5 })]
    const snapshot = JSON.parse(JSON.stringify(input))

    reconcile(input)

    expect(input).toEqual(snapshot)
  })
})

describe('buildRepairStatements', () => {
  it('proposes an INSERT for products missing an inventory row', () => {
    const results = reconcile([
      baseRow({
        productId: 'abc-123',
        sku: 'NEW-SKU',
        productStockQuantity: 7,
        missingInventoryRow: true,
        inventoryCurrentStock: null,
        inventoryReservedStock: null,
        inventoryAvailableStock: null,
      }),
    ])

    const statements = buildRepairStatements(results)

    expect(statements).toHaveLength(1)
    expect(statements[0]).toContain("INSERT INTO inventory")
    expect(statements[0]).toContain("'abc-123'")
    expect(statements[0]).toContain('7, 0')
    expect(statements[0]).toContain('NEW-SKU')
  })

  it('never proposes repairing a stock_quantity mismatch when inventory already exists', () => {
    const results = reconcile([
      baseRow({ productStockQuantity: 99, inventoryAvailableStock: 3 }),
    ])

    expect(buildRepairStatements(results)).toHaveLength(0)
  })

  it('proposes nothing when there is no discrepancy at all', () => {
    const results = reconcile([baseRow()])

    expect(buildRepairStatements(results)).toHaveLength(0)
  })
})
