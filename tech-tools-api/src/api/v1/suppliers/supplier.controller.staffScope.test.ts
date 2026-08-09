import {
  getSuppliers,
  getSupplierById,
  updateSupplier,
  deleteSupplier,
  getSupplierProducts,
} from './supplier.controller'
import { query } from '../../../database/connection'
import { recordStaffAuditEvent } from '../../../services/staff-audit.service'

jest.mock('../../../database/connection', () => ({
  query: jest.fn(),
}))

jest.mock('../../../services/staff-audit.service', () => ({
  recordStaffAuditEvent: jest.fn(),
}))

jest.mock('../../../utils/logger', () => ({
  __esModule: true,
  default: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}))

const mockQuery = query as jest.Mock

const makeRes = () => {
  const res: any = {}
  res.status = jest.fn(() => res)
  res.json = jest.fn(() => res)
  return res
}

const marketManagerReq = (overrides: any = {}) => ({
  user: { userId: 'manager-1', userType: 'customer' },
  staff: {
    memberships: [{ id: 'm1', role: 'MARKET_MANAGER', marketScope: ['CM'] }],
    permissions: new Set(['suppliers.view', 'suppliers.manage']),
  },
  query: {},
  params: {},
  body: {},
  ...overrides,
})

const legacyAdminReq = (overrides: any = {}) => ({
  user: { userId: 'admin-1', userType: 'admin' },
  query: {},
  params: {},
  body: {},
  ...overrides,
})

describe('getSuppliers -- market scope on the list query', () => {
  beforeEach(() => jest.clearAllMocks())

  it('adds a scope filter to both the list and count queries for a scoped MARKET_MANAGER', async () => {
    mockQuery.mockResolvedValue({ rows: [{ count: '0' }] })
    const req: any = marketManagerReq()
    const res = makeRes()

    await getSuppliers(req, res)

    const [listSql, listParams] = mockQuery.mock.calls[0]
    expect(listSql).toContain('LOWER(country_code)')
    expect(listParams[listParams.length - 3]).toEqual(
      expect.arrayContaining(['cm', 'cameroon']),
    )

    const [countSql] = mockQuery.mock.calls[1]
    expect(countSql).toContain('LOWER(country_code)')
  })

  it('adds no scope filter for a legacy admin', async () => {
    mockQuery.mockResolvedValue({ rows: [{ count: '0' }] })
    const req: any = legacyAdminReq()
    const res = makeRes()

    await getSuppliers(req, res)

    const [listSql] = mockQuery.mock.calls[0]
    expect(listSql).not.toContain('country_code')
  })
})

describe('getSupplierById -- IDOR guard', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns the supplier when in scope (CM manager, CM supplier)', async () => {
    mockQuery.mockResolvedValue({
      rows: [{ id: 'sup-1', country_code: 'CM' }],
    })
    const req: any = marketManagerReq({ params: { id: 'sup-1' } })
    const res = makeRes()

    await getSupplierById(req, res)

    expect(res.status).not.toHaveBeenCalledWith(404)
  })

  it('404s and audits when the supplier is outside scope (CM manager, DE supplier)', async () => {
    mockQuery.mockResolvedValue({
      rows: [{ id: 'sup-2', country_code: 'DE' }],
    })
    const req: any = marketManagerReq({ params: { id: 'sup-2' } })
    const res = makeRes()

    await getSupplierById(req, res)

    expect(res.status).toHaveBeenCalledWith(404)
    expect(recordStaffAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'PERMISSION_DENIED',
        metadata: expect.objectContaining({
          check: 'market_scope',
          resourceType: 'supplier',
          resourceId: 'sup-2',
        }),
      }),
    )
  })

  it('a legacy admin can reach any supplier regardless of country', async () => {
    mockQuery.mockResolvedValue({
      rows: [{ id: 'sup-3', country_code: 'US' }],
    })
    const req: any = legacyAdminReq({ params: { id: 'sup-3' } })
    const res = makeRes()

    await getSupplierById(req, res)

    expect(res.status).not.toHaveBeenCalledWith(404)
  })
})

describe('updateSupplier / deleteSupplier / getSupplierProducts -- IDOR guard', () => {
  beforeEach(() => jest.clearAllMocks())

  it('updateSupplier 404s an out-of-scope supplier before running the UPDATE', async () => {
    mockQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('SELECT id, country_code, status FROM suppliers')) {
        return { rows: [{ id: 'sup-1', country_code: 'DE', status: 'active' }] }
      }
      return { rows: [] }
    })
    const req: any = marketManagerReq({ params: { id: 'sup-1' }, body: { status: 'inactive' } })
    const res = makeRes()

    await updateSupplier(req, res)

    expect(res.status).toHaveBeenCalledWith(404)
    const updateCall = mockQuery.mock.calls.find((c: any[]) => c[0].includes('UPDATE suppliers'))
    expect(updateCall).toBeUndefined()
  })

  it('deleteSupplier 404s an out-of-scope supplier before running the soft delete', async () => {
    mockQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('SELECT id, country_code, status FROM suppliers')) {
        return { rows: [{ id: 'sup-1', country_code: 'IT', status: 'active' }] }
      }
      return { rows: [] }
    })
    const req: any = marketManagerReq({ params: { id: 'sup-1' } })
    const res = makeRes()

    await deleteSupplier(req, res)

    expect(res.status).toHaveBeenCalledWith(404)
    const deleteCall = mockQuery.mock.calls.find((c: any[]) =>
      c[0].includes('SET deleted_at'),
    )
    expect(deleteCall).toBeUndefined()
  })

  it('getSupplierProducts 404s for a supplier outside scope instead of returning an empty list', async () => {
    mockQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('SELECT id, country_code, status FROM suppliers')) {
        return { rows: [{ id: 'sup-1', country_code: 'US', status: 'active' }] }
      }
      return { rows: [] }
    })
    const req: any = marketManagerReq({ params: { id: 'sup-1' } })
    const res = makeRes()

    await getSupplierProducts(req, res)

    expect(res.status).toHaveBeenCalledWith(404)
  })

  it('updateSupplier allows an in-scope update for a MARKET_MANAGER', async () => {
    mockQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('SELECT id, country_code, status FROM suppliers')) {
        return { rows: [{ id: 'sup-1', country_code: 'CM', status: 'active' }] }
      }
      if (sql.includes('UPDATE suppliers')) {
        return { rows: [{ id: 'sup-1', status: 'inactive' }] }
      }
      return { rows: [] }
    })
    const req: any = marketManagerReq({ params: { id: 'sup-1' }, body: { status: 'inactive' } })
    const res = makeRes()

    await updateSupplier(req, res)

    expect(res.status).not.toHaveBeenCalledWith(404)
  })
})
