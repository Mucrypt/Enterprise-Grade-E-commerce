import { activateBusinessMode } from './user.controller'
import { query } from '../../../database/connection'

jest.mock('../../../database/connection', () => ({
  query: jest.fn(),
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

const makeRes = () => {
  const res: any = {}
  res.status = jest.fn(() => res)
  res.json = jest.fn(() => res)
  return res
}

describe('activateBusinessMode', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.ENABLE_BUSINESS_MODE_SWITCH = 'true'
  })

  it('returns 404 when feature flag is disabled', async () => {
    process.env.ENABLE_BUSINESS_MODE_SWITCH = 'false'

    const req: any = {
      user: { userId: 'user-1' },
      body: {},
    }
    const res = makeRes()

    await activateBusinessMode(req, res)

    expect(res.status).toHaveBeenCalledWith(404)
  })

  it('activates business mode for authenticated user', async () => {
    mockQuery.mockImplementation(async (sql: string, params: any[]) => {
      if (sql.includes('SELECT id, email, first_name')) {
        return {
          rows: [
            {
              id: 'user-1',
              email: 'user@example.com',
              first_name: 'Jane',
              last_name: 'Doe',
              user_type: 'customer',
              is_business_account: false,
              company_name: null,
              business_type: null,
            },
          ],
        }
      }

      if (sql.includes('SELECT to_regclass($1) AS regclass')) {
        const tableName = params?.[0]
        if (tableName === 'public.creator_profiles') {
          return { rows: [{ regclass: null }] }
        }
        if (tableName === 'public.user_business_mode_audit') {
          return { rows: [{ regclass: null }] }
        }
      }

      return { rows: [] }
    })

    const req: any = {
      user: { userId: 'user-1' },
      body: {
        source: 'test',
      },
      ip: '127.0.0.1',
      headers: { 'user-agent': 'jest' },
    }
    const res = makeRes()

    await activateBusinessMode(req, res)

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          user: expect.objectContaining({
            id: 'user-1',
            isBusinessAccount: true,
          }),
        }),
      }),
    )
  })
})
