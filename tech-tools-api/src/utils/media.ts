import multer from 'multer'
import sharp from 'sharp'
import path from 'path'
import fs from 'fs/promises'
import { v4 as uuidv4 } from 'uuid'
import mime from 'mime-types'

// =====================================================
// CONFIGURATION
// =====================================================

const UPLOAD_DIR = process.env.UPLOAD_DIR || 'uploads'
const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE || '10485760') // 10MB default
const MAX_VIDEO_SIZE = parseInt(process.env.MAX_VIDEO_SIZE || '104857600') // 100MB default

// Image sizes for optimization
const IMAGE_SIZES = {
  thumbnail: { width: 150, height: 150, fit: 'cover' as const },
  small: { width: 300, height: 300, fit: 'inside' as const },
  medium: { width: 600, height: 600, fit: 'inside' as const },
  large: { width: 1200, height: 1200, fit: 'inside' as const },
}

// Allowed file types
const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
]
const ALLOWED_VIDEO_TYPES = [
  'video/mp4',
  'video/mpeg',
  'video/quicktime',
  'video/x-msvideo',
]

// =====================================================
// FILESYSTEM SETUP
// =====================================================

// Ensure upload directories exist
export async function ensureUploadDirectories() {
  const dirs = [
    UPLOAD_DIR,
    `${UPLOAD_DIR}/products`,
    `${UPLOAD_DIR}/products/images`,
    `${UPLOAD_DIR}/products/videos`,
    `${UPLOAD_DIR}/products/thumbnails`,
    `${UPLOAD_DIR}/categories`,
    `${UPLOAD_DIR}/categories/images`,
    `${UPLOAD_DIR}/categories/videos`,
    `${UPLOAD_DIR}/categories/thumbnails`,
    `${UPLOAD_DIR}/temp`,
  ]

  for (const dir of dirs) {
    try {
      await fs.access(dir)
    } catch {
      await fs.mkdir(dir, { recursive: true })
    }
  }
}

// =====================================================
// MULTER CONFIGURATION
// =====================================================

// Configure multer storage
const storage = multer.diskStorage({
  destination: async (_req, _file, cb) => {
    const tempDir = `${UPLOAD_DIR}/temp`
    await ensureUploadDirectories()
    cb(null, tempDir)
  },
  filename: (_req, file, cb) => {
    const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`
    cb(null, uniqueName)
  },
})

// File filter
const fileFilter = (
  req: any,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback,
) => {
  const isImage = ALLOWED_IMAGE_TYPES.includes(file.mimetype)
  const isVideo = ALLOWED_VIDEO_TYPES.includes(file.mimetype)

  if (isImage || isVideo) {
    cb(null, true)
  } else {
    cb(
      new Error(
        `Invalid file type. Allowed types: ${[
          ...ALLOWED_IMAGE_TYPES,
          ...ALLOWED_VIDEO_TYPES,
        ].join(', ')}`,
      ),
    )
  }
}

// Configure multer with limits
export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_VIDEO_SIZE, // Use max video size as the upper limit
  },
})

// =====================================================
// IMAGE PROCESSING
// =====================================================

interface OptimizedImage {
  size: string
  url: string
  width: number
  height: number
  fileSize: number
}

/**
 * Optimize image and create multiple sizes
 * Returns URLs for all optimized sizes
 */
export async function optimizeImage(
  filePath: string,
  destinationFolder: string,
  filename: string,
): Promise<{
  original: OptimizedImage
  optimized: { [key: string]: OptimizedImage }
}> {
  await ensureUploadDirectories()

  const results: { [key: string]: OptimizedImage } = {}

  // Get original image metadata
  const metadata = await sharp(filePath).metadata()
  const originalWidth = metadata.width || 0
  const originalHeight = metadata.height || 0

  // Create optimized versions for each size
  for (const [sizeName, config] of Object.entries(IMAGE_SIZES)) {
    const outputPath = `${destinationFolder}/${sizeName}-${filename}`

    await sharp(filePath)
      .resize(config.width, config.height, { fit: config.fit })
      .webp({ quality: 85 }) // Convert to WebP for better compression
      .toFile(outputPath)

    const stats = await fs.stat(outputPath)
    const optimizedMetadata = await sharp(outputPath).metadata()

    results[sizeName] = {
      size: sizeName,
      url: outputPath.replace(/^uploads/, '/media'), // Convert to URL path
      width: optimizedMetadata.width || 0,
      height: optimizedMetadata.height || 0,
      fileSize: stats.size,
    }
  }

  // Also save the original (but optimized with WebP)
  const originalOutputPath = `${destinationFolder}/original-${filename}`
  await sharp(filePath).webp({ quality: 90 }).toFile(originalOutputPath)

  const originalStats = await fs.stat(originalOutputPath)
  const original: OptimizedImage = {
    size: 'original',
    url: originalOutputPath.replace(/^uploads/, '/media'),
    width: originalWidth,
    height: originalHeight,
    fileSize: originalStats.size,
  }

  return { original, optimized: results }
}

/**
 * Process product image upload
 */
export async function processProductImage(file: Express.Multer.File) {
  const filename = `${uuidv4()}.webp`
  const destinationFolder = `${UPLOAD_DIR}/products/images`

  const result = await optimizeImage(file.path, destinationFolder, filename)

  // Delete temp file
  await fs.unlink(file.path)

  return result
}

/**
 * Process category image upload
 */
export async function processCategoryImage(file: Express.Multer.File) {
  const filename = `${uuidv4()}.webp`
  const destinationFolder = `${UPLOAD_DIR}/categories/images`

  const result = await optimizeImage(file.path, destinationFolder, filename)

  // Delete temp file
  await fs.unlink(file.path)

  return result
}

// =====================================================
// VIDEO PROCESSING
// =====================================================

/**
 * Process video upload
 * For enterprise-grade, you'd integrate with a service like AWS Elemental MediaConvert
 * or FFmpeg for transcoding. This is a basic implementation.
 */
export async function processVideo(
  file: Express.Multer.File,
  type: 'product' | 'category',
): Promise<{
  url: string
  thumbnailUrl: string
  fileName: string
  fileSize: number
  format: string
}> {
  const videoId = uuidv4()
  const ext = path.extname(file.originalname)
  const fileName = `${videoId}${ext}`
  const destinationFolder = `${UPLOAD_DIR}/${type}s/videos`
  const videoPath = `${destinationFolder}/${fileName}`

  // Move video to permanent location
  await fs.mkdir(destinationFolder, { recursive: true })
  await fs.rename(file.path, videoPath)

  const stats = await fs.stat(videoPath)

  // For thumbnail generation, in a real-world scenario you'd use FFmpeg
  // For now, we'll return a placeholder
  const thumbnailPath = `${UPLOAD_DIR}/${type}s/thumbnails/thumb-${videoId}.jpg`
  // TODO: Implement FFmpeg thumbnail extraction
  // For now, create a placeholder response

  return {
    url: videoPath.replace(/^uploads/, '/media'),
    thumbnailUrl: thumbnailPath.replace(/^uploads/, '/media'),
    fileName,
    fileSize: stats.size,
    format: mime.extension(file.mimetype) || ext.replace('.', ''),
  }
}

// =====================================================
// FILE VALIDATION
// =====================================================

/**
 * Validate image file
 */
export function validateImageFile(file: Express.Multer.File): {
  valid: boolean
  error?: string
} {
  if (!ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
    return {
      valid: false,
      error: `Invalid image type. Allowed types: ${ALLOWED_IMAGE_TYPES.join(
        ', ',
      )}`,
    }
  }

  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `Image size exceeds maximum allowed size of ${
        MAX_FILE_SIZE / 1024 / 1024
      }MB`,
    }
  }

  return { valid: true }
}

/**
 * Validate video file
 */
export function validateVideoFile(file: Express.Multer.File): {
  valid: boolean
  error?: string
} {
  if (!ALLOWED_VIDEO_TYPES.includes(file.mimetype)) {
    return {
      valid: false,
      error: `Invalid video type. Allowed types: ${ALLOWED_VIDEO_TYPES.join(
        ', ',
      )}`,
    }
  }

  if (file.size > MAX_VIDEO_SIZE) {
    return {
      valid: false,
      error: `Video size exceeds maximum allowed size of ${
        MAX_VIDEO_SIZE / 1024 / 1024
      }MB`,
    }
  }

  return { valid: true }
}

// =====================================================
// FILE DELETION
// =====================================================

/**
 * Delete media file and all its optimized versions
 */
export async function deleteMediaFile(url: string): Promise<void> {
  try {
    const filePath = url.replace(/^\/media/, 'uploads')

    // If it's an image, delete all optimized versions
    if (filePath.includes('/images/')) {
      const dirname = path.dirname(filePath)
      const basename = path.basename(filePath)

      // Delete all size variations
      for (const sizeName of Object.keys(IMAGE_SIZES)) {
        const sizePath = `${dirname}/${sizeName}-${basename}`
        try {
          await fs.unlink(sizePath)
        } catch {
          // Ignore if file doesn't exist
        }
      }

      // Delete original
      try {
        await fs.unlink(filePath)
      } catch {
        // Ignore if file doesn't exist
      }
    } else {
      // For videos, just delete the file
      await fs.unlink(filePath)

      // If there's a thumbnail, delete it too
      if (filePath.includes('/videos/')) {
        const videoId = path.basename(filePath, path.extname(filePath))
        const thumbnailPath = filePath
          .replace('/videos/', '/thumbnails/')
          .replace(path.basename(filePath), `thumb-${videoId}.jpg`)
        try {
          await fs.unlink(thumbnailPath)
        } catch {
          // Ignore if thumbnail doesn't exist
        }
      }
    }
  } catch (error) {
    console.error('Error deleting media file:', error)
    // Don't throw - file might already be deleted
  }
}

// =====================================================
// CDN URL GENERATION
// =====================================================

/**
 * Generate CDN URLs for media
 * In production, replace with your CDN domain
 */
export function generateCdnUrls(
  baseUrl: string,
  optimizedImages?: { [key: string]: OptimizedImage },
): any {
  const cdnDomain =
    process.env.CDN_DOMAIN || process.env.API_URL || 'http://localhost:9000'

  if (!optimizedImages) {
    return {
      original: `${cdnDomain}${baseUrl}`,
    }
  }

  const cdnUrls: any = {}
  for (const [size, image] of Object.entries(optimizedImages)) {
    cdnUrls[size] = `${cdnDomain}${image.url}`
  }

  return cdnUrls
}

// =====================================================
// UTILITY FUNCTIONS
// =====================================================

/**
 * Get file extension from mimetype
 */
export function getExtensionFromMimetype(mimetype: string): string {
  return mime.extension(mimetype) || ''
}

/**
 * Get mimetype from filename
 */
export function getMimetypeFromFilename(filename: string): string | false {
  return mime.lookup(filename)
}

/**
 * Format file size to human-readable string
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

// Initialize directories on module load
if (process.env.NODE_ENV !== 'test') {
  ensureUploadDirectories().catch(console.error)
}
