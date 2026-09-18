import { createAdminAnnouncement, getAdminAnnouncements } from './announcements.controller'
import * as announcementService from '../../../services/seller-announcement.service'

jest.mock('../../../services/seller-announcement.service', () => ({
  createAnnouncement: jest.fn(),
  listForAdmin: jest.fn(),
}))
jest.mock('../../../utils/logger', () => ({
  __esModule: true,
  default: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}))

const mockCreateAnnouncement = announcementService.createAnnouncement as jest.Mock
const mockListForAdmin = announcementService.listForAdmin as jest.Mock

const makeRes = () => {
  const res: any = {}
  res.status = jest.fn(() => res)
  res.json = jest.fn(() => res)
  return res
}

describe('admin announcements controller', () => {
  beforeEach(() => jest.clearAllMocks())

  it('getAdminAnnouncements returns real read/recipient counts from the service, untouched', async () => {
    mockListForAdmin.mockResolvedValue({ items: [{ id: 'a1', readCount: 2, totalRecipients: 5 }], page: 1, total: 1 })

    const req: any = { query: {} }
    const res = makeRes()

    await getAdminAnnouncements(req, res)

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({ items: [{ id: 'a1', readCount: 2, totalRecipients: 5 }] }),
      }),
    )
  })

  it('createAdminAnnouncement 400s on an empty subject or body before calling the service', async () => {
    const req: any = { user: { userId: 'admin-1' }, body: { subject: '  ', body: 'hello' } }
    const res = makeRes()

    await createAdminAnnouncement(req, res)

    expect(res.status).toHaveBeenCalledWith(400)
    expect(mockCreateAnnouncement).not.toHaveBeenCalled()
  })

  it('createAdminAnnouncement creates the announcement under the calling admin', async () => {
    mockCreateAnnouncement.mockResolvedValue({ id: 'a1', subject: 'Policy update' })

    const req: any = {
      user: { userId: 'admin-1' },
      body: { subject: 'Policy update', body: 'New rules apply', targetTier: 'pro' },
    }
    const res = makeRes()

    await createAdminAnnouncement(req, res)

    expect(mockCreateAnnouncement).toHaveBeenCalledWith(
      expect.objectContaining({ createdByAdminId: 'admin-1', targetTier: 'pro' }),
    )
    expect(res.status).toHaveBeenCalledWith(201)
  })
})
