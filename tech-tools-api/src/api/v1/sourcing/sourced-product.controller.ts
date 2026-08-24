/**
 * Sourced-product endpoints (SOURCING-1). POST /captures is the only
 * route the browser extension ever calls (token-authenticated, see
 * middleware/sourcing-token-auth.ts); every other route here is normal
 * dashboard JWT auth.
 */
import { Response } from 'express'
import { AuthRequest } from '../../../middleware/auth'
import logger from '../../../utils/logger'
import {
  captureProduct,
  listSourcedProducts,
  getSourcedProductById,
  getSourcedProductByCommittedProductId,
  listSiblingDrafts,
  updateReviewFields,
  discardSourcedProduct,
  commitSourcedProduct,
  getSourcingAnalytics,
  listSuppliers,
  CapturePayload,
} from '../../../services/sourcing/sourced-product.service'
import { regenerateRewrite } from '../../../services/sourcing/sourcing-rewrite.service'

/**
 * Lightweight connectivity check for the extension's options-page "Test
 * connection" button -- authenticateSourcingToken already validated the
 * token by the time this handler runs, so a 200 here just confirms the
 * token/base-URL pairing works, without requiring a full capture payload.
 */
export const verifySourcingToken = async (req: AuthRequest, res: Response): Promise<void> => {
  res.json({ success: true, email: req.user?.email ?? null })
}

export const captureSourcedProduct = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const payload = req.body as CapturePayload
    if (!payload?.title || !payload?.sourceUrl || !payload?.sourcePlatform) {
      res.status(400).json({ success: false, error: '"title", "sourceUrl", and "sourcePlatform" are required' })
      return
    }
    const tokenId = (req as any).sourcingTokenId ?? null
    const result = await captureProduct(payload, req.user!.userId, tokenId)
    res.status(201).json({ success: true, data: result })
  } catch (error: any) {
    logger.error('Error capturing sourced product:', error)
    res.status(400).json({ success: false, error: error?.message || 'Failed to capture product' })
  }
}

export const listSourcedProductsHandler = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { status } = req.query
    const rows = await listSourcedProducts({ status: typeof status === 'string' ? status : undefined })
    res.json({ success: true, products: rows })
  } catch (error) {
    logger.error('Error listing sourced products:', error)
    res.status(500).json({ success: false, error: 'Failed to list sourced products' })
  }
}

export const getSourcingAnalyticsHandler = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const analytics = await getSourcingAnalytics()
    res.json({ success: true, analytics })
  } catch (error) {
    logger.error('Error fetching sourcing analytics:', error)
    res.status(500).json({ success: false, error: 'Failed to fetch sourcing analytics' })
  }
}

export const getSourcedProductByCommittedProductIdHandler = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const sourced = await getSourcedProductByCommittedProductId(req.params.productId)
    res.json({ success: true, sourced })
  } catch (error) {
    logger.error('Error looking up sourced product by committed product id:', error)
    res.status(500).json({ success: false, error: 'Failed to look up sourcing origin' })
  }
}

export const listSuppliersHandler = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const suppliers = await listSuppliers()
    res.json({ success: true, suppliers })
  } catch (error) {
    logger.error('Error listing sourcing suppliers:', error)
    res.status(500).json({ success: false, error: 'Failed to list suppliers' })
  }
}

export const getSourcedProduct = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const product = await getSourcedProductById(req.params.id)
    if (!product) {
      res.status(404).json({ success: false, error: 'Sourced product not found' })
      return
    }
    const siblingDrafts = await listSiblingDrafts(product.source_url, product.id)
    res.json({ success: true, product, siblingDrafts })
  } catch (error) {
    logger.error('Error fetching sourced product:', error)
    res.status(500).json({ success: false, error: 'Failed to fetch sourced product' })
  }
}

export const reviewSourcedProduct = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const {
      reviewTitle,
      reviewDescriptionHtml,
      reviewImages,
      reviewSpecs,
      reviewCategoryId,
      reviewMetaTitle,
      reviewMetaDescription,
      finalCostPrice,
      finalSalePrice,
    } = req.body
    await updateReviewFields(
      req.params.id,
      {
        reviewTitle,
        reviewDescriptionHtml,
        reviewImages,
        reviewSpecs,
        reviewCategoryId,
        reviewMetaTitle,
        reviewMetaDescription,
        finalCostPrice,
        finalSalePrice,
      },
      req.user!.userId,
    )
    res.json({ success: true })
  } catch (error: any) {
    logger.error('Error updating sourced product review fields:', error)
    res.status(400).json({ success: false, error: error?.message || 'Failed to update sourced product' })
  }
}

export const regenerateSourcedProductRewrite = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await regenerateRewrite(req.params.id)
    const product = await getSourcedProductById(req.params.id)
    res.json({ success: true, product })
  } catch (error: any) {
    logger.error('Error regenerating sourced product rewrite:', error)
    res.status(400).json({ success: false, error: error?.message || 'Failed to regenerate rewrite' })
  }
}

export const commitSourcedProductHandler = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await commitSourcedProduct(req.params.id, req.user!.userId)
    res.json({ success: true, data: result })
  } catch (error: any) {
    logger.error('Error committing sourced product:', error)
    res.status(400).json({ success: false, error: error?.message || 'Failed to commit sourced product' })
  }
}

export const discardSourcedProductHandler = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { reason } = req.body
    await discardSourcedProduct(req.params.id, typeof reason === 'string' ? reason : null, req.user!.userId)
    res.json({ success: true })
  } catch (error: any) {
    logger.error('Error discarding sourced product:', error)
    res.status(400).json({ success: false, error: error?.message || 'Failed to discard sourced product' })
  }
}
