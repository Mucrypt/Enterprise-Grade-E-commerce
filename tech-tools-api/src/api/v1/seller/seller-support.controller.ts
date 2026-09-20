import { Response } from 'express'
import { SellerAuthRequest } from '../../../middleware/seller-auth'
import {
  addMessage,
  createTicket,
  getTicketWithMessages,
  listForSeller,
} from '../../../services/seller-support.service'
import logger from '../../../utils/logger'

// =====================================================
// A seller's own support tickets -- real threaded conversation with
// admin staff. Guarded by requireSellerProfile (not
// requireAdminOrOnboardedSeller) -- an unverified/pending seller can
// still reach support, since that's exactly when they most need to.
// =====================================================

export const createMyTicket = async (req: SellerAuthRequest, res: Response) => {
  try {
    if (!req.sellerProfileId) {
      return res.status(403).json({ success: false, message: 'Only sellers have support tickets here' })
    }

    const { subject, category, body } = req.body
    if (!subject || !String(subject).trim()) {
      return res.status(400).json({ success: false, message: 'Subject is required' })
    }
    if (!body || !String(body).trim()) {
      return res.status(400).json({ success: false, message: 'Message is required' })
    }

    const result = await createTicket({
      sellerProfileId: req.sellerProfileId,
      userId: req.user!.userId,
      subject,
      category,
      body,
    })

    res.status(201).json({ success: true, data: result })
  } catch (error: any) {
    logger.error('Error creating support ticket:', error)
    res.status(500).json({ success: false, message: 'Failed to create support ticket', error: error.message })
  }
}

export const getMyTickets = async (req: SellerAuthRequest, res: Response) => {
  try {
    if (!req.sellerProfileId) {
      return res.status(403).json({ success: false, message: 'Only sellers have support tickets here' })
    }

    const page = Math.max(parseInt(String(req.query.page || '1'), 10), 1)
    const limit = Math.min(parseInt(String(req.query.limit || '20'), 10), 50)
    const result = await listForSeller(req.sellerProfileId, { page, limit })

    res.json({ success: true, data: result })
  } catch (error: any) {
    logger.error('Error fetching seller support tickets:', error)
    res.status(500).json({ success: false, message: 'Failed to fetch support tickets', error: error.message })
  }
}

export const getMyTicket = async (req: SellerAuthRequest, res: Response) => {
  try {
    if (!req.sellerProfileId) {
      return res.status(403).json({ success: false, message: 'Only sellers have support tickets here' })
    }

    const result = await getTicketWithMessages(req.params.id)
    if (!result || result.ticket.seller_profile_id !== req.sellerProfileId) {
      return res.status(404).json({ success: false, message: 'Ticket not found' })
    }

    res.json({ success: true, data: result })
  } catch (error: any) {
    logger.error('Error fetching seller support ticket:', error)
    res.status(500).json({ success: false, message: 'Failed to fetch support ticket', error: error.message })
  }
}

export const replyToMyTicket = async (req: SellerAuthRequest, res: Response) => {
  try {
    if (!req.sellerProfileId) {
      return res.status(403).json({ success: false, message: 'Only sellers have support tickets here' })
    }

    const existing = await getTicketWithMessages(req.params.id)
    if (!existing || existing.ticket.seller_profile_id !== req.sellerProfileId) {
      return res.status(404).json({ success: false, message: 'Ticket not found' })
    }

    const { body } = req.body
    if (!body || !String(body).trim()) {
      return res.status(400).json({ success: false, message: 'Message is required' })
    }

    const message = await addMessage({
      ticketId: req.params.id,
      senderType: 'seller',
      senderUserId: req.user!.userId,
      body,
    })

    res.status(201).json({ success: true, data: { message } })
  } catch (error: any) {
    logger.error('Error replying to seller support ticket:', error)
    res.status(500).json({ success: false, message: 'Failed to send message', error: error.message })
  }
}
