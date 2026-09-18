import { createMyTicket, getMyTicket, getMyTickets, replyToMyTicket } from './seller-support.controller'
import * as sellerSupportService from '../../../services/seller-support.service'

jest.mock('../../../services/seller-support.service', () => ({
  createTicket: jest.fn(),
  listForSeller: jest.fn(),
  getTicketWithMessages: jest.fn(),
  addMessage: jest.fn(),
}))
jest.mock('../../../utils/logger', () => ({
  __esModule: true,
  default: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}))

const mockCreateTicket = sellerSupportService.createTicket as jest.Mock
const mockListForSeller = sellerSupportService.listForSeller as jest.Mock
const mockGetTicketWithMessages = sellerSupportService.getTicketWithMessages as jest.Mock
const mockAddMessage = sellerSupportService.addMessage as jest.Mock

const makeRes = () => {
  const res: any = {}
  res.status = jest.fn(() => res)
  res.json = jest.fn(() => res)
  return res
}

describe('seller-support.controller -- guarded exactly like seller-earnings/seller-product controllers', () => {
  beforeEach(() => jest.clearAllMocks())

  it('every endpoint 403s without a sellerProfileId', async () => {
    const res1 = makeRes()
    await createMyTicket({ user: { userId: 'u1' }, body: {} } as any, res1)
    expect(res1.status).toHaveBeenCalledWith(403)

    const res2 = makeRes()
    await getMyTickets({ user: { userId: 'u1' }, query: {} } as any, res2)
    expect(res2.status).toHaveBeenCalledWith(403)

    const res3 = makeRes()
    await getMyTicket({ user: { userId: 'u1' }, params: { id: 't1' } } as any, res3)
    expect(res3.status).toHaveBeenCalledWith(403)

    const res4 = makeRes()
    await replyToMyTicket({ user: { userId: 'u1' }, params: { id: 't1' }, body: {} } as any, res4)
    expect(res4.status).toHaveBeenCalledWith(403)

    expect(mockCreateTicket).not.toHaveBeenCalled()
    expect(mockListForSeller).not.toHaveBeenCalled()
  })

  it('getMyTicket 404s when the ticket belongs to a different seller -- never leaks another seller\'s thread', async () => {
    mockGetTicketWithMessages.mockResolvedValue({
      ticket: { id: 't1', seller_profile_id: 'someone-elses-seller' },
      messages: [],
    })

    const req: any = { sellerProfileId: 'sp-1', params: { id: 't1' } }
    const res = makeRes()

    await getMyTicket(req, res)

    expect(res.status).toHaveBeenCalledWith(404)
  })

  it('getMyTicket returns the thread when the seller owns it', async () => {
    mockGetTicketWithMessages.mockResolvedValue({
      ticket: { id: 't1', seller_profile_id: 'sp-1' },
      messages: [{ id: 'm1', body: 'hi' }],
    })

    const req: any = { sellerProfileId: 'sp-1', params: { id: 't1' } }
    const res = makeRes()

    await getMyTicket(req, res)

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, data: expect.objectContaining({ messages: [{ id: 'm1', body: 'hi' }] }) }),
    )
  })

  it('replyToMyTicket 404s when attempting to reply to another seller\'s ticket, even with a well-formed body', async () => {
    mockGetTicketWithMessages.mockResolvedValue({
      ticket: { id: 't1', seller_profile_id: 'someone-elses-seller' },
      messages: [],
    })

    const req: any = { sellerProfileId: 'sp-1', user: { userId: 'u1' }, params: { id: 't1' }, body: { body: 'let me in' } }
    const res = makeRes()

    await replyToMyTicket(req, res)

    expect(res.status).toHaveBeenCalledWith(404)
    expect(mockAddMessage).not.toHaveBeenCalled()
  })

  it('createMyTicket 400s on an empty subject or body before calling the service', async () => {
    const req: any = { sellerProfileId: 'sp-1', user: { userId: 'u1' }, body: { subject: '  ', body: 'hello' } }
    const res = makeRes()

    await createMyTicket(req, res)

    expect(res.status).toHaveBeenCalledWith(400)
    expect(mockCreateTicket).not.toHaveBeenCalled()
  })

  it('createMyTicket creates a ticket scoped to the caller\'s own seller profile', async () => {
    mockCreateTicket.mockResolvedValue({ ticket: { id: 't1' }, message: { id: 'm1' } })

    const req: any = {
      sellerProfileId: 'sp-1',
      user: { userId: 'u1' },
      body: { subject: 'Payout question', category: 'payouts', body: 'Where is my money?' },
    }
    const res = makeRes()

    await createMyTicket(req, res)

    expect(mockCreateTicket).toHaveBeenCalledWith(
      expect.objectContaining({ sellerProfileId: 'sp-1', userId: 'u1' }),
    )
    expect(res.status).toHaveBeenCalledWith(201)
  })
})
