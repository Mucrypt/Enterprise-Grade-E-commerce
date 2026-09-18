import { Response } from 'express'
import { AuthRequest } from '../../../middleware/auth'
import { createAnnouncement, listForAdmin } from '../../../services/seller-announcement.service'
import logger from '../../../utils/logger'

export const getAdminAnnouncements = async (req: AuthRequest, res: Response) => {
  try {
    const page = Math.max(Number(req.query.page) || 1, 1)
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 50)

    const result = await listForAdmin({ page, limit })
    res.json({
      success: true,
      data: {
        items: result.items,
        pagination: { page: result.page, limit, total: result.total, totalPages: Math.ceil(result.total / limit) },
      },
    })
  } catch (error) {
    logger.error('Get admin announcements error:', error)
    res.status(500).json({ success: false, error: 'Failed to load announcements' })
  }
}

export const createAdminAnnouncement = async (req: AuthRequest, res: Response) => {
  try {
    const adminId = req.user?.userId
    if (!adminId) {
      return res.status(401).json({ success: false, error: 'Authentication required' })
    }

    const { subject, body, targetTier } = req.body as { subject: string; body: string; targetTier?: string | null }
    if (!subject?.trim() || !body?.trim()) {
      return res.status(400).json({ success: false, error: 'Subject and body are required' })
    }

    const announcement = await createAnnouncement({ subject, body, targetTier, createdByAdminId: adminId })
    res.status(201).json({ success: true, data: { announcement } })
  } catch (error) {
    logger.error('Create admin announcement error:', error)
    res.status(500).json({ success: false, error: 'Failed to create announcement' })
  }
}
