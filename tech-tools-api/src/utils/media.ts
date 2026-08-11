import multer from 'multer'
import sharp from 'sharp'
import path from 'path'
import fs from 'fs/promises'
import { v4 as uuidv4 } from 'uuid'
import mime from 'mime-types'
import {
  deleteStoredMedia,
  isAbsoluteMediaUrl,
  storeMediaBuffer,
  storeMediaFile,
} from '../services/media-storage.service'

// =====================================================
// CONFIGURATION
// =====================================================

const UPLOAD_DIR = process.env.UPLOAD_DIR || 'uploads'
export const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE || '10485760') // 10MB default
const MAX_VIDEO_SIZE = parseInt(process.env.MAX_VIDEO_SIZE || '104857600') // 100MB default
const MAX_BOOK_ASSET_SIZE = parseInt(
  process.env.MAX_BOOK_ASSET_SIZE || '52428800',
) // 50MB default

// Image sizes for optimization
const IMAGE_SIZES = {
  thumbnail: { width: 150, height: 150, fit: 'cover' as const },
  small: { width: 300, height: 300, fit: 'inside' as const },
  medium: { width: 600, height: 600, fit: 'inside' as const },
  large: { width: 1200, height: 1200, fit: 'inside' as const },
}

// Allowed file types
export const ALLOWED_IMAGE_TYPES = [
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
const ALLOWED_BOOK_ASSET_TYPES = [
  'application/pdf',
  'application/epub+zip',
  'application/x-epub+zip',
  'application/x-mobipocket-ebook',
  'application/vnd.amazon.ebook',
  'application/zip',
  'application/x-zip-compressed',
  'text/plain',
  'text/markdown',
  'application/octet-stream',
  'application/x-fictionbook+xml',
  'application/xhtml+xml',
  'audio/mpeg',
  'audio/mp4',
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
    `${UPLOAD_DIR}/blog`,
    `${UPLOAD_DIR}/blog/images`,
    `${UPLOAD_DIR}/blog/thumbnails`,
    `${UPLOAD_DIR}/blog/videos`,
    `${UPLOAD_DIR}/books`,
    `${UPLOAD_DIR}/books/assets`,
    `${UPLOAD_DIR}/books/assets/full`,
    `${UPLOAD_DIR}/books/assets/sample`,
    `${UPLOAD_DIR}/books/assets/cover`,
    `${UPLOAD_DIR}/books/assets/audio`,
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
export const mediaTempStorage = multer.diskStorage({
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
  storage: mediaTempStorage,
  fileFilter,
  limits: {
    fileSize: MAX_VIDEO_SIZE, // Use max video size as the upper limit
  },
})

const bookAssetFileFilter = (
  _req: any,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback,
) => {
  const extension = path.extname(file.originalname).toLowerCase()
  const allowedExtensions = new Set([
    '.pdf',
    '.epub',
    '.mobi',
    '.azw',
    '.azw3',
    '.fb2',
    '.xml',
    '.xhtml',
    '.html',
    '.htm',
    '.txt',
    '.md',
    '.mp3',
    '.m4a',
    '.m4b',
    '.zip',
  ])

  if (
    ALLOWED_BOOK_ASSET_TYPES.includes(file.mimetype) ||
    allowedExtensions.has(extension)
  ) {
    cb(null, true)
    return
  }

  cb(
    new Error(
      `Invalid book asset type. Allowed types: ${[
        ...ALLOWED_BOOK_ASSET_TYPES,
      ].join(', ')}`,
    ),
  )
}

export const uploadBookAssets = multer({
  storage: mediaTempStorage,
  fileFilter: bookAssetFileFilter,
  limits: {
    fileSize: MAX_BOOK_ASSET_SIZE,
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
  const normalizedFolder = destinationFolder.replace(/\\/g, '/')
  const storageFolder = normalizedFolder.startsWith(`${UPLOAD_DIR}/`)
    ? normalizedFolder.slice(UPLOAD_DIR.length + 1)
    : normalizedFolder.replace(/^uploads\/?/, '')
  const cacheControl = 'public, max-age=31536000, immutable'

  // Get original image metadata
  const metadata = await sharp(filePath).metadata()
  const originalWidth = metadata.width || 0
  const originalHeight = metadata.height || 0

  // Create optimized versions for each size
  for (const [sizeName, config] of Object.entries(IMAGE_SIZES)) {
    const outputKey = `${storageFolder}/${sizeName}-${filename}`
    const optimizedBuffer = await sharp(filePath)
      .resize(config.width, config.height, { fit: config.fit })
      .webp({ quality: 85 }) // Convert to WebP for better compression
      .toBuffer()

    const stored = await storeMediaBuffer({
      key: outputKey,
      body: optimizedBuffer,
      contentType: 'image/webp',
      cacheControl,
      resourceType: 'image',
    })

    const optimizedMetadata = await sharp(optimizedBuffer).metadata()

    results[sizeName] = {
      size: sizeName,
      url: stored.url,
      width: optimizedMetadata.width || 0,
      height: optimizedMetadata.height || 0,
      fileSize: optimizedBuffer.length,
    }
  }

  // Also save the original (but optimized with WebP)
  const originalBuffer = await sharp(filePath).webp({ quality: 90 }).toBuffer()
  const storedOriginal = await storeMediaBuffer({
    key: `${storageFolder}/original-${filename}`,
    body: originalBuffer,
    contentType: 'image/webp',
    cacheControl,
    resourceType: 'image',
  })
  const original: OptimizedImage = {
    size: 'original',
    url: storedOriginal.url,
    width: originalWidth,
    height: originalHeight,
    fileSize: originalBuffer.length,
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

/**
 * Process blog image upload
 */
export async function processBlogImage(file: Express.Multer.File): Promise<{
  imageUrl: string
  thumbnailUrl: string
  dimensions: { width: number; height: number }
}> {
  const imageId = uuidv4()
  const filename = `${imageId}.webp`
  const thumbnailFilename = `thumb-${imageId}.webp`
  const cacheControl = 'public, max-age=31536000, immutable'

  // Get original dimensions
  const metadata = await sharp(file.path).metadata()
  const dimensions = {
    width: metadata.width || 0,
    height: metadata.height || 0,
  }

  // Optimize main image
  const imageBuffer = await sharp(file.path)
    .resize(1920, 1080, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 85 })
    .toBuffer()

  const uploadedImage = await storeMediaBuffer({
    key: `blog/images/${filename}`,
    body: imageBuffer,
    contentType: 'image/webp',
    cacheControl,
    resourceType: 'image',
  })

  // Create thumbnail
  const thumbnailBuffer = await sharp(file.path)
    .resize(400, 300, { fit: 'cover' })
    .webp({ quality: 80 })
    .toBuffer()

  const uploadedThumbnail = await storeMediaBuffer({
    key: `blog/thumbnails/${thumbnailFilename}`,
    body: thumbnailBuffer,
    contentType: 'image/webp',
    cacheControl,
    resourceType: 'image',
  })

  // Delete temp file
  await fs.unlink(file.path)

  return {
    imageUrl: uploadedImage.url,
    thumbnailUrl: uploadedThumbnail.url,
    dimensions,
  }
}

/**
 * Process blog video upload
 */
export async function processBlogVideo(file: Express.Multer.File): Promise<{
  url: string
  thumbnailUrl: string
  fileName: string
  fileSize: number
  format: string
}> {
  const videoId = uuidv4()
  const ext = path.extname(file.originalname)
  const fileName = `${videoId}${ext}`
  const stats = await fs.stat(file.path)
  const uploadedVideo = await storeMediaFile({
    localPath: file.path,
    key: `blog/videos/${fileName}`,
    contentType: file.mimetype,
    cacheControl: 'public, max-age=31536000, immutable',
    resourceType: 'video',
  })

  await fs.unlink(file.path).catch(() => undefined)

  return {
    url: uploadedVideo.url,
    thumbnailUrl: '', // Placeholder - would use FFmpeg in production
    fileName,
    fileSize: stats.size,
    format: mime.extension(file.mimetype) || ext.replace('.', ''),
  }
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
  const stats = await fs.stat(file.path)
  const uploadedVideo = await storeMediaFile({
    localPath: file.path,
    key: `${type}s/videos/${fileName}`,
    contentType: file.mimetype,
    cacheControl: 'public, max-age=31536000, immutable',
    resourceType: 'video',
  })

  await fs.unlink(file.path).catch(() => undefined)

  // For thumbnail generation, in a real-world scenario you'd use FFmpeg
  // For now, we'll return a placeholder
  // TODO: Implement FFmpeg thumbnail extraction
  // For now, create a placeholder response

  return {
    url: uploadedVideo.url,
    thumbnailUrl: '',
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

/**
 * Validate book asset file
 */
export function validateBookAssetFile(file: Express.Multer.File): {
  valid: boolean
  error?: string
} {
  const extension = path.extname(file.originalname).toLowerCase()
  const allowedExtensions = new Set([
    '.pdf',
    '.epub',
    '.mobi',
    '.azw',
    '.azw3',
    '.fb2',
    '.xml',
    '.xhtml',
    '.html',
    '.htm',
    '.txt',
    '.md',
    '.mp3',
    '.m4a',
    '.m4b',
    '.zip',
  ])

  if (
    !ALLOWED_BOOK_ASSET_TYPES.includes(file.mimetype) &&
    !allowedExtensions.has(extension)
  ) {
    return {
      valid: false,
      error: `Invalid book asset type. Allowed types: ${[
        ...ALLOWED_BOOK_ASSET_TYPES,
      ].join(', ')}`,
    }
  }

  if (file.size > MAX_BOOK_ASSET_SIZE) {
    return {
      valid: false,
      error: `Book asset size exceeds maximum allowed size of ${
        MAX_BOOK_ASSET_SIZE / 1024 / 1024
      }MB`,
    }
  }

  return { valid: true }
}

function normalizeBookFormatKey(value: string): string | null {
  const normalized = (value || '').trim().toLowerCase()
  const supported = ['pdf', 'epub', 'mobi', 'azw3', 'html', 'audio', 'fb2', 'txt']
  return supported.includes(normalized) ? normalized : null
}

export function inferBookAssetFormat(file: Express.Multer.File): string | null {
  const extension = path.extname(file.originalname).toLowerCase().replace(/^\./, '')
  const mimeExtension = mime.extension(file.mimetype)
  return normalizeBookFormatKey(extension || mimeExtension || '')
}

export async function processBookAsset(file: Express.Multer.File, options?: {
  productId?: string
  formatKey?: string | null
  assetType?: 'full' | 'sample' | 'cover' | 'audio'
  variantName?: string | null
}): Promise<{
  url: string
  fileName: string
  fileSize: number
  format: string | null
  mimeType: string
}> {
  await ensureUploadDirectories()

  const stats = await fs.stat(file.path)
  const ext = path.extname(file.originalname).toLowerCase() || '.bin'
  const resolvedFormat =
    options?.formatKey || inferBookAssetFormat(file) || ext.replace(/^\./, '')
  const safeFormat = normalizeBookFormatKey(resolvedFormat) || 'pdf'
  const assetType = options?.assetType || 'full'
  const fileName = `${uuidv4()}${ext}`
  const productFolder = options?.productId || 'unassigned'

  const stored = await storeMediaFile({
    localPath: file.path,
    key: `books/assets/${assetType}/${productFolder}/${safeFormat}/${fileName}`,
    contentType: file.mimetype,
    cacheControl: 'public, max-age=31536000, immutable',
    resourceType: 'raw',
  })

  await fs.unlink(file.path).catch(() => undefined)

  return {
    url: stored.url,
    fileName,
    fileSize: stats.size,
    format: safeFormat,
    mimeType: file.mimetype,
  }
}

// =====================================================
// FILE DELETION
// =====================================================

/**
 * Delete media file and all its optimized versions
 */
export async function deleteMediaFile(url: string): Promise<void> {
  try {
    if (!url) return

    const deleteTargets = new Set<string>()
    deleteTargets.add(url)

    if (url.includes('/images/')) {
      for (const variantUrl of buildImageVariantUrls(url)) {
        deleteTargets.add(variantUrl)
      }
    }

    if (url.includes('/videos/')) {
      deleteTargets.add(buildVideoThumbnailUrl(url))
    }

    await Promise.all(
      Array.from(deleteTargets)
        .filter(Boolean)
        .map((target) => deleteStoredMedia(target).catch(() => undefined)),
    )
  } catch (error) {
    console.error('Error deleting media file:', error)
    // Don't throw - file might already be deleted
  }
}

function buildImageVariantUrls(url: string): string[] {
  const prefixes = ['thumbnail', 'small', 'medium', 'large', 'original']

  if (isAbsoluteMediaUrl(url)) {
    const parsed = new URL(url)
    const pathname = parsed.pathname
    const basename = path.posix.basename(pathname)
    const suffix = basename.replace(
      /^(thumbnail|small|medium|large|original)-/,
      '',
    )
    const dir = path.posix.dirname(pathname)

    return prefixes.map((prefix) => {
      const clone = new URL(url)
      clone.pathname = `${dir}/${prefix}-${suffix}`
      return clone.toString()
    })
  }

  const basename = path.posix.basename(url)
  const suffix = basename.replace(
    /^(thumbnail|small|medium|large|original)-/,
    '',
  )
  const dir = path.posix.dirname(url)

  return prefixes.map((prefix) => `${dir}/${prefix}-${suffix}`)
}

function buildVideoThumbnailUrl(url: string): string {
  if (isAbsoluteMediaUrl(url)) {
    const parsed = new URL(url)
    const basename = path.posix.basename(parsed.pathname)
    const videoId = basename.replace(path.extname(basename), '')
    const dir = path.posix
      .dirname(parsed.pathname)
      .replace('/videos', '/thumbnails')
    parsed.pathname = `${dir}/thumb-${videoId}.jpg`
    return parsed.toString()
  }

  const basename = path.posix.basename(url)
  const videoId = basename.replace(path.extname(basename), '')
  const dir = path.posix.dirname(url).replace('/videos', '/thumbnails')
  return `${dir}/thumb-${videoId}.jpg`
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
  const resolveUrl = (value: string) => {
    if (!value) return value
    if (isAbsoluteMediaUrl(value)) return value

    const cdnDomain =
      process.env.MEDIA_CDN_BASE_URL ||
      process.env.CDN_DOMAIN ||
      process.env.API_URL ||
      'http://localhost:9000'

    return `${cdnDomain.replace(/\/$/, '')}${
      value.startsWith('/') ? value : `/${value}`
    }`
  }

  const cdnUrls: any = {
    original: resolveUrl(baseUrl),
  }

  if (!optimizedImages) {
    return cdnUrls
  }

  for (const [size, image] of Object.entries(optimizedImages)) {
    cdnUrls[size] = resolveUrl(image.url)
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
