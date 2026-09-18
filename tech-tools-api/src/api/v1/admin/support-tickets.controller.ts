import { Response } from 'express'
import { AuthRequest } from '../../../middleware/auth'
import {
  addMessage,
  assignTicket,
  getTicketWithMessages,
  listForAdmin,
  updateStatus,
} from '../../../services/seller-support.service'
import logger from '../../../utils/logger'

const VALID_STATUSES = ['open', 'in_progress', 'resolved', 'closed']

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
