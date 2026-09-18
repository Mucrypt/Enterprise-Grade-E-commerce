import { Response } from 'express'
import { SellerAuthRequest } from '../../../middleware/seller-auth'
import { query } from '../../../database/connection'
import { listForSeller, markRead } from '../../../services/seller-announcement.service'
import logger from '../../../utils/logger'

// =====================================================
// A seller's own view of broadcast announcements -- real per-seller read
// tracking, filtered to their current tier (or announcements sent to
// every tier). Same requireSellerProfile gate as support tickets.
// =====================================================

export const getMyAnnouncements = async (req: SellerAuthRequest, res: Response) => {
  try {
    if (!req.sellerProfileId) {
      return res.status(403).json({ success: false, message: 'Only sellers have announcements here' })
    }

    const tierResult = await query(`SELECT tier FROM seller_profiles WHERE id = $1 LIMIT 1`, [
      req.sellerProfileId,
    ])
    const tier = tierResult.rows[0]?.tier || 'unverified'

    const announcements = await listForSeller(req.sellerProfileId, tier)
    res.json({ success: true, data: { items: announcements } })
  } catch (error: any) {
    logger.error('Error fetching seller announcements:', error)
    res.status(500).json({ success: false, message: 'Failed to fetch announcements', error: error.message })
  }
}

export const markMyAnnouncementRead = async (req: SellerAuthRequest, res: Response) => {
  try {
    if (!req.sellerProfileId) {
      return res.status(403).json({ success: false, message: 'Only sellers have announcements here' })
    }

    await markRead(req.params.id, req.sellerProfileId)
    res.json({ success: true })
  } catch (error: any) {
    logger.error('Error marking announcement read:', error)
    res.status(500).json({ success: false, message: 'Failed to mark announcement read', error: error.message })
  }
}
