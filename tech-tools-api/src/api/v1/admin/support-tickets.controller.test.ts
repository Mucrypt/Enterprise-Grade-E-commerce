import {
  assignAdminTicket,
  getAdminTicket,
  getAdminTickets,
  replyToAdminTicket,
  updateAdminTicketStatus,
} from './support-tickets.controller'
import * as sellerSupportService from '../../../services/seller-support.service'

jest.mock('../../../services/seller-support.service', () => ({
  listForAdmin: jest.fn(),
  getTicketWithMessages: jest.fn(),
  addMessage: jest.fn(),
  assignTicket: jest.fn(),
  updateStatus: jest.fn(),
}))
jest.mock('../../../utils/logger', () => ({
  __esModule: true,
  default: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}))

const mockListForAdmin = sellerSupportService.listForAdmin as jest.Mock
const mockGetTicketWithMessages = sellerSupportService.getTicketWithMessages as jest.Mock
const mockAddMessage = sellerSupportService.addMessage as jest.Mock
const mockAssignTicket = sellerSupportService.assignTicket as jest.Mock
const mockUpdateStatus = sellerSupportService.updateStatus as jest.Mock

const makeRes = () => {
  const res: any = {}
  res.status = jest.fn(() => res)
  res.json = jest.fn(() => res)
  return res
}

describe('admin support-tickets controller', () => {
  beforeEach(() => jest.clearAllMocks())

  it('getAdminTickets ignores an invalid status filter rather than erroring', async () => {
    mockListForAdmin.mockResolvedValue({ items: [], page: 1, total: 0 })

    const req: any = { query: { status: 'not-a-real-status' } }
    const res = makeRes()

    await getAdminTickets(req, res)

    expect(mockListForAdmin).toHaveBeenCalledWith(expect.objectContaining({ status: undefined }))
  })

  it('getAdminTicket includes internal notes (staff can see them, unlike the seller-facing endpoint)', async () => {
    mockGetTicketWithMessages.mockResolvedValue({
      ticket: { id: 't1' },
      messages: [{ id: 'm1', is_internal_note: true }],
    })

    const req: any = { params: { id: 't1' } }
    const res = makeRes()

    await getAdminTicket(req, res)

    expect(mockGetTicketWithMessages).toHaveBeenCalledWith('t1', { includeInternal: true })
  })

  it('replyToAdminTicket 400s on an empty body before calling the service', async () => {
    mockGetTicketWithMessages.mockResolvedValue({ ticket: { id: 't1' }, messages: [] })

    const req: any = { user: { userId: 'staff-1' }, params: { id: 't1' }, body: { body: '' } }
    const res = makeRes()

    await replyToAdminTicket(req, res)

    expect(res.status).toHaveBeenCalledWith(400)
    expect(mockAddMessage).not.toHaveBeenCalled()
  })

  it('replyToAdminTicket 404s for a nonexistent ticket', async () => {
    mockGetTicketWithMessages.mockResolvedValue(null)

    const req: any = { user: { userId: 'staff-1' }, params: { id: 'missing' }, body: { body: 'hi' } }
    const res = makeRes()

    await replyToAdminTicket(req, res)

    expect(res.status).toHaveBeenCalledWith(404)
  })

  it('replyToAdminTicket passes isInternalNote through to the service, defaulting to false', async () => {
    mockGetTicketWithMessages.mockResolvedValue({ ticket: { id: 't1' }, messages: [] })
    mockAddMessage.mockResolvedValue({ id: 'm1' })

    const req: any = { user: { userId: 'staff-1' }, params: { id: 't1' }, body: { body: 'reply text' } }
    const res = makeRes()

    await replyToAdminTicket(req, res)

    expect(mockAddMessage).toHaveBeenCalledWith(
      expect.objectContaining({ senderType: 'staff', senderUserId: 'staff-1', isInternalNote: false }),
    )
    expect(res.status).toHaveBeenCalledWith(201)
  })

  it('assignAdminTicket 404s when the ticket does not exist', async () => {
    mockAssignTicket.mockResolvedValue(null)

    const req: any = { params: { id: 'missing' }, body: { userId: 'staff-2' } }
    const res = makeRes()

    await assignAdminTicket(req, res)

    expect(res.status).toHaveBeenCalledWith(404)
  })

  it('updateAdminTicketStatus rejects an invalid status with 400', async () => {
    const req: any = { params: { id: 't1' }, body: { status: 'archived' } }
    const res = makeRes()

    await updateAdminTicketStatus(req, res)

    expect(res.status).toHaveBeenCalledWith(400)
    expect(mockUpdateStatus).not.toHaveBeenCalled()
  })

  it('updateAdminTicketStatus updates a valid status', async () => {
    mockUpdateStatus.mockResolvedValue({ id: 't1', status: 'resolved' })

    const req: any = { params: { id: 't1' }, body: { status: 'resolved' } }
    const res = makeRes()

    await updateAdminTicketStatus(req, res)

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, data: { ticket: { id: 't1', status: 'resolved' } } }),
    )
  })
})
