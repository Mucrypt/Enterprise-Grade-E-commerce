/**
 * Campaign creative upload -- reuses the existing Sharp + pluggable
 * storage infrastructure (utils/media.ts, media-storage.service.ts)
 * exactly as product/category image upload already does, but does NOT
 * add entries to utils/media.ts's shared IMAGE_SIZES map: that constant
 * drives every existing image upload flow in this codebase (products,
 * categories, blog posts), and adding social-platform-specific crop
 * presets there would generate extra, unwanted derivatives for all of
 * them. Instead this produces exactly one optimized WebP derivative per
 * upload, capped at a display-appropriate width -- sufficient for the
 * composer's preview/publish flow this phase. Per-platform crop presets
 * (square/portrait/story/landscape) are a named next-phase item, not
 * silently dropped -- see docs/PROMOTION-OPS-1-IMPLEMENTATION-REPORT.md.
 *
 * Security hardening (Production Review Round 1 §22):
 * - Uses a dedicated, narrower multer instance (campaignCreativeUpload,
 *   this file) instead of utils/media.ts's shared `upload` -- that one
 *   also accepts video up to 100MB (needed for other flows); this
 *   endpoint is image-only this phase and should reject a video/oversized
 *   file at the multer layer, not after a costly Sharp decode attempt.
 * - campaignId (which becomes part of the storage KEY, i.e. a filesystem
 *   path component for the local storage provider) is validated as a
 *   strict UUID -- and, if supplied, confirmed to be a real campaign
 *   within the caller's own market scope -- before use. Passing raw
 *   user input into a storage key was a real path-traversal exposure
 *   (media-storage.service.ts's local-storage key normalization does not
 *   strip "../" segments); this closes it for this endpoint without
 *   touching that shared file, which many unrelated upload flows also
 *   depend on and which this focused review does not touch.
 * - A Sharp decode failure (e.g. a file whose bytes don't match its
 *   claimed MIME type) is now a 400, not a 500 -- and the temp file is
 *   always cleaned up via `finally`, on every exit path.
 */
import { Response } from 'express'
import multer from 'multer'
import sharp from 'sharp'
import fs from 'fs/promises'
import { v4 as uuidv4 } from 'uuid'
import { StaffAuthRequest } from '../../../middleware/staff'
import { ALLOWED_IMAGE_TYPES, MAX_FILE_SIZE, mediaTempStorage, validateImageFile } from '../../../utils/media'
import { storeMediaBuffer } from '../../../services/media-storage.service'
import { query } from '../../../database/connection'
import { resolveStaffScope } from '../analytics/analytics-query.helpers'
import { isCampaignInScope } from './promotion-scope.helpers'
import logger from '../../../utils/logger'

const MAX_WIDTH = 1600
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Image-only, 10MB cap (MAX_FILE_SIZE) -- not utils/media.ts's shared `upload`, which also accepts video up to 100MB for other flows. */
export const campaignCreativeUpload = multer({
  storage: mediaTempStorage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
      cb(null, true)
    } else {
      cb(new Error(`Invalid file type for a campaign creative. Allowed: ${ALLOWED_IMAGE_TYPES.join(', ')}`))
    }
  },
})

export const uploadCampaignCreative = async (req: StaffAuthRequest, res: Response): Promise<void> => {
  const file = req.file
  try {
    if (!file) {
      res.status(400).json({ success: false, error: 'No file uploaded' })
      return
    }
    const validation = validateImageFile(file)
    if (!validation.valid) {
      res.status(400).json({ success: false, error: validation.error })
      return
    }

    // campaignId becomes a storage-key path component -- never trust it
    // unvalidated. A non-UUID value is rejected outright rather than
    // silently substituted, so a caller can't smuggle "../" or similar
    // through this field.
    const rawCampaignId = req.body.campaignId
    let campaignId = 'unfiled'
    if (typeof rawCampaignId === 'string' && rawCampaignId.length > 0) {
      if (!UUID_RE.test(rawCampaignId)) {
        res.status(400).json({ success: false, error: '"campaignId" must be a valid UUID' })
        return
      }
      const campaignResult = await query(`SELECT market_scope FROM promotion_campaigns WHERE id = $1`, [rawCampaignId])
      const campaign = campaignResult.rows[0]
      if (!campaign) {
        res.status(404).json({ success: false, error: 'Campaign not found' })
        return
      }
      const scope = resolveStaffScope(req)
      if (!isCampaignInScope(scope, campaign.market_scope)) {
        res.status(404).json({ success: false, error: 'Campaign not found' })
        return
      }
      campaignId = rawCampaignId
    }

    let buffer: Buffer
    let resizedMetadata: sharp.Metadata
    try {
      const image = sharp(file.path)
      const metadata = await image.metadata()
      buffer = await image
        .resize({ width: Math.min(MAX_WIDTH, metadata.width || MAX_WIDTH), withoutEnlargement: true })
        .webp({ quality: 85 })
        .toBuffer()
      resizedMetadata = await sharp(buffer).metadata()
    } catch (decodeError) {
      logger.warn('Campaign creative upload: Sharp failed to decode the uploaded file', decodeError)
      res.status(400).json({ success: false, error: 'The uploaded file is not a valid or supported image.' })
      return
    }

    const key = `campaigns/creatives/${campaignId}/${uuidv4()}.webp`
    const stored = await storeMediaBuffer({
      key,
      body: buffer,
      contentType: 'image/webp',
      cacheControl: 'public, max-age=31536000, immutable',
      resourceType: 'image',
    })

    res.json({
      success: true,
      asset: {
        key,
        url: stored.url,
        variant: 'display',
        width: resizedMetadata.width || 0,
        height: resizedMetadata.height || 0,
        mediaType: 'image',
      },
    })
  } catch (error) {
    logger.error('Error uploading campaign creative:', error)
    res.status(500).json({ success: false, error: 'Failed to upload creative' })
  } finally {
    if (file?.path) {
      await fs.unlink(file.path).catch(() => undefined)
    }
  }
}

// Re-exported so routes.ts's multer error handling (invalid type / too
// large) can reference the same limit this module enforces without
// re-declaring it.
export { MAX_FILE_SIZE as CAMPAIGN_CREATIVE_MAX_FILE_SIZE }
