import { getMyAnnouncements, markMyAnnouncementRead } from './seller-announcements.controller'
import { query } from '../../../database/connection'
import * as announcementService from '../../../services/seller-announcement.service'

jest.mock('../../../database/connection', () => ({ query: jest.fn() }))
jest.mock('../../../services/seller-announcement.service', () => ({
  listForSeller: jest.fn(),
  markRead: jest.fn(),
}))
jest.mock('../../../utils/logger', () => ({
  __esModule: true,
  default: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}))

const mockQuery = query as jest.Mock
const mockListForSeller = announcementService.listForSeller as jest.Mock
const mockMarkRead = announcementService.markRead as jest.Mock

const makeRes = () => {
  const res: any = {}
  res.status = jest.fn(() => res)
  res.json = jest.fn(() => res)
  return res
}

describe('seller-announcements.controller -- guarded exactly like seller-support.controller', () => {
  beforeEach(() => jest.clearAllMocks())

  it('getMyAnnouncements 403s without a sellerProfileId', async () => {
    const req: any = { user: { userId: 'u1' } }
    const res = makeRes()

    await getMyAnnouncements(req, res)

    expect(res.status).toHaveBeenCalledWith(403)
    expect(mockListForSeller).not.toHaveBeenCalled()
  })

  it('markMyAnnouncementRead 403s without a sellerProfileId', async () => {
    const req: any = { user: { userId: 'u1' }, params: { id: 'a1' } }
    const res = makeRes()

    await markMyAnnouncementRead(req, res)

    expect(res.status).toHaveBeenCalledWith(403)
    expect(mockMarkRead).not.toHaveBeenCalled()
  })

  it('getMyAnnouncements looks up the seller\'s real current tier and passes it through, defaulting to unverified only if the row is missing', async () => {
    mockQuery.mockResolvedValue({ rows: [{ tier: 'trusted' }] })
    mockListForSeller.mockResolvedValue([{ id: 'a1', isRead: false }])

    const req: any = { sellerProfileId: 'sp-1' }
    const res = makeRes()

    await getMyAnnouncements(req, res)

    expect(mockListForSeller).toHaveBeenCalledWith('sp-1', 'trusted')
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, data: { items: [{ id: 'a1', isRead: false }] } }),
    )
  })

  it('markMyAnnouncementRead marks read for the caller\'s own seller profile', async () => {
    const req: any = { sellerProfileId: 'sp-1', params: { id: 'a1' } }
    const res = makeRes()

    await markMyAnnouncementRead(req, res)

    expect(mockMarkRead).toHaveBeenCalledWith('a1', 'sp-1')
    expect(res.json).toHaveBeenCalledWith({ success: true })
  })
})
