import { Response } from 'express'
import { query } from '../../../database/connection'
import { SellerAuthRequest } from '../../../middleware/seller-auth'
import { evaluateLiveEligibility } from '../../../services/seller-lifecycle-query.service'
import * as liveSessionService from '../../../services/live/live-session.service'
import logger from '../../../utils/logger'

const isAdmin = (req: SellerAuthRequest) =>
  req.user?.userType === 'admin' || req.user?.userType === 'super_admin'

/** True if the caller may act on this session: the owning seller, or any admin/staff. */
async function canActOnSession(req: SellerAuthRequest, sessionId: string): Promise<boolean> {
  if (isAdmin(req)) return true
  if (!req.sellerProfileId) return false
  const result = await query(`SELECT seller_profile_id FROM live_sessions WHERE id = $1 LIMIT 1`, [sessionId])
  return result.rows[0]?.seller_profile_id === req.sellerProfileId
}

/** Seller-only -- restores the "Go Live" screen's state after navigating away and back. */
export const getMyCurrentLiveSession = async (req: SellerAuthRequest, res: Response) => {
  try {
    if (!req.sellerProfileId) {
      return res.status(403).json({ success: false, message: 'Only sellers can do this' })
    }

    const session = await liveSessionService.getCurrentSessionForSeller(req.sellerProfileId)
    res.json({ success: true, data: session })
  } catch (error: any) {
    logger.error('Error fetching current live session:', error)
    res.status(500).json({ success: false, message: 'Failed to fetch current live session', error: error.message })
  }
}

export const createLiveSession = async (req: SellerAuthRequest, res: Response) => {
  try {
    if (!req.sellerProfileId) {
      return res.status(403).json({ success: false, message: 'Only sellers can create a live session' })
    }

    const eligibility = await evaluateLiveEligibility(req.sellerProfileId)
    if (!eligibility.eligible) {
      return res.status(403).json({
        success: false,
        message: 'This seller account is not yet eligible to go live',
        missing: eligibility.missing,
      })
    }

    const { title, scheduledStartAt } = req.body
    if (!title || typeof title !== 'string' || !title.trim()) {
      return res.status(400).json({ success: false, message: 'title is required' })
    }

    const session = await liveSessionService.createSession({
      sellerProfileId: req.sellerProfileId,
      title: title.trim().slice(0, 140),
      scheduledStartAt: scheduledStartAt || null,
    })

    res.status(201).json({ success: true, data: session })
  } catch (error: any) {
    logger.error('Error creating live session:', error)
    res.status(500).json({ success: false, message: 'Failed to create live session', error: error.message })
  }
}

/** Seller-only -- the stream key value, fetched fresh from AWS each call, never stored/cached here. */
export const getStreamKey = async (req: SellerAuthRequest, res: Response) => {
  try {
    const { id } = req.params
    if (!(await canActOnSession(req, id))) {
      return res.status(403).json({ success: false, message: 'Not authorized for this session' })
    }

    const streamKeyValue = await liveSessionService.getStreamKeyForSession(id)
    if (!streamKeyValue) {
      return res.status(404).json({ success: false, message: 'Live session not found' })
    }

    res.json({ success: true, data: { streamKey: streamKeyValue } })
  } catch (error: any) {
    logger.error('Error fetching live session stream key:', error)
    res.status(500).json({ success: false, message: 'Failed to fetch stream key', error: error.message })
  }
}

export const startLiveSession = async (req: SellerAuthRequest, res: Response) => {
  try {
    const { id } = req.params
    if (!(await canActOnSession(req, id))) {
      return res.status(403).json({ success: false, message: 'Not authorized for this session' })
    }

    const session = await liveSessionService.startSession(id)
    if (!session) {
      return res.status(404).json({ success: false, message: 'Live session not found or already ended' })
    }

    res.json({ success: true, data: session })
  } catch (error: any) {
    logger.error('Error starting live session:', error)
    res.status(500).json({ success: false, message: 'Failed to start live session', error: error.message })
  }
}

export const endLiveSession = async (req: SellerAuthRequest, res: Response) => {
  try {
    const { id } = req.params
    if (!(await canActOnSession(req, id))) {
      return res.status(403).json({ success: false, message: 'Not authorized for this session' })
    }

    const session = await liveSessionService.endSession(id, isAdmin(req) ? 'admin' : 'seller')
    if (!session) {
      return res.status(404).json({ success: false, message: 'Live session not found' })
    }

    res.json({ success: true, data: session })
  } catch (error: any) {
    logger.error('Error ending live session:', error)
    res.status(500).json({ success: false, message: 'Failed to end live session', error: error.message })
  }
}

/** Admin-only kill switch -- mounted separately under /admin/live, see live.routes.ts. */
export const forceEndLiveSession = async (req: SellerAuthRequest, res: Response) => {
  try {
    const { id } = req.params
    const session = await liveSessionService.endSession(id, 'admin')
    if (!session) {
      return res.status(404).json({ success: false, message: 'Live session not found' })
    }
    logger.warn(`[Live] Session ${id} force-ended by admin ${req.user?.id}`)
    res.json({ success: true, data: session })
  } catch (error: any) {
    logger.error('Error force-ending live session:', error)
    res.status(500).json({ success: false, message: 'Failed to force-end live session', error: error.message })
  }
}

export const pinLiveSessionProduct = async (req: SellerAuthRequest, res: Response) => {
  try {
    const { id } = req.params
    const { productId } = req.body
    if (!(await canActOnSession(req, id))) {
      return res.status(403).json({ success: false, message: 'Not authorized for this session' })
    }
    if (!productId) {
      return res.status(400).json({ success: false, message: 'productId is required' })
    }

    await liveSessionService.pinProduct(id, productId)
    res.json({ success: true })
  } catch (error: any) {
    logger.error('Error pinning live session product:', error)
    res.status(500).json({ success: false, message: 'Failed to pin product', error: error.message })
  }
}

export const unpinLiveSessionProduct = async (req: SellerAuthRequest, res: Response) => {
  try {
    const { id, productId } = req.params
    if (!(await canActOnSession(req, id))) {
      return res.status(403).json({ success: false, message: 'Not authorized for this session' })
    }

    await liveSessionService.unpinProduct(id, productId)
    res.json({ success: true })
  } catch (error: any) {
    logger.error('Error unpinning live session product:', error)
    res.status(500).json({ success: false, message: 'Failed to unpin product', error: error.message })
  }
}

/** Viewer-facing -- any authenticated user, not seller-only. */
export const getLiveSessionForViewer = async (req: SellerAuthRequest, res: Response) => {
  try {
    const { id } = req.params
    if (!req.user?.id) {
      return res.status(401).json({ success: false, message: 'Authentication required' })
    }

    const detail = await liveSessionService.getSessionForViewer(id, req.user.id)
    if (!detail) {
      return res.status(404).json({ success: false, message: 'Live session not found' })
    }

    res.json({ success: true, data: detail })
  } catch (error: any) {
    logger.error('Error fetching live session for viewer:', error)
    res.status(500).json({ success: false, message: 'Failed to fetch live session', error: error.message })
  }
}

/** Public -- the Discover feed's "who's live now" rail, no auth required. */
export const listLiveSessions = async (_req: SellerAuthRequest, res: Response) => {
  try {
    const sessions = await liveSessionService.listLiveSessions()
    res.json({ success: true, data: { sessions } })
  } catch (error: any) {
    logger.error('Error listing live sessions:', error)
    res.status(500).json({ success: false, message: 'Failed to list live sessions', error: error.message })
  }
}
