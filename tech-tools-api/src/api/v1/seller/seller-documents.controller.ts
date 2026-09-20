import { Response } from 'express'
import { AuthRequest } from '../../../middleware/auth'
import { query } from '../../../database/connection'
import logger from '../../../utils/logger'
import {
  uploadSellerDocument,
  listCurrentSellerDocuments,
  getSellerDocumentForDownload,
  deleteSellerDocument,
  applySecureDocumentDownloadHeaders,
  type SellerDocumentCategory,
} from '../../../services/seller-documents.service'

const isSellerSystemEnabled = () =>
  String(process.env.ENABLE_SELLER_TIERS || 'false').toLowerCase() === 'true'

const DOCUMENT_CATEGORIES: SellerDocumentCategory[] = [
  'identity_document',
  'proof_of_address',
  'business_registration',
  'tax_document',
  'additional_requested',
]

const ensureSellerInfrastructure = (res: Response): boolean => {
  if (!isSellerSystemEnabled()) {
    res.status(404).json({ success: false, error: 'Seller onboarding is not enabled' })
    return false
  }
  return true
}

async function getOwnSellerProfileId(userId: string): Promise<string | null> {
  const result = await query(`SELECT id FROM seller_profiles WHERE user_id = $1 LIMIT 1`, [userId])
  return result.rows[0]?.id || null
}

export const uploadMySellerDocument = async (req: AuthRequest, res: Response) => {
  try {
    if (!ensureSellerInfrastructure(res)) return

    const userId = req.user?.userId
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Authentication required' })
    }

    const file = req.file
    if (!file) {
      return res.status(400).json({ success: false, error: 'No file provided' })
    }

    const category = String(req.body?.category || '') as SellerDocumentCategory
    if (!DOCUMENT_CATEGORIES.includes(category)) {
      return res.status(400).json({
        success: false,
        error: `category must be one of: ${DOCUMENT_CATEGORIES.join(', ')}`,
      })
    }

    const sellerProfileId = await getOwnSellerProfileId(userId)
    if (!sellerProfileId) {
      return res.status(404).json({ success: false, error: 'Start onboarding before uploading documents' })
    }

    const metadata = await uploadSellerDocument({
      sellerProfileId,
      userId,
      category,
      fileBuffer: file.buffer,
      contentType: file.mimetype,
      actor: { actorId: userId, ip: req.ip, userAgent: req.headers['user-agent'] as string },
    })

    return res.status(201).json({ success: true, data: { document: metadata } })
  } catch (error) {
    logger.error('Upload seller document error:', error)
    return res.status(500).json({ success: false, error: 'Failed to upload document' })
  }
}

export const listMySellerDocuments = async (req: AuthRequest, res: Response) => {
  try {
    if (!ensureSellerInfrastructure(res)) return

    const userId = req.user?.userId
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Authentication required' })
    }

    const sellerProfileId = await getOwnSellerProfileId(userId)
    if (!sellerProfileId) {
      return res.json({ success: true, data: { documents: [] } })
    }

    const documents = await listCurrentSellerDocuments(sellerProfileId)
    return res.json({ success: true, data: { documents } })
  } catch (error) {
    logger.error('List seller documents error:', error)
    return res.status(500).json({ success: false, error: 'Failed to load documents' })
  }
}

export const downloadMySellerDocument = async (req: AuthRequest, res: Response) => {
  try {
    if (!ensureSellerInfrastructure(res)) return

    const userId = req.user?.userId
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Authentication required' })
    }

    const { documentId } = req.params
    const result = await getSellerDocumentForDownload(documentId, { userId, isAdmin: false })
    if (!result) {
      // Deliberately identical to "document doesn't exist" -- never
      // confirms existence of a document the caller doesn't own.
      return res.status(404).json({ success: false, error: 'Document not found' })
    }

    applySecureDocumentDownloadHeaders(res, {
      contentType: result.contentType,
      category: result.category,
      contentLength: result.stream.contentLength,
    })
    result.stream.stream.pipe(res)
  } catch (error) {
    logger.error('Download seller document error:', error)
    return res.status(500).json({ success: false, error: 'Failed to download document' })
  }
}

export const deleteMySellerDocument = async (req: AuthRequest, res: Response) => {
  try {
    if (!ensureSellerInfrastructure(res)) return

    const userId = req.user?.userId
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Authentication required' })
    }

    const { documentId } = req.params
    const deleted = await deleteSellerDocument(
      documentId,
      { userId, isAdmin: false },
      { actorId: userId, ip: req.ip, userAgent: req.headers['user-agent'] as string },
    )
    if (!deleted) {
      return res.status(404).json({ success: false, error: 'Document not found' })
    }

    return res.json({ success: true, message: 'Document removed' })
  } catch (error) {
    logger.error('Delete seller document error:', error)
    return res.status(500).json({ success: false, error: 'Failed to delete document' })
  }
}
