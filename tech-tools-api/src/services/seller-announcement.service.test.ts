import { createAnnouncement, listForAdmin, listForSeller, markRead } from './seller-announcement.service'
import { query } from '../database/connection'

jest.mock('../database/connection', () => ({ query: jest.fn() }))

const mockQuery = query as jest.Mock

describe('seller-announcement.service -- one-to-many broadcast, real per-seller read tracking', () => {
  beforeEach(() => jest.clearAllMocks())

  it('createAnnouncement stores a null target_tier for an invalid/missing tier -- means "every seller", not silently dropped', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'a1', target_tier: null }] })

    await createAnnouncement({ subject: 'Policy update', body: 'New rules', targetTier: 'not-a-real-tier', createdByAdminId: 'admin-1' })

    const insertCall = mockQuery.mock.calls.find((c: any[]) => c[0].includes('INSERT INTO seller_announcements'))
    expect(insertCall![1]).toEqual(['Policy update', 'New rules', null, 'admin-1'])
  })

  it('createAnnouncement preserves a valid target_tier', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'a1', target_tier: 'pro' }] })

    await createAnnouncement({ subject: 'Pro perk', body: 'New pro benefit', targetTier: 'pro', createdByAdminId: 'admin-1' })

    const insertCall = mockQuery.mock.calls.find((c: any[]) => c[0].includes('INSERT INTO seller_announcements'))
    expect(insertCall![1]).toEqual(['Pro perk', 'New pro benefit', 'pro', 'admin-1'])
  })

  it('listForAdmin computes real readCount/totalRecipients via subqueries, not a fabricated "sent" status', async () => {
    mockQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('SELECT\n         sa.*') || sql.includes('SELECT sa.*') || sql.includes('"readCount"'))
        return { rows: [{ id: 'a1', readCount: 3, totalRecipients: 10 }] }
      if (sql.includes('SELECT COUNT(*)::int AS total FROM seller_announcements')) return { rows: [{ total: 1 }] }
      return { rows: [] }
    })

    const result = await listForAdmin({ page: 1, limit: 20 })

    expect(result.items).toEqual([{ id: 'a1', readCount: 3, totalRecipients: 10 }])
    expect(result.total).toBe(1)
  })

  it('listForSeller returns announcements targeted at "everyone" or the seller\'s own tier only', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'a1', isRead: false }] })

    await listForSeller('sp-1', 'trusted')

    const call = mockQuery.mock.calls[0]
    expect(call[0]).toContain('sa.target_tier IS NULL OR sa.target_tier = $2')
    expect(call[1]).toEqual(['sp-1', 'trusted'])
  })

  it('markRead is idempotent -- a second read from the same seller does not error or duplicate (ON CONFLICT DO NOTHING)', async () => {
    mockQuery.mockResolvedValue({ rows: [] })

    await markRead('a1', 'sp-1')
    await markRead('a1', 'sp-1')

    expect(mockQuery).toHaveBeenCalledTimes(2)
    const call = mockQuery.mock.calls[0]
    expect(call[0]).toContain('ON CONFLICT (announcement_id, seller_profile_id) DO NOTHING')
    expect(call[1]).toEqual(['a1', 'sp-1'])
  })
})
