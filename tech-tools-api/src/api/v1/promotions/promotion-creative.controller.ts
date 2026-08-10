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
 */
import { Response } from 'express'
import sharp from 'sharp'
import fs from 'fs/promises'
import { v4 as uuidv4 } from 'uuid'
import { StaffAuthRequest } from '../../../middleware/staff'
import { validateImageFile } from '../../../utils/media'
import { storeMediaBuffer } from '../../../services/media-storage.service'
import logger from '../../../utils/logger'

const MAX_WIDTH = 1600

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
    const campaignId = typeof req.body.campaignId === 'string' ? req.body.campaignId : 'unfiled'

    const image = sharp(file.path)
    const metadata = await image.metadata()
    const buffer = await image
      .resize({ width: Math.min(MAX_WIDTH, metadata.width || MAX_WIDTH), withoutEnlargement: true })
      .webp({ quality: 85 })
      .toBuffer()
    const resizedMetadata = await sharp(buffer).metadata()

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
