import { getMyEarningsSummary, getMyEarningsLedger } from './seller-earnings.controller'
import { getSellerEarningsSummary, getSellerPayoutLedger } from '../../../services/seller-payout.service'

jest.mock('../../../services/seller-payout.service', () => ({
  getSellerEarningsSummary: jest.fn(),
  getSellerPayoutLedger: jest.fn(),
}))
jest.mock('../../../utils/logger', () => ({
  __esModule: true,
  default: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}))

const mockGetSummary = getSellerEarningsSummary as jest.Mock
const mockGetLedger = getSellerPayoutLedger as jest.Mock

const makeRes = () => {
  const res: any = {}
  res.status = jest.fn(() => res)
  res.json = jest.fn(() => res)
  return res
}

describe('seller-earnings.controller -- guarded exactly like seller-product.controller.ts', () => {
  beforeEach(() => jest.clearAllMocks())

  it('getMyEarningsSummary 403s without a sellerProfileId', async () => {
    const req: any = { user: { id: 'admin-without-seller-profile' } }
    const res = makeRes()

    await getMyEarningsSummary(req, res)

    expect(res.status).toHaveBeenCalledWith(403)
    expect(mockGetSummary).not.toHaveBeenCalled()
  })

  it('getMyEarningsLedger 403s without a sellerProfileId', async () => {
    const req: any = { user: { id: 'admin-without-seller-profile' }, query: {} }
    const res = makeRes()

    await getMyEarningsLedger(req, res)

    expect(res.status).toHaveBeenCalledWith(403)
    expect(mockGetLedger).not.toHaveBeenCalled()
  })

  it('getMyEarningsSummary returns the real summary for an approved seller', async () => {
    mockGetSummary.mockResolvedValue({
      pendingBalance: 20,
      confirmedUnpaidBalance: 50,
      lifetimePaid: 100,
      tier: 'basic',
      commissionRate: 15,
    })
    const req: any = { sellerProfileId: 'seller-1' }
    const res = makeRes()

    await getMyEarningsSummary(req, res)

    expect(mockGetSummary).toHaveBeenCalledWith('seller-1')
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, data: expect.objectContaining({ confirmedUnpaidBalance: 50 }) }),
    )
  })

  it('getMyEarningsLedger paginates using query params', async () => {
    mockGetLedger.mockResolvedValue({ entries: [], page: 2, hasMore: false })
    const req: any = { sellerProfileId: 'seller-1', query: { page: '2', limit: '10' } }
    const res = makeRes()

    await getMyEarningsLedger(req, res)

    expect(mockGetLedger).toHaveBeenCalledWith('seller-1', { page: 2, limit: 10 })
  })
})
