import { Response } from 'express'
import { AuthRequest } from '../../../middleware/auth'
import { query } from '../../../database/connection'
import logger from '../../../utils/logger'
import {
  computeOnboardingProgress,
  evaluateSubmissionEligibility,
  resolveSellerCapabilities,
} from '../../../services/seller-lifecycle-query.service'
import {
  submitSellerApplication,
  IllegalTransitionError,
  NotFoundError,
} from '../../../services/seller-lifecycle.service'

const isSellerSystemEnabled = () =>
  String(process.env.ENABLE_SELLER_TIERS || 'false').toLowerCase() === 'true'

const ensureSellerInfrastructure = (res: Response): boolean => {
  if (!isSellerSystemEnabled()) {
    res.status(404).json({ success: false, error: 'Seller onboarding is not enabled' })
    return false
  }
  return true
}

export const getMyOnboardingProgress = async (req: AuthRequest, res: Response) => {
  try {
    if (!ensureSellerInfrastructure(res)) return

    const userId = req.user?.userId
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Authentication required' })
    }

    const progress = await computeOnboardingProgress(userId)
    return res.json({ success: true, data: progress })
  } catch (error) {
    logger.error('Get onboarding progress error:', error)
    return res.status(500).json({ success: false, error: 'Failed to load onboarding progress' })
  }
}

export const submitMySellerApplication = async (req: AuthRequest, res: Response) => {
  try {
    if (!ensureSellerInfrastructure(res)) return

    const userId = req.user?.userId
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Authentication required' })
    }

    const { requestedTier } = req.body as { requestedTier?: 'basic' | 'trusted' | 'pro' }

    const profileResult = await query(`SELECT id FROM seller_profiles WHERE user_id = $1 LIMIT 1`, [
      userId,
    ])
    if (profileResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Start onboarding before submitting' })
    }

    const eligibility = await evaluateSubmissionEligibility(profileResult.rows[0].id)
    if (!eligibility.eligible) {
      return res.status(400).json({
        success: false,
        error: 'Your application is missing required information',
        missingRequirements: eligibility.missing,
      })
    }

    const result = await submitSellerApplication({
      sellerProfileId: profileResult.rows[0].id,
      actor: { actorId: userId, ip: req.ip, userAgent: req.headers['user-agent'] as string },
      requestedTier,
    })

    return res.status(result.noop ? 200 : 201).json({
      success: true,
      data: { sellerProfile: result.sellerProfile, request: result.verificationRequest, noop: result.noop },
    })
  } catch (error) {
    if (error instanceof NotFoundError) {
      return res.status(404).json({ success: false, error: error.message })
    }
    if (error instanceof IllegalTransitionError) {
      return res.status(409).json({ success: false, error: error.message })
    }
    logger.error('Submit seller application error:', error)
    return res.status(500).json({ success: false, error: 'Failed to submit seller application' })
  }
}

export const getMySellerCapabilities = async (req: AuthRequest, res: Response) => {
  try {
    if (!ensureSellerInfrastructure(res)) return

    const userId = req.user?.userId
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Authentication required' })
    }

    const capabilities = await resolveSellerCapabilities(userId)
    return res.json({ success: true, data: capabilities })
  } catch (error) {
    logger.error('Get seller capabilities error:', error)
    return res.status(500).json({ success: false, error: 'Failed to load seller capabilities' })
  }
}
