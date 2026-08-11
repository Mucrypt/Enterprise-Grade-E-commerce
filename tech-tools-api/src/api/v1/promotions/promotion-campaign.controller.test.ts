import {
  createCampaign,
  updateCampaign,
  scheduleCampaign,
  publishCampaignNow,
  cancelCampaign,
  getCampaign,
} from './promotion-campaign.controller'
import { query } from '../../../database/connection'

jest.mock('../../../database/connection', () => ({ query: jest.fn() }))
jest.mock('../../../utils/logger', () => ({
  __esModule: true,
  default: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}))
// Every platform reports NOT_CONFIGURED/NEEDS_CREDENTIALS in this test env
// regardless -- these controller tests don't exercise adapter network
// calls at all (that's promotion-campaign.queue.test.ts's job), so the
// real registry is fine to use as-is here.

const mockQuery = query as jest.Mock

const makeRes = () => {
  const res: any = {}
  res.status = jest.fn(() => res)
  res.json = jest.fn(() => res)
  return res
}

// No req.staff -> resolveStaffScope() resolves this as global/unrestricted
// (matches every other staff-scoped surface's legacy-admin convention),
// so these tests exercise the "in scope" path by default. Market-scope
// enforcement itself is covered separately in
// promotion-scope.helpers.test.ts (the pure scope logic) plus dedicated
// scoped-caller tests below.
const makeReq = (overrides: any = {}) => ({
  user: { userId: 'marketer-1', userType: 'customer' },
  body: {},
  params: {},
  query: {},
  ...overrides,
})

const scopedMarketingManagerReq = (overrides: any = {}) => ({
  user: { userId: 'manager-1', userType: 'customer' },
  staff: {
    memberships: [{ id: 'm1', role: 'MARKETING_MANAGER', marketScope: ['CM'] }],
    permissions: new Set(['campaigns.view', 'campaigns.manage']),
  },
  body: {},
  params: {},
  query: {},
  ...overrides,
})

describe('createCampaign', () => {
  beforeEach(() => jest.clearAllMocks())

  it('creates a DRAFT campaign with a slugified, unique campaign_key derived from the name', async () => {
    mockQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('INSERT INTO promotion_campaigns')) return { rows: [{ id: 'campaign-1' }] }
      if (sql.includes('INSERT INTO promotion_activity_log')) return { rows: [] }
      if (sql.includes('SELECT * FROM promotion_campaigns')) {
        return { rows: [{ id: 'campaign-1', name: 'Cordless Tools Weekend', campaign_key: 'cordless-tools-weekend-abc123', status: 'DRAFT', creative_assets: [] }] }
      }
      return { rows: [] }
    })
    const req: any = makeReq({ body: { name: 'Cordless Tools Weekend!!' } })
    const res = makeRes()

    await createCampaign(req, res)

    expect(res.status).toHaveBeenCalledWith(201)
    const insertCall = mockQuery.mock.calls.find((c: any[]) => c[0].includes('INSERT INTO promotion_campaigns'))
    expect(insertCall![1][0]).toBe('Cordless Tools Weekend!!')
    expect(insertCall![1][1]).toMatch(/^cordless-tools-weekend-[a-f0-9]{8}$/)
    expect(insertCall![1][7]).toBeNull() // market_scope -- global caller, omitted marketScope defaults to NULL
    expect(insertCall![1][8]).toBe('marketer-1') // created_by
  })

  it('rejects a request with no name', async () => {
    const req: any = makeReq({ body: {} })
    const res = makeRes()

    await createCampaign(req, res)

    expect(res.status).toHaveBeenCalledWith(400)
    expect(mockQuery).not.toHaveBeenCalled()
  })

  it('defaults a scoped caller\'s new campaign to their own market_scope when marketScope is omitted', async () => {
    mockQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('INSERT INTO promotion_campaigns')) return { rows: [{ id: 'campaign-1' }] }
      if (sql.includes('SELECT * FROM promotion_campaigns')) return { rows: [{ id: 'campaign-1', creative_assets: [] }] }
      return { rows: [] }
    })
    const req: any = scopedMarketingManagerReq({ body: { name: 'CM Weekend Deal' } })
    const res = makeRes()

    await createCampaign(req, res)

    expect(res.status).toHaveBeenCalledWith(201)
    const insertCall = mockQuery.mock.calls.find((c: any[]) => c[0].includes('INSERT INTO promotion_campaigns'))
    expect(insertCall![1][7]).toEqual(['CM'])
  })

  it('rejects a scoped caller trying to create a global campaign (explicit marketScope: null)', async () => {
    const req: any = scopedMarketingManagerReq({ body: { name: 'Global attempt', marketScope: null } })
    const res = makeRes()

    await createCampaign(req, res)

    expect(res.status).toHaveBeenCalledWith(403)
    expect(mockQuery).not.toHaveBeenCalled()
  })

  it('rejects a scoped caller trying to create a campaign scoped to a country outside their own scope', async () => {
    const req: any = scopedMarketingManagerReq({ body: { name: 'Wrong market', marketScope: ['US'] } })
    const res = makeRes()

    await createCampaign(req, res)

    expect(res.status).toHaveBeenCalledWith(403)
    expect(mockQuery).not.toHaveBeenCalled()
  })
})

describe('updateCampaign -- edit lock', () => {
  beforeEach(() => jest.clearAllMocks())

  it('rejects edits to a campaign that is no longer DRAFT (409)', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'campaign-1', status: 'PUBLISHED', market_scope: null }] })
    const req: any = makeReq({ params: { id: 'campaign-1' }, body: { name: 'New name' } })
    const res = makeRes()

    await updateCampaign(req, res)

    expect(res.status).toHaveBeenCalledWith(409)
  })

  it('404s when the campaign does not exist', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] })
    const req: any = makeReq({ params: { id: 'missing' } })
    const res = makeRes()

    await updateCampaign(req, res)

    expect(res.status).toHaveBeenCalledWith(404)
  })

  it('404s (IDOR guard) when a scoped caller tries to edit a campaign outside their market, even though it exists', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'campaign-1', status: 'DRAFT', market_scope: ['US'] }] })
    const req: any = scopedMarketingManagerReq({ params: { id: 'campaign-1' }, body: { name: 'New name' } })
    const res = makeRes()

    await updateCampaign(req, res)

    expect(res.status).toHaveBeenCalledWith(404)
  })

  it('snapshots only display fields for an attached product, not the full product row, and skips a product that does not exist', async () => {
    mockQuery.mockImplementation(async (sql: string, params?: any[]) => {
      if (sql.includes('SELECT id, status, market_scope FROM promotion_campaigns')) return { rows: [{ id: 'campaign-1', status: 'DRAFT', market_scope: null }] }
      if (sql.includes('DELETE FROM promotion_campaign_products')) return { rows: [] }
      if (sql.includes('SELECT name, slug, sale_price, base_price FROM products')) {
        if (params?.[0] === 'product-real') {
          return { rows: [{ name: 'Cordless Drill', slug: 'cordless-drill', sale_price: null, base_price: '129.99' }] }
        }
        return { rows: [] }
      }
      if (sql.includes('SELECT image_url FROM product_images')) return { rows: [{ image_url: 'https://cdn.example.com/drill.webp' }] }
      if (sql.includes('INSERT INTO promotion_campaign_products')) return { rows: [] }
      if (sql.includes('INSERT INTO promotion_activity_log')) return { rows: [] }
      if (sql.includes('SELECT * FROM promotion_campaigns WHERE id')) return { rows: [{ id: 'campaign-1', creative_assets: [] }] }
      return { rows: [] }
    })
    const req: any = makeReq({
      params: { id: 'campaign-1' },
      body: { products: [{ productId: 'product-real' }, { productId: 'product-deleted' }] },
    })
    const res = makeRes()

    await updateCampaign(req, res)

    const insertCalls = mockQuery.mock.calls.filter((c: any[]) => c[0].includes('INSERT INTO promotion_campaign_products'))
    expect(insertCalls).toHaveLength(1) // the nonexistent product was silently skipped, not inserted
    expect(insertCalls[0][1]).toEqual(['campaign-1', 'product-real', 0, 'Cordless Drill', 'cordless-drill', '129.99', 'https://cdn.example.com/drill.webp'])
  })
})

describe('scheduleCampaign / publishCampaignNow / cancelCampaign -- lifecycle guards', () => {
  beforeEach(() => jest.clearAllMocks())

  it('rejects scheduling a campaign that has already started publishing', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'c1', campaign_key: 'k', landing_url: null, status: 'PUBLISHING', market_scope: null }] })
    const req: any = makeReq({ params: { id: 'c1' }, body: { scheduledAt: '2026-09-01T10:00:00.000Z' } })
    const res = makeRes()

    await scheduleCampaign(req, res)

    expect(res.status).toHaveBeenCalledWith(409)
  })

  it('rejects an invalid scheduledAt value', async () => {
    const req: any = makeReq({ params: { id: 'c1' }, body: { scheduledAt: 'not-a-date' } })
    const res = makeRes()

    await scheduleCampaign(req, res)

    expect(res.status).toHaveBeenCalledWith(400)
    expect(mockQuery).not.toHaveBeenCalled()
  })

  it('publishCampaignNow rejects a campaign with zero selected channels', async () => {
    mockQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('SELECT id, campaign_key, landing_url, status, market_scope FROM promotion_campaigns')) {
        return { rows: [{ id: 'c1', campaign_key: 'k', landing_url: null, status: 'DRAFT', market_scope: null }] }
      }
      if (sql.includes('SELECT COUNT(*) as count FROM promotion_channel_posts')) return { rows: [{ count: '0' }] }
      return { rows: [] }
    })
    const req: any = makeReq({ params: { id: 'c1' } })
    const res = makeRes()

    await publishCampaignNow(req, res)

    expect(res.status).toHaveBeenCalledWith(400)
  })

  it('publishCampaignNow flips channel posts straight to QUEUED and the campaign to PUBLISHING, returning 202 without waiting on any adapter call', async () => {
    mockQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('SELECT id, campaign_key, landing_url, status, market_scope FROM promotion_campaigns')) {
        return { rows: [{ id: 'c1', campaign_key: 'summer-sale-abc', landing_url: 'https://techtoolstore.com/p/drill', status: 'DRAFT', market_scope: null }] }
      }
      if (sql.includes('SELECT COUNT(*) as count FROM promotion_channel_posts')) return { rows: [{ count: '2' }] }
      if (sql.includes('SELECT id, channel FROM promotion_channel_posts')) {
        return { rows: [{ id: 'post-1', channel: 'FACEBOOK' }, { id: 'post-2', channel: 'X' }] }
      }
      return { rows: [] }
    })
    const req: any = makeReq({ params: { id: 'c1' } })
    const res = makeRes()

    await publishCampaignNow(req, res)

    expect(res.status).toHaveBeenCalledWith(202)
    const queueUpdate = mockQuery.mock.calls.find((c: any[]) => c[0].includes("SET status = 'QUEUED', queued_at = now()"))
    expect(queueUpdate).toBeDefined()
    const campaignUpdate = mockQuery.mock.calls.find((c: any[]) => c[0].includes("SET status = 'PUBLISHING'"))
    expect(campaignUpdate).toBeDefined()
    // link_url must carry real per-channel UTM tagging, not the bare landing URL.
    const linkUpdate = mockQuery.mock.calls.find((c: any[]) => c[0].includes('SET link_url = $2'))
    expect(linkUpdate![1][1]).toContain('utm_source=facebook')
  })

  it('cancelCampaign refuses to cancel a campaign that already started publishing', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'c1', status: 'PARTIAL_SUCCESS', market_scope: null }] })
    const req: any = makeReq({ params: { id: 'c1' } })
    const res = makeRes()

    await cancelCampaign(req, res)

    expect(res.status).toHaveBeenCalledWith(409)
  })

  it('cancelCampaign cancels a DRAFT campaign and its non-terminal channel posts', async () => {
    mockQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('SELECT id, status, market_scope FROM promotion_campaigns')) return { rows: [{ id: 'c1', status: 'DRAFT', market_scope: null }] }
      return { rows: [] }
    })
    const req: any = makeReq({ params: { id: 'c1' } })
    const res = makeRes()

    await cancelCampaign(req, res)

    expect(res.status).not.toHaveBeenCalledWith(409)
    const campaignCancel = mockQuery.mock.calls.find((c: any[]) => c[0].includes("SET status = 'CANCELLED'") && c[0].includes('promotion_campaigns'))
    expect(campaignCancel).toBeDefined()
  })

  it('404s (IDOR guard) when a scoped caller tries to cancel a campaign outside their market', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'c1', status: 'DRAFT', market_scope: ['GH'] }] })
    const req: any = scopedMarketingManagerReq({ params: { id: 'c1' } })
    const res = makeRes()

    await cancelCampaign(req, res)

    expect(res.status).toHaveBeenCalledWith(404)
  })
})

describe('getCampaign', () => {
  beforeEach(() => jest.clearAllMocks())

  it('404s for a nonexistent campaign', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] })
    const req: any = makeReq({ params: { id: 'missing' } })
    const res = makeRes()

    await getCampaign(req, res)

    expect(res.status).toHaveBeenCalledWith(404)
  })

  it('404s (never 403 -- does not confirm existence) for a campaign that exists but is outside the caller\'s market scope', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'campaign-1', market_scope: ['DE'] }] })
    const req: any = scopedMarketingManagerReq({ params: { id: 'campaign-1' } })
    const res = makeRes()

    await getCampaign(req, res)

    expect(res.status).toHaveBeenCalledWith(404)
  })

  it('allows a scoped caller to fetch a campaign whose market_scope overlaps their own', async () => {
    mockQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('SELECT id, market_scope FROM promotion_campaigns')) return { rows: [{ id: 'campaign-1', market_scope: ['CM'] }] }
      if (sql.includes('SELECT * FROM promotion_campaigns WHERE id')) return { rows: [{ id: 'campaign-1', creative_assets: [] }] }
      return { rows: [] }
    })
    const req: any = scopedMarketingManagerReq({ params: { id: 'campaign-1' } })
    const res = makeRes()

    await getCampaign(req, res)

    expect(res.status).not.toHaveBeenCalledWith(404)
  })
})
