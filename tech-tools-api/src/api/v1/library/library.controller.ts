import { Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import logger from '../../../utils/logger'
import { query } from '../../../database/connection'
import { AuthRequest } from '../../../middleware/auth'

const isLibraryEnabled = () => {
  const globalEnabled =
    String(process.env.ENABLE_BOOKS_WEB3 || 'false').toLowerCase() === 'true'
  const libraryEnabled =
    String(process.env.DIGITAL_LIBRARY_ENABLED || 'false').toLowerCase() ===
    'true'

  return globalEnabled && libraryEnabled
}

const requireLibraryEnabled = (res: Response) => {
  if (!isLibraryEnabled()) {
    res.status(404).json({
      success: false,
      error: 'Digital library is not enabled',
    })
    return false
  }

  return true
}

const hasActiveEntitlement = async (userId: string, productId: string) => {
  const result = await query(
    `SELECT id
     FROM digital_entitlements
     WHERE user_id = $1
       AND product_id = $2
       AND revoked_at IS NULL
       AND (expires_at IS NULL OR expires_at > NOW())
     ORDER BY granted_at DESC
     LIMIT 1`,
    [userId, productId],
  )

  return result.rows.length > 0
}

const columnExists = async (tableName: string, columnName: string) => {
  const result = await query(
    `SELECT EXISTS (
       SELECT 1
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = $1
         AND column_name = $2
     ) AS exists`,
    [tableName, columnName],
  )

  return Boolean(result.rows[0]?.exists)
}

const normalizeFormatKey = (formatKey: string | undefined) => {
  const normalized = String(formatKey || '')
    .trim()
    .toLowerCase()

  if (!normalized) {
    return null
  }

  const supported = ['pdf', 'epub', 'mobi', 'azw3', 'html', 'audio']
  return supported.includes(normalized) ? normalized : null
}

export const getMyLibrary = async (req: AuthRequest, res: Response) => {
  try {
    if (!requireLibraryEnabled(res)) {
      return
    }

    const userId = req.user?.userId
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Authentication required' })
    }

    const { page = 1, limit = 20 } = req.query
    const offset = (Number(page) - 1) * Number(limit)

    const countResult = await query(
      `SELECT COUNT(*)
       FROM digital_entitlements de
       WHERE de.user_id = $1
         AND de.revoked_at IS NULL
         AND (de.expires_at IS NULL OR de.expires_at > NOW())`,
      [userId],
    )

    const total = Number(countResult.rows[0]?.count || 0)

    const result = await query(
      `SELECT
         de.id AS entitlement_id,
         de.license_type,
         de.granted_at,
         de.expires_at,
         p.id AS product_id,
         p.name,
         p.slug,
         p.description,
         bm.cover_image_url,
         bm.preview_url,
         bm.format,
         rp.location_ref,
         rp.percent_complete,
         rp.updated_at AS progress_updated_at
       FROM digital_entitlements de
       JOIN products p ON p.id = de.product_id
       LEFT JOIN book_metadata bm ON bm.product_id = p.id
       LEFT JOIN reading_progress rp
         ON rp.user_id = de.user_id
        AND rp.product_id = de.product_id
       WHERE de.user_id = $1
         AND de.revoked_at IS NULL
         AND (de.expires_at IS NULL OR de.expires_at > NOW())
       ORDER BY de.granted_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, Number(limit), offset],
    )

    res.json({
      success: true,
      data: {
        library: result.rows,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          totalPages: Math.ceil(total / Number(limit)),
        },
      },
    })
  } catch (error) {
    logger.error('Get my library error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to fetch digital library',
    })
  }
}

export const getSignedAccessUrl = async (req: AuthRequest, res: Response) => {
  try {
    if (!requireLibraryEnabled(res)) {
      return
    }

    const userId = req.user?.userId
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Authentication required' })
    }

    const { productId } = req.params
    const requestedFormat = normalizeFormatKey(String(req.query.format || ''))
    const entitled = await hasActiveEntitlement(userId, productId)

    if (!entitled) {
      return res.status(403).json({
        success: false,
        error: 'You are not entitled to this book',
      })
    }

    const supportsFormatKey = await columnExists('digital_assets', 'format_key')
    const formatFilter = supportsFormatKey && requestedFormat
      ? `AND format_key = $2`
      : ''

    const assetResult = await query(
      `SELECT id, storage_url, mime_type${supportsFormatKey ? ', format_key' : ''}
       FROM digital_assets
       WHERE product_id = $1
         AND asset_type = 'full'
         AND is_active = true
         ${formatFilter}
       ORDER BY created_at DESC
       LIMIT 1`,
      supportsFormatKey && requestedFormat ? [productId, requestedFormat] : [productId],
    )

    if (assetResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Book asset is not available',
      })
    }

    const asset = assetResult.rows[0]
    const secret = process.env.JWT_SECRET || 'development-secret'

    const token = jwt.sign(
      {
        userId,
        productId,
        assetId: asset.id,
        access: 'library_download',
      },
      secret,
      { expiresIn: 120 },
    )

    const protocol = req.headers['x-forwarded-proto'] || req.protocol
    const host = req.headers.host
    const accessUrl = `${protocol}://${host}/api/v1/library/access/${asset.id}?token=${token}`

    res.json({
      success: true,
      data: {
        accessUrl,
        expiresInSeconds: 120,
        mimeType: asset.mime_type,
        format: supportsFormatKey ? asset.format_key || null : null,
      },
    })
  } catch (error) {
    logger.error('Get signed access URL error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to generate signed access URL',
    })
  }
}

export const resolveSignedAccess = async (req: Request, res: Response) => {
  try {
    if (!requireLibraryEnabled(res)) {
      return
    }

    const { assetId } = req.params
    const token = String(req.query.token || '')

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Access token is required',
      })
    }

    const secret = process.env.JWT_SECRET || 'development-secret'
    const decoded = jwt.verify(token, secret) as jwt.JwtPayload

    if (
      decoded.access !== 'library_download' ||
      decoded.assetId !== assetId ||
      !decoded.userId ||
      !decoded.productId
    ) {
      return res.status(403).json({
        success: false,
        error: 'Invalid access token',
      })
    }

    const entitled = await hasActiveEntitlement(decoded.userId, decoded.productId)
    if (!entitled) {
      return res.status(403).json({
        success: false,
        error: 'Entitlement no longer active',
      })
    }

    const assetResult = await query(
      `SELECT storage_url
       FROM digital_assets
       WHERE id = $1
         AND product_id = $2
         AND is_active = true
       LIMIT 1`,
      [assetId, decoded.productId],
    )

    if (assetResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Asset not found',
      })
    }

    return res.redirect(assetResult.rows[0].storage_url)
  } catch (error) {
    logger.warn('Resolve signed access error:', error)
    return res.status(401).json({
      success: false,
      error: 'Invalid or expired access token',
    })
  }
}

export const updateReadingProgress = async (req: AuthRequest, res: Response) => {
  try {
    if (!requireLibraryEnabled(res)) {
      return
    }

    const userId = req.user?.userId
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Authentication required' })
    }

    const { productId } = req.params
    const { locationRef, percentComplete } = req.body

    const entitlement = await hasActiveEntitlement(userId, productId)
    if (!entitlement) {
      return res.status(403).json({
        success: false,
        error: 'You are not entitled to this book',
      })
    }

    if (
      percentComplete === undefined ||
      Number(percentComplete) < 0 ||
      Number(percentComplete) > 100
    ) {
      return res.status(400).json({
        success: false,
        error: 'percentComplete must be between 0 and 100',
      })
    }

    const result = await query(
      `INSERT INTO reading_progress (user_id, product_id, location_ref, percent_complete, updated_at)
       VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
       ON CONFLICT (user_id, product_id)
       DO UPDATE SET
         location_ref = EXCLUDED.location_ref,
         percent_complete = EXCLUDED.percent_complete,
         updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [userId, productId, locationRef || null, Number(percentComplete)],
    )

    res.json({
      success: true,
      data: {
        progress: result.rows[0],
      },
    })
  } catch (error) {
    logger.error('Update reading progress error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to update reading progress',
    })
  }
}
