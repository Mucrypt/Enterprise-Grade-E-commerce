import {
  getSellerVerificationQueue,
  rejectSellerVerificationRequest,
} from './sellers.controller'
import { getClient, query } from '../../../database/connection'

jest.mock('../../../database/connection', () => ({
  query: jest.fn(),
  getClient: jest.fn(),
}))

jest.mock('../../../utils/logger', () => ({
  __esModule: true,
  default: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  },
}))

const mockQuery = query as jest.Mock
const mockGetClient = getClient as jest.Mock

const makeRes = () => {
  const res: any = {}
  res.status = jest.fn(() => res)
  res.json = jest.fn(() => res)
  return res
}

describe('admin sellers controller', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.ENABLE_SELLER_TIERS = 'true'
  })

  it('returns queue items for pending moderation', async () => {
    mockQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('SELECT to_regclass($1) AS regclass')) {
        return { rows: [{ regclass: 'seller_verification_requests' }] }
      }

      if (sql.includes('FROM seller_verification_requests svr')) {
        return {
          rows: [{ id: 'req-1', status: 'pending' }],
        }
      }

      if (sql.includes('SELECT COUNT(*)::int AS total')) {
        return { rows: [{ total: 1 }] }
      }

      return { rows: [] }
    })

    const req: any = { query: {} }
    const res = makeRes()

    await getSellerVerificationQueue(req, res)

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true }),
    )
  })

  it('rejects non-pending requests when admin tries to reject', async () => {
    const client = {
      query: jest.fn(async (sql: string) => {
        if (sql === 'BEGIN' || sql === 'ROLLBACK') {
          return { rows: [] }
        }

        if (
          sql.includes('SELECT *') &&
          sql.includes('seller_verification_requests')
        ) {
          return {
            rows: [{ id: 'req-1', status: 'approved' }],
          }
        }

        return { rows: [] }
      }),
      release: jest.fn(),
    }

    mockQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('SELECT to_regclass($1) AS regclass')) {
        return { rows: [{ regclass: 'seller_verification_requests' }] }
      }

      return { rows: [] }
    })

    mockGetClient.mockResolvedValue(client)

    const req: any = {
      user: { userId: 'admin-1' },
      params: { requestId: 'req-1' },
      body: {},
      headers: {},
      ip: '127.0.0.1',
    }
    const res = makeRes()

    await rejectSellerVerificationRequest(req, res)

    expect(res.status).toHaveBeenCalledWith(409)
  })
})
