import { Response } from 'express'
import { AuthRequest } from '../../../middleware/auth'
import { query } from '../../../database/connection'
import {
  addMessage,
  assignTicket,
  createTicket,
  getSupportReportingSummary,
  getTicketWithMessages,
  listForAdmin,
  updateStatus,
} from '../../../services/seller-support.service'
import logger from '../../../utils/logger'

const VALID_STATUSES = ['open', 'in_progress', 'resolved', 'closed']

export const getAdminSupportReporting = async (req: AuthRequest, res: Response) => {
  try {
    const to = req.query.to ? new Date(String(req.query.to)) : new Date()
    const from = req.query.from
      ? new Date(String(req.query.from))
      : new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000)

    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      return res.status(400).json({ success: false, error: 'Invalid from/to date' })
    }

    const summary = await getSupportReportingSummary({ from, to })
    res.json({ success: true, data: summary })
  } catch (error) {
    logger.error('Get support reporting summary error:', error)
    res.status(500).json({ success: false, error: 'Failed to load support reporting' })
  }
}

// Admin proactively opening a ticket on a seller's behalf -- distinct
// from every other handler here, which acts on a ticket a seller already
// opened. Reuses createTicket's openedBy branch (see
// seller-support.service.ts), which handles notifying the seller
// exactly like a staff reply would.
export const createAdminTicket = async (req: AuthRequest, res: Response) => {
  try {
    const adminId = req.user?.userId
    if (!adminId) {
      return res.status(401).json({ success: false, error: 'Authentication required' })
    }

    const { sellerProfileId, subject, category, body } = req.body as {
      sellerProfileId: string
      subject: string
      category?: string
      body: string
    }

    const sellerResult = await query(`SELECT user_id FROM seller_profiles WHERE id = $1 LIMIT 1`, [
      sellerProfileId,
    ])
    const seller = sellerResult.rows[0]
    if (!seller) {
      return res.status(404).json({ success: false, error: 'Seller profile not found' })
    }

    const result = await createTicket({
      sellerProfileId,
      userId: seller.user_id,
      subject,
      category,
      body,
      openedBy: { userId: adminId, senderType: 'staff' },
    })

    res.status(201).json({ success: true, data: result })
  } catch (error) {
    logger.error('Create admin support ticket error:', error)
    res.status(500).json({ success: false, error: 'Failed to create support ticket' })
  }
}

export const getAdminTickets = async (req: AuthRequest, res: Response) => {
  try {
    const page = Math.max(Number(req.query.page) || 1, 1)
    const limit = Math.min(Math.max(Number(req.query.limit) || 25, 1), 100)
    const status = String(req.query.status || '')
    const assignedToUserId = String(req.query.assignedToUserId || '')
    const category = String(req.query.category || '')
    const search = String(req.query.search || '').trim()

    const result = await listForAdmin({
      page,
      limit,
      status: VALID_STATUSES.includes(status) ? status : undefined,
      assignedToUserId: assignedToUserId || undefined,
      category: category || undefined,
      search: search || undefined,
    })

    res.json({
      success: true,
      data: {
        items: result.items,
        pagination: {
          page: result.page,
          limit,
          total: result.total,
          totalPages: Math.ceil(result.total / limit),
        },
      },
    })
  } catch (error) {
    logger.error('Get admin support tickets error:', error)
    res.status(500).json({ success: false, error: 'Failed to load support tickets' })
  }
}

export const getAdminTicket = async (req: AuthRequest, res: Response) => {
  try {
    const result = await getTicketWithMessages(req.params.id, { includeInternal: true })
    if (!result) {
      return res.status(404).json({ success: false, error: 'Ticket not found' })
    }
    res.json({ success: true, data: result })
  } catch (error) {
    logger.error('Get admin support ticket error:', error)
    res.status(500).json({ success: false, error: 'Failed to load support ticket' })
  }
}

export const replyToAdminTicket = async (req: AuthRequest, res: Response) => {
  try {
    const adminId = req.user?.userId
    if (!adminId) {
      return res.status(401).json({ success: false, error: 'Authentication required' })
    }

    const existing = await getTicketWithMessages(req.params.id)
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Ticket not found' })
    }

    const { body, isInternalNote } = req.body as { body: string; isInternalNote?: boolean }
    if (!body || !String(body).trim()) {
      return res.status(400).json({ success: false, error: 'Message is required' })
    }

    const message = await addMessage({
      ticketId: req.params.id,
      senderType: 'staff',
      senderUserId: adminId,
      body,
      isInternalNote: Boolean(isInternalNote),
    })

    res.status(201).json({ success: true, data: { message } })
  } catch (error) {
    logger.error('Reply to admin support ticket error:', error)
    res.status(500).json({ success: false, error: 'Failed to send reply' })
  }
}

export const assignAdminTicket = async (req: AuthRequest, res: Response) => {
  try {
    const { userId } = req.body as { userId: string | null }
    const updated = await assignTicket(req.params.id, userId || null)
    if (!updated) {
      return res.status(404).json({ success: false, error: 'Ticket not found' })
    }
    res.json({ success: true, data: { ticket: updated } })
  } catch (error) {
    logger.error('Assign support ticket error:', error)
    res.status(500).json({ success: false, error: 'Failed to assign ticket' })
  }
}

export const updateAdminTicketStatus = async (req: AuthRequest, res: Response) => {
  try {
    const { status } = req.body as { status: string }
    if (!VALID_STATUSES.includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid status' })
    }
    const updated = await updateStatus(req.params.id, status)
    if (!updated) {
      return res.status(404).json({ success: false, error: 'Ticket not found' })
    }
    res.json({ success: true, data: { ticket: updated } })
  } catch (error) {
    logger.error('Update support ticket status error:', error)
    res.status(500).json({ success: false, error: 'Failed to update ticket status' })
  }
}
