import { listChannelOrders, getChannelOrder, runOrderImport, listOrderImportIssues, resolveOrderImportIssue } from './channel-order.controller'
import * as channelSyncService from '../../../services/channels/channel-sync.service'
import { query } from '../../../database/connection'

jest.mock('../../../database/connection', () => ({ query: jest.fn() }))
jest.mock('../../../utils/logger', () => ({
  __esModule: true,
  default: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}))
jest.mock('../../../services/staff-audit.service', () => ({ recordStaffAuditEvent: jest.fn() }))
jest.mock('../../../services/channels/channel-sync.service', () => ({ importOrders: jest.fn() }))

const mockQuery = query as jest.Mock
const mockImportOrders = channelSyncService.importOrders as jest.Mock

const makeRes = () => {
  const res: any = {}
  res.status = jest.fn(() => res)
  res.json = jest.fn(() => res)
  return res
}
// Legacy admin -- req.staff is never populated (requirePermissionOrLegacyRole's short-circuit), so every scope check is a no-op.
const makeReq = (overrides: any = {}) => ({ user: { userId: 'user-1', userType: 'admin' }, body: {}, query: {}, params: {}, ...overrides })
// A staff member scoped to Italy only -- req.staff as requirePermissionOrLegacyRole would have attached it.
const scopedReq = (overrides: any = {}) => ({
  user: { userId: 'manager-1', userType: 'customer' },
  staff: { memberships: [{ id: 'm1', role: 'ORDER_MANAGER', marketScope: ['IT'] }], permissions: new Set(['channels.tiktok.orders']) },
  body: {},
  query: {},
  params: {},
  ...overrides,
})

describe('listChannelOrders', () => {
  beforeEach(() => jest.clearAllMocks())

  it('filters by channelAccountId when provided', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] })
    const req: any = makeReq({ query: { channelAccountId: 'account-1' } })
    await listChannelOrders(req, makeRes())

    expect(mockQuery.mock.calls[0][0]).toContain('co.channel_account_id = $1')
    expect(mockQuery.mock.calls[0][0]).toContain('JOIN commerce_channel_accounts ca')
    expect(mockQuery.mock.calls[0][1]).toEqual(['account-1'])
  })

  it('lists all orders (no market-scope restriction) for a legacy admin', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] })
    const req: any = makeReq()
    await listChannelOrders(req, makeRes())
    expect(mockQuery.mock.calls[0][0]).not.toContain('ca.market_country')
  })

  it('restricts to the caller market scope for a scoped staff member', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] })
    const req: any = scopedReq()
    await listChannelOrders(req, makeRes())
    expect(mockQuery.mock.calls[0][0]).toContain('LOWER(ca.market_country)')
  })

  it('filters to needs-mapping orders when requested', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] })
    const req: any = makeReq({ query: { needsMapping: 'true' } })
    await listChannelOrders(req, makeRes())
    expect(mockQuery.mock.calls[0][0]).toContain('channel_product_mapping_id IS NULL')
  })
})

describe('getChannelOrder', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns 404 when the order does not exist', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] })
    const req: any = makeReq({ params: { orderId: 'missing' } })
    const res = makeRes()
    await getChannelOrder(req, res)
    expect(res.status).toHaveBeenCalledWith(404)
  })

  it('returns the order with its line items for an in-scope caller', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 'order-1', channel_order_id: 'tt-order-1', market_country: 'IT' }] })
      .mockResolvedValueOnce({ rows: [{ id: 'item-1', channel_sku: 'DRILL-20V-BLK' }] })
    const req: any = scopedReq({ params: { orderId: 'order-1' } })
    const res = makeRes()
    await getChannelOrder(req, res)

    expect(res.json.mock.calls[0][0].order.id).toBe('order-1')
    expect(res.json.mock.calls[0][0].order.market_country).toBeUndefined()
    expect(res.json.mock.calls[0][0].items).toHaveLength(1)
  })

  it('IDOR guard -- 404s (not 403) an order belonging to a market outside the caller scope', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'order-1', channel_order_id: 'tt-order-1', market_country: 'DE' }] })
    const req: any = scopedReq({ params: { orderId: 'order-1' } })
    const res = makeRes()
    await getChannelOrder(req, res)

    expect(res.status).toHaveBeenCalledWith(404)
    expect(mockQuery).toHaveBeenCalledTimes(1) // never reaches the line-items query
  })
})

describe('runOrderImport', () => {
  beforeEach(() => jest.clearAllMocks())

  it('requires channelAccountId', async () => {
    const req: any = makeReq({ body: {} })
    const res = makeRes()
    await runOrderImport(req, res)
    expect(res.status).toHaveBeenCalledWith(400)
  })

  it('returns 201 with the import summary on success', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ market_country: 'IT' }] }) // loadChannelAccountCountry
    mockImportOrders.mockResolvedValue({ runId: 'run-1', totalFetched: 2, importedCount: 2, updatedCount: 0, staleIgnoredCount: 0, issueCount: 0, failedCount: 0, complete: true })
    const req: any = makeReq({ body: { channelAccountId: 'account-1' } })
    const res = makeRes()
    await runOrderImport(req, res)

    expect(res.status).toHaveBeenCalledWith(201)
    expect(mockImportOrders).toHaveBeenCalledWith('account-1', 'user-1', {})
  })

  it('404s for a channel account outside the caller market scope, without ever calling importOrders', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ market_country: 'DE' }] })
    const req: any = scopedReq({ body: { channelAccountId: 'account-1' } })
    const res = makeRes()
    await runOrderImport(req, res)

    expect(res.status).toHaveBeenCalledWith(404)
    expect(mockImportOrders).not.toHaveBeenCalled()
  })

  it('404s for a nonexistent channel account', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] })
    const req: any = makeReq({ body: { channelAccountId: 'missing' } })
    const res = makeRes()
    await runOrderImport(req, res)
    expect(res.status).toHaveBeenCalledWith(404)
  })

  it('passes a validated fromDate through as a backfill option', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ market_country: 'IT' }] })
    mockImportOrders.mockResolvedValue({ runId: 'run-1', totalFetched: 0, importedCount: 0, updatedCount: 0, staleIgnoredCount: 0, issueCount: 0, failedCount: 0, complete: true })
    const req: any = makeReq({ body: { channelAccountId: 'account-1', fromDate: '2026-08-01T00:00:00.000Z' } })
    const res = makeRes()
    await runOrderImport(req, res)

    expect(mockImportOrders).toHaveBeenCalledWith('account-1', 'user-1', { fromDate: new Date('2026-08-01T00:00:00.000Z') })
  })

  it('rejects an unparseable fromDate with 400', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ market_country: 'IT' }] })
    const req: any = makeReq({ body: { channelAccountId: 'account-1', fromDate: 'not-a-date' } })
    const res = makeRes()
    await runOrderImport(req, res)

    expect(res.status).toHaveBeenCalledWith(400)
    expect(mockImportOrders).not.toHaveBeenCalled()
  })

  it('returns 400 (not 500) when the service throws a real, actionable error', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ market_country: 'IT' }] })
    mockImportOrders.mockRejectedValue(new Error('Channel account is not connected -- cannot import orders.'))
    const req: any = makeReq({ body: { channelAccountId: 'account-1' } })
    const res = makeRes()
    await runOrderImport(req, res)

    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json.mock.calls[0][0].error).toMatch(/not connected/i)
  })
})

describe('listOrderImportIssues', () => {
  beforeEach(() => jest.clearAllMocks())

  it('defaults to unresolved issues only', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] })
    const req: any = makeReq()
    await listOrderImportIssues(req, makeRes())
    expect(mockQuery.mock.calls[0][0]).toContain('coii.resolved_at IS NULL')
  })

  it('includes resolved issues when explicitly requested', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] })
    const req: any = makeReq({ query: { includeResolved: 'true' } })
    await listOrderImportIssues(req, makeRes())
    expect(mockQuery.mock.calls[0][0]).not.toContain('coii.resolved_at IS NULL')
  })
})

describe('resolveOrderImportIssue', () => {
  beforeEach(() => jest.clearAllMocks())

  it('404s for a nonexistent issue', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] })
    const req: any = makeReq({ params: { issueId: 'missing' } })
    const res = makeRes()
    await resolveOrderImportIssue(req, res)
    expect(res.status).toHaveBeenCalledWith(404)
  })

  it('IDOR guard -- 404s an issue belonging to an out-of-scope market', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'issue-1', resolved_at: null, market_country: 'DE' }] })
    const req: any = scopedReq({ params: { issueId: 'issue-1' } })
    const res = makeRes()
    await resolveOrderImportIssue(req, res)
    expect(res.status).toHaveBeenCalledWith(404)
  })

  it('rejects resolving an already-resolved issue', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'issue-1', resolved_at: '2026-08-01T00:00:00.000Z', market_country: 'IT' }] })
    const req: any = makeReq({ params: { issueId: 'issue-1' } })
    const res = makeRes()
    await resolveOrderImportIssue(req, res)
    expect(res.status).toHaveBeenCalledWith(400)
  })

  it('resolves an open, in-scope issue', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'issue-1', resolved_at: null, market_country: 'IT' }] })
    mockQuery.mockResolvedValueOnce({ rows: [] })
    const req: any = makeReq({ params: { issueId: 'issue-1' }, body: { note: 'Fixed manually in TikTok Seller Center.' } })
    const res = makeRes()
    await resolveOrderImportIssue(req, res)

    expect(res.json).toHaveBeenCalledWith({ success: true })
    expect(mockQuery.mock.calls[1][1]).toEqual(['issue-1', 'user-1', 'Fixed manually in TikTok Seller Center.'])
  })
})
