jest.mock('../database/connection', () => ({ query: jest.fn() }))
jest.mock('./email.service', () => ({
  __esModule: true,
  default: {
    sendAdminNotification: jest.fn().mockResolvedValue({ success: true }),
    sendEmail: jest.fn().mockResolvedValue({ success: true }),
  },
}))
jest.mock('./notification.service', () => ({
  NotificationService: { create: jest.fn().mockResolvedValue('notif-1') },
}))
jest.mock('../utils/logger', () => ({
  __esModule: true,
  default: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}))

import { query } from '../database/connection'
import emailService from './email.service'
import { NotificationService } from './notification.service'

const mockQuery = query as jest.Mock

// jest.resetModules() between tests would otherwise leave these mock
// references pointing at a stale module instance -- load the
// service-under-test fresh each time and destructure its mocked
// dependencies from the same fresh require, matching the pattern
// established in seller-payout.service.test.ts.
const loadServiceFresh = () => {
  jest.resetModules()
  const service = require('./seller-support.service')
  const freshQuery = require('../database/connection').query as jest.Mock
  return { service, freshQuery }
}

const flush = () => new Promise((resolve) => setImmediate(resolve))

describe('seller-support.service -- real threaded seller<->staff conversation', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('createTicket inserts the ticket and its first message, then notifies staff', async () => {
    const { service, freshQuery } = loadServiceFresh()
    freshQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('INSERT INTO support_tickets'))
        return { rows: [{ id: 'ticket-1', subject: 'Payout question', category: 'payouts', status: 'open' }] }
      if (sql.includes('INSERT INTO support_messages'))
        return { rows: [{ id: 'msg-1', ticket_id: 'ticket-1', sender_type: 'seller', body: 'Hi' }] }
      if (sql.includes('FROM staff_memberships')) return { rows: [] }
      return { rows: [] }
    })

    const result = await service.createTicket({
      sellerProfileId: 'sp-1',
      userId: 'user-1',
      subject: 'Payout question',
      category: 'payouts',
      body: 'Hi',
    })
    await flush()

    expect(result.ticket.id).toBe('ticket-1')
    expect(result.message.id).toBe('msg-1')
    const insertCall = freshQuery.mock.calls.find((c: any[]) => c[0].includes('INSERT INTO support_tickets'))
    expect(insertCall![1]).toEqual(['sp-1', 'user-1', 'Payout question', 'payouts'])
  })

  it('createTicket falls back to category "other" for an invalid/missing category', async () => {
    const { service, freshQuery } = loadServiceFresh()
    freshQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('INSERT INTO support_tickets')) return { rows: [{ id: 'ticket-1' }] }
      if (sql.includes('INSERT INTO support_messages')) return { rows: [{ id: 'msg-1' }] }
      return { rows: [] }
    })

    await service.createTicket({ sellerProfileId: 'sp-1', userId: 'user-1', subject: 'x', body: 'y' })
    await flush()

    const insertCall = freshQuery.mock.calls.find((c: any[]) => c[0].includes('INSERT INTO support_tickets'))
    expect(insertCall![1][3]).toBe('other')
  })

  it('createTicket opened by admin (openedBy.senderType=staff) inserts the message as staff and notifies the seller, not the staff broadcast', async () => {
    const { service, freshQuery } = loadServiceFresh()
    const freshEmailService = require('./email.service').default
    const freshNotificationService = require('./notification.service').NotificationService
    freshQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('INSERT INTO support_tickets'))
        return { rows: [{ id: 'ticket-1', subject: 'Please update your listing', user_id: 'seller-user-1' }] }
      if (sql.includes('INSERT INTO support_messages'))
        return { rows: [{ id: 'msg-1', sender_type: 'staff', body: 'Please update your listing photos.' }] }
      if (sql.includes('SELECT email, first_name FROM users'))
        return { rows: [{ email: 'seller@example.com', first_name: 'Sam' }] }
      return { rows: [] }
    })

    const result = await service.createTicket({
      sellerProfileId: 'sp-1',
      userId: 'seller-user-1',
      subject: 'Please update your listing',
      body: 'Please update your listing photos.',
      openedBy: { userId: 'admin-1', senderType: 'staff' },
    })
    await flush()

    const messageInsertCall = freshQuery.mock.calls.find((c: any[]) => c[0].includes('INSERT INTO support_messages'))
    expect(messageInsertCall![1]).toEqual(['ticket-1', 'staff', 'admin-1', 'Please update your listing photos.'])
    expect(result.message.sender_type).toBe('staff')

    // Notifies the seller (email + in-app), not the staff-broadcast path
    // a seller-opened ticket would trigger.
    expect(freshEmailService.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'seller@example.com' }),
    )
    expect(freshNotificationService.create).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'seller-user-1' }),
    )
    expect(freshEmailService.sendAdminNotification).not.toHaveBeenCalled()
  })

  it('addMessage reopens a resolved ticket when the seller replies', async () => {
    const { service, freshQuery } = loadServiceFresh()
    freshQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('SELECT * FROM support_tickets WHERE id'))
        return { rows: [{ id: 'ticket-1', status: 'resolved', user_id: 'user-1', assigned_to_user_id: null }] }
      if (sql.includes('INSERT INTO support_messages'))
        return { rows: [{ id: 'msg-2', sender_type: 'seller', is_internal_note: false }] }
      if (sql.includes('FROM staff_memberships')) return { rows: [] }
      return { rows: [] }
    })

    await service.addMessage({ ticketId: 'ticket-1', senderType: 'seller', senderUserId: 'user-1', body: 'still broken' })
    await flush()

    const updateCall = freshQuery.mock.calls.find((c: any[]) => c[0].includes('UPDATE support_tickets'))
    expect(updateCall![1]).toEqual(['open', 'ticket-1'])
  })

  it('addMessage moves an open ticket to in_progress when staff replies, and emails the seller\'s real address', async () => {
    const { service, freshQuery } = loadServiceFresh()
    const freshEmailService = require('./email.service').default
    freshQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('SELECT * FROM support_tickets WHERE id'))
        return { rows: [{ id: 'ticket-1', status: 'open', user_id: 'seller-user-1', assigned_to_user_id: null }] }
      if (sql.includes('INSERT INTO support_messages'))
        return { rows: [{ id: 'msg-2', sender_type: 'staff', is_internal_note: false, body: 'Looking into it' }] }
      if (sql.includes('SELECT email, first_name FROM users'))
        return { rows: [{ email: 'seller@example.com', first_name: 'Sam' }] }
      return { rows: [] }
    })

    await service.addMessage({ ticketId: 'ticket-1', senderType: 'staff', senderUserId: 'staff-1', body: 'Looking into it' })
    await flush()

    const updateCall = freshQuery.mock.calls.find((c: any[]) => c[0].includes('UPDATE support_tickets'))
    expect(updateCall![1]).toEqual(['in_progress', 'ticket-1'])
    expect(freshEmailService.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'seller@example.com' }),
    )
  })

  it('an internal staff note never changes ticket status and never emails the seller', async () => {
    const { service, freshQuery } = loadServiceFresh()
    const freshEmailService = require('./email.service').default
    freshQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('SELECT * FROM support_tickets WHERE id'))
        return { rows: [{ id: 'ticket-1', status: 'open', user_id: 'seller-user-1', assigned_to_user_id: null }] }
      if (sql.includes('INSERT INTO support_messages'))
        return { rows: [{ id: 'msg-2', sender_type: 'staff', is_internal_note: true, body: 'internal-only context for the team' }] }
      return { rows: [] }
    })

    await service.addMessage({
      ticketId: 'ticket-1',
      senderType: 'staff',
      senderUserId: 'staff-1',
      body: 'internal-only context for the team',
      isInternalNote: true,
    })
    await flush()

    const updateCall = freshQuery.mock.calls.find((c: any[]) => c[0].includes('UPDATE support_tickets'))
    expect(updateCall![1]).toEqual(['open', 'ticket-1'])
    expect(freshEmailService.sendEmail).not.toHaveBeenCalled()
  })

  it('a seller reply notifies the assigned staff member directly when the ticket is assigned', async () => {
    const { service, freshQuery } = loadServiceFresh()
    const freshEmailService = require('./email.service').default
    const freshNotificationService = require('./notification.service').NotificationService
    freshQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('SELECT * FROM support_tickets WHERE id'))
        return { rows: [{ id: 'ticket-1', status: 'open', user_id: 'seller-user-1', assigned_to_user_id: 'staff-7' }] }
      if (sql.includes('INSERT INTO support_messages'))
        return { rows: [{ id: 'msg-2', sender_type: 'seller', is_internal_note: false, body: 'any update?' }] }
      if (sql.includes('SELECT email, first_name FROM users'))
        return { rows: [{ email: 'staff7@example.com', first_name: 'Robin' }] }
      return { rows: [] }
    })

    await service.addMessage({ ticketId: 'ticket-1', senderType: 'seller', senderUserId: 'seller-user-1', body: 'any update?' })
    await flush()

    expect(freshNotificationService.create).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'staff-7' }),
    )
    expect(freshEmailService.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'staff7@example.com' }),
    )
  })

  it('listForAdmin applies status/assigned/category/search filters as parameterized SQL', async () => {
    const { service, freshQuery } = loadServiceFresh()
    freshQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('SELECT st.*')) return { rows: [{ id: 'ticket-1' }] }
      if (sql.includes('SELECT COUNT(*)::int')) return { rows: [{ total: 1 }] }
      return { rows: [] }
    })

    const result = await service.listForAdmin({
      status: 'open',
      assignedToUserId: 'staff-1',
      category: 'payouts',
      search: 'jane',
    })

    expect(result.total).toBe(1)
    const listCall = freshQuery.mock.calls.find((c: any[]) => c[0].includes('SELECT st.*'))
    expect(listCall![1]).toEqual(['open', 'staff-1', 'payouts', '%jane%', 25, 0])
  })

  it('getSupportReportingSummary averages first-reply time only over tickets that HAVE a staff reply (INNER JOIN, never treats a waiting ticket as 0h)', async () => {
    const { service, freshQuery } = loadServiceFresh()
    freshQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('GROUP BY status')) return { rows: [{ status: 'open', count: 2 }] }
      if (sql.includes('GROUP BY category')) return { rows: [{ category: 'payouts', count: 2 }] }
      if (sql.includes('avg_hours')) return { rows: [{ avg_hours: 4.5 }] }
      if (sql.includes('assigned_to_user_id')) return { rows: [] }
      return { rows: [] }
    })

    const from = new Date('2026-01-01')
    const to = new Date('2026-02-01')
    const result = await service.getSupportReportingSummary({ from, to })

    expect(result.averageFirstReplyHours).toBe(4.5)
    const avgCall = freshQuery.mock.calls.find((c: any[]) => c[0].includes('avg_hours'))
    expect(avgCall![0]).toContain('INNER JOIN')
    expect(avgCall![0]).not.toContain('LEFT JOIN')
  })

  it('getSupportReportingSummary returns null (not 0) average when no ticket has ever received a staff reply', async () => {
    const { service, freshQuery } = loadServiceFresh()
    freshQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('avg_hours')) return { rows: [{ avg_hours: null }] }
      return { rows: [] }
    })

    const result = await service.getSupportReportingSummary({ from: new Date(), to: new Date() })

    expect(result.averageFirstReplyHours).toBeNull()
  })

  it('getSupportReportingSummary\'s per-staff workload only counts open/in_progress tickets, not resolved/closed ones', async () => {
    const { service, freshQuery } = loadServiceFresh()
    freshQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('assigned_to_user_id') && sql.includes("IN ('open', 'in_progress')"))
        return { rows: [{ userId: 'staff-1', first_name: 'Robin', last_name: null, email: 'r@x.com', count: 3 }] }
      return { rows: [] }
    })

    const result = await service.getSupportReportingSummary({ from: new Date(), to: new Date() })

    expect(result.ticketsPerStaffMember).toEqual([{ userId: 'staff-1', name: 'Robin', count: 3 }])
  })
})
