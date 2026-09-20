// Seller support ticketing -- a real threaded conversation between a
// seller and admin staff. See 072_seller_support_tickets.sql for the
// schema and rationale (deliberately separate from the existing
// customer /contact flow, which is just rows in email_messages with no
// real thread/status/assignment model).
//
// Notification behavior deliberately closes a real gap: the existing
// contact-form flow's NotificationEvents only ever queries
// `users.user_type IN ('admin','super_admin')`, so a real SUPPORT_AGENT
// hire (a customer-typed user holding a staff_memberships row) would
// never be notified. This service also notifies active staff_memberships
// holders whose role grants 'support.manage', via roleHasPermission().

import { query } from '../database/connection'
import emailService from './email.service'
import { NotificationService } from './notification.service'
import { roleHasPermission, type StaffRole } from '../config/staff-permissions.config'
import logger from '../utils/logger'

export interface SupportTicket {
  id: string
  seller_profile_id: string
  user_id: string
  subject: string
  category: string
  status: string
  priority: string
  assigned_to_user_id: string | null
  created_at: string
  updated_at: string
  last_message_at: string
  resolved_at: string | null
}

export interface SupportMessage {
  id: string
  ticket_id: string
  sender_type: 'seller' | 'staff'
  sender_user_id: string
  body: string
  is_internal_note: boolean
  created_at: string
}

const CATEGORIES = ['payouts', 'verification', 'product_listing', 'technical', 'other']

export async function createTicket(params: {
  sellerProfileId: string
  // The seller's own user id -- always identifies whose ticket this is,
  // regardless of who sent the first message (see openedBy below).
  userId: string
  subject: string
  category?: string
  body: string
  // Who is actually sending the first message. Defaults to the seller
  // themselves (the original, seller-only-initiated behavior) -- admin
  // routes pass { userId: adminId, senderType: 'staff' } to open a
  // ticket proactively on a seller's behalf.
  openedBy?: { userId: string; senderType: 'seller' | 'staff' }
}): Promise<{ ticket: SupportTicket; message: SupportMessage }> {
  const category = CATEGORIES.includes(params.category || '') ? params.category! : 'other'
  const openedBy = params.openedBy || { userId: params.userId, senderType: 'seller' as const }

  const ticketResult = await query(
    `INSERT INTO support_tickets (seller_profile_id, user_id, subject, category)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [params.sellerProfileId, params.userId, params.subject.trim(), category],
  )
  const ticket = ticketResult.rows[0] as SupportTicket

  const messageResult = await query(
    `INSERT INTO support_messages (ticket_id, sender_type, sender_user_id, body)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [ticket.id, openedBy.senderType, openedBy.userId, params.body.trim()],
  )
  const message = messageResult.rows[0] as SupportMessage

  if (openedBy.senderType === 'staff') {
    await notifyNewTicketToSeller(ticket, message).catch((error) =>
      logger.warn('Failed to notify seller of new admin-opened support ticket:', error),
    )
  } else {
    await notifyStaffOfActivity(ticket, 'created').catch((error) =>
      logger.warn('Failed to notify staff of new support ticket:', error),
    )
  }

  return { ticket, message }
}

export async function addMessage(params: {
  ticketId: string
  senderType: 'seller' | 'staff'
  senderUserId: string
  body: string
  isInternalNote?: boolean
}): Promise<SupportMessage> {
  const ticketResult = await query(`SELECT * FROM support_tickets WHERE id = $1 LIMIT 1`, [
    params.ticketId,
  ])
  const ticket = ticketResult.rows[0] as SupportTicket | undefined
  if (!ticket) {
    throw new Error('Ticket not found')
  }

  const isInternalNote = Boolean(params.isInternalNote) && params.senderType === 'staff'

  const messageResult = await query(
    `INSERT INTO support_messages (ticket_id, sender_type, sender_user_id, body, is_internal_note)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [params.ticketId, params.senderType, params.senderUserId, params.body.trim(), isInternalNote],
  )
  const message = messageResult.rows[0] as SupportMessage

  // A seller reply reopens a resolved ticket; a staff reply on a brand
  // new ticket moves it into progress. Internal notes never change
  // status -- they're not seller-visible activity.
  let nextStatus = ticket.status
  if (!isInternalNote) {
    if (params.senderType === 'seller' && ticket.status === 'resolved') {
      nextStatus = 'open'
    } else if (params.senderType === 'staff' && ticket.status === 'open') {
      nextStatus = 'in_progress'
    }
  }

  await query(
    `UPDATE support_tickets
     SET last_message_at = CURRENT_TIMESTAMP,
         updated_at = CURRENT_TIMESTAMP,
         status = $1
     WHERE id = $2`,
    [nextStatus, params.ticketId],
  )

  if (!isInternalNote) {
    await notifySingleReply(ticket, message).catch((error) =>
      logger.warn('Failed to notify of support ticket reply:', error),
    )
  }

  return message
}

export async function listForSeller(
  sellerProfileId: string,
  { page = 1, limit = 20 }: { page?: number; limit?: number } = {},
): Promise<{ items: SupportTicket[]; page: number; hasMore: boolean }> {
  const offset = (page - 1) * limit
  const result = await query(
    `SELECT * FROM support_tickets
     WHERE seller_profile_id = $1
     ORDER BY last_message_at DESC
     LIMIT $2 OFFSET $3`,
    [sellerProfileId, limit + 1, offset],
  )
  const items = result.rows as SupportTicket[]
  return { items: items.slice(0, limit), page, hasMore: items.length > limit }
}

export async function listForAdmin(params: {
  page?: number
  limit?: number
  status?: string
  assignedToUserId?: string
  category?: string
  search?: string
}): Promise<{ items: (SupportTicket & { seller_display_name: string | null; seller_handle: string | null })[]; page: number; total: number }> {
  const page = Math.max(params.page || 1, 1)
  const limit = Math.min(Math.max(params.limit || 25, 1), 100)
  const offset = (page - 1) * limit

  const conditions: string[] = []
  const values: unknown[] = []

  if (params.status) {
    values.push(params.status)
    conditions.push(`st.status = $${values.length}`)
  }
  if (params.assignedToUserId) {
    values.push(params.assignedToUserId)
    conditions.push(`st.assigned_to_user_id = $${values.length}`)
  }
  if (params.category) {
    values.push(params.category)
    conditions.push(`st.category = $${values.length}`)
  }
  if (params.search) {
    values.push(`%${params.search}%`)
    const idx = values.length
    conditions.push(`(sp.display_name ILIKE $${idx} OR sp.handle ILIKE $${idx} OR st.subject ILIKE $${idx})`)
  }
  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''

  const [itemsResult, totalResult] = await Promise.all([
    query(
      `SELECT st.*, sp.display_name AS seller_display_name, sp.handle AS seller_handle
       FROM support_tickets st
       INNER JOIN seller_profiles sp ON sp.id = st.seller_profile_id
       ${whereClause}
       ORDER BY st.last_message_at DESC
       LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
      [...values, limit, offset],
    ),
    query(
      `SELECT COUNT(*)::int AS total
       FROM support_tickets st
       INNER JOIN seller_profiles sp ON sp.id = st.seller_profile_id
       ${whereClause}`,
      values,
    ),
  ])

  return { items: itemsResult.rows, page, total: totalResult.rows[0]?.total || 0 }
}

export async function getTicketWithMessages(
  ticketId: string,
  { includeInternal = false }: { includeInternal?: boolean } = {},
): Promise<{ ticket: SupportTicket; messages: SupportMessage[] } | null> {
  const ticketResult = await query(`SELECT * FROM support_tickets WHERE id = $1 LIMIT 1`, [ticketId])
  const ticket = ticketResult.rows[0] as SupportTicket | undefined
  if (!ticket) return null

  const messagesResult = await query(
    `SELECT * FROM support_messages
     WHERE ticket_id = $1 ${includeInternal ? '' : 'AND is_internal_note = false'}
     ORDER BY created_at ASC`,
    [ticketId],
  )

  return { ticket, messages: messagesResult.rows }
}

export async function assignTicket(ticketId: string, userId: string | null): Promise<SupportTicket | null> {
  const result = await query(
    `UPDATE support_tickets SET assigned_to_user_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *`,
    [userId, ticketId],
  )
  return result.rows[0] || null
}

export async function updateStatus(ticketId: string, status: string): Promise<SupportTicket | null> {
  const result = await query(
    `UPDATE support_tickets
     SET status = $1,
         updated_at = CURRENT_TIMESTAMP,
         resolved_at = CASE WHEN $1 = 'resolved' THEN CURRENT_TIMESTAMP ELSE resolved_at END
     WHERE id = $2
     RETURNING *`,
    [status, ticketId],
  )
  return result.rows[0] || null
}

export interface SupportReportingSummary {
  byStatus: { status: string; count: number }[]
  byCategory: { category: string; count: number }[]
  // Hours, averaged only over tickets that HAVE received a staff reply --
  // a ticket still waiting is never counted as "0 hours," which would
  // dishonestly understate real response time.
  averageFirstReplyHours: number | null
  // Current workload snapshot (open/in_progress only) -- not date-ranged,
  // since "who's carrying what right now" is a present-tense question.
  ticketsPerStaffMember: { userId: string; name: string; count: number }[]
}

export async function getSupportReportingSummary(params: {
  from: Date
  to: Date
}): Promise<SupportReportingSummary> {
  const [byStatusResult, byCategoryResult, firstReplyResult, staffLoadResult] = await Promise.all([
    query(
      `SELECT status, COUNT(*)::int AS count
       FROM support_tickets
       WHERE created_at BETWEEN $1 AND $2
       GROUP BY status`,
      [params.from, params.to],
    ),
    query(
      `SELECT category, COUNT(*)::int AS count
       FROM support_tickets
       WHERE created_at BETWEEN $1 AND $2
       GROUP BY category`,
      [params.from, params.to],
    ),
    query(
      `SELECT AVG(EXTRACT(EPOCH FROM (first_reply.first_staff_reply_at - st.created_at)) / 3600)::float AS avg_hours
       FROM support_tickets st
       INNER JOIN (
         SELECT ticket_id, MIN(created_at) AS first_staff_reply_at
         FROM support_messages
         WHERE sender_type = 'staff' AND is_internal_note = false
         GROUP BY ticket_id
       ) first_reply ON first_reply.ticket_id = st.id
       WHERE st.created_at BETWEEN $1 AND $2`,
      [params.from, params.to],
    ),
    query(
      `SELECT st.assigned_to_user_id AS "userId", u.first_name, u.last_name, u.email, COUNT(*)::int AS count
       FROM support_tickets st
       INNER JOIN users u ON u.id = st.assigned_to_user_id
       WHERE st.status IN ('open', 'in_progress')
       GROUP BY st.assigned_to_user_id, u.first_name, u.last_name, u.email
       ORDER BY count DESC`,
    ),
  ])

  return {
    byStatus: byStatusResult.rows,
    byCategory: byCategoryResult.rows,
    averageFirstReplyHours: firstReplyResult.rows[0]?.avg_hours ?? null,
    ticketsPerStaffMember: staffLoadResult.rows.map((row: any) => ({
      userId: row.userId,
      name: `${row.first_name || ''} ${row.last_name || ''}`.trim() || row.email,
      count: row.count,
    })),
  }
}

// ============================================
// Notifications
// ============================================

async function getSupportStaff(): Promise<{ user_id: string; email: string; first_name: string | null }[]> {
  const result = await query(
    `SELECT sm.user_id, sm.role, u.email, u.first_name
     FROM staff_memberships sm
     INNER JOIN users u ON u.id = sm.user_id
     WHERE sm.status = 'ACTIVE'`,
  )
  return result.rows.filter((row: { role: StaffRole }) => roleHasPermission(row.role, 'support.manage'))
}

async function notifyStaffOfActivity(ticket: SupportTicket, event: 'created') {
  const [staff] = await Promise.all([
    getSupportStaff(),
    emailService
      .sendAdminNotification({
        subject: `New seller support ticket: ${ticket.subject}`,
        html: `<p>A seller opened a new support ticket (category: ${ticket.category}).</p>`,
      })
      .catch(() => null),
  ])

  await Promise.all(
    staff.map((member) =>
      Promise.all([
        NotificationService.create({
          userId: member.user_id,
          type: 'support_ticket_created',
          title: 'New seller support ticket',
          message: ticket.subject,
          actionUrl: `/support-tickets/${ticket.id}`,
        }).catch(() => null),
        emailService
          .sendEmail({
            to: member.email,
            toName: member.first_name || undefined,
            subject: `New seller support ticket: ${ticket.subject}`,
            html: `<p>A seller opened a new support ticket (category: ${ticket.category}).</p>`,
          })
          .catch(() => null),
      ]),
    ),
  )
}

// Shared by a staff reply on an existing ticket and a brand new
// admin-opened ticket -- from the seller's perspective both are "staff
// sent me a message," so they get the exact same notification treatment.
async function notifyStaffMessageToSeller(ticket: SupportTicket, message: SupportMessage) {
  const sellerResult = await query(`SELECT email, first_name FROM users WHERE id = $1 LIMIT 1`, [
    ticket.user_id,
  ])
  const seller = sellerResult.rows[0]
  if (!seller) return

  await Promise.all([
    NotificationService.create({
      userId: ticket.user_id,
      type: 'support_ticket_reply',
      title: 'Support replied to your ticket',
      message: ticket.subject,
      actionUrl: `/seller-center/support?ticket=${ticket.id}`,
    }).catch(() => null),
    emailService
      .sendEmail({
        to: seller.email,
        toName: seller.first_name || undefined,
        subject: `Re: ${ticket.subject}`,
        html: `<p>${message.body.replace(/\n/g, '<br/>')}</p>`,
      })
      .catch(() => null),
  ])
}

async function notifyNewTicketToSeller(ticket: SupportTicket, message: SupportMessage) {
  await notifyStaffMessageToSeller(ticket, message)
}

async function notifySingleReply(ticket: SupportTicket, message: SupportMessage) {
  if (message.sender_type === 'staff') {
    await notifyStaffMessageToSeller(ticket, message)
    return
  }

  // Seller replied -- notify the assigned staff member, or broadcast if unassigned.
  if (ticket.assigned_to_user_id) {
    const staffResult = await query(`SELECT email, first_name FROM users WHERE id = $1 LIMIT 1`, [
      ticket.assigned_to_user_id,
    ])
    const staffMember = staffResult.rows[0]
    if (staffMember) {
      await Promise.all([
        NotificationService.create({
          userId: ticket.assigned_to_user_id,
          type: 'support_ticket_reply',
          title: 'Seller replied to their ticket',
          message: ticket.subject,
          actionUrl: `/support-tickets/${ticket.id}`,
        }).catch(() => null),
        emailService
          .sendEmail({
            to: staffMember.email,
            toName: staffMember.first_name || undefined,
            subject: `Re: ${ticket.subject}`,
            html: `<p>${message.body.replace(/\n/g, '<br/>')}</p>`,
          })
          .catch(() => null),
      ])
      return
    }
  }

  await notifyStaffOfActivity(ticket, 'created')
}
