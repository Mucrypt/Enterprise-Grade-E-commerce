import multer from 'multer'
import type { Request, Response, NextFunction, RequestHandler } from 'express'
import sharp from 'sharp'
import path from 'path'
import fs from 'fs/promises'
import { spawn } from 'child_process'
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
const MAX_AUDIO_SIZE = parseInt(process.env.MAX_AUDIO_SIZE || '20971520') // 20MB default -- a Discover post's background track, not a full album

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
const ALLOWED_AUDIO_TYPES = [
  'audio/mpeg',
  'audio/mp4',
  'audio/x-m4a',
  'audio/wav',
  'audio/x-wav',
  'audio/ogg',
  'audio/webm',
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
    `${UPLOAD_DIR}/discover`,
    `${UPLOAD_DIR}/discover/videos`,
    `${UPLOAD_DIR}/discover/images`,
    `${UPLOAD_DIR}/discover/audio`,
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
  const isAudio = ALLOWED_AUDIO_TYPES.includes(file.mimetype)

  if (isImage || isVideo || isAudio) {
    cb(null, true)
  } else {
    cb(
      new Error(
        `Invalid file type. Allowed types: ${[
          ...ALLOWED_IMAGE_TYPES,
          ...ALLOWED_VIDEO_TYPES,
          ...ALLOWED_AUDIO_TYPES,
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

/**
 * Wraps an `upload.fields(...)`/`upload.single(...)` middleware so a
 * rejected file (wrong type from fileFilter, over the size limit, an
 * unexpected field name) returns a clean 400 with the real reason --
 * instead of the multer/fileFilter error falling through to next(err) and
 * hitting the global error handler, which in production replies with the
 * generic, undiagnosable "Internal server error" (no detail at all,
 * confirmed live: this is exactly what a rejected collection-image upload
 * looked like from the browser before this fix -- a bare 500 with nothing
 * else to go on). Multer errors are always a client mistake (bad file),
 * never a server fault, so 400 is the correct status regardless of what
 * NODE_ENV hides elsewhere.
 */
export function handleUploadErrors(uploadMiddleware: RequestHandler): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    uploadMiddleware(req, res, (err: unknown) => {
      if (!err) return next()

      if (err instanceof multer.MulterError) {
        const message =
          err.code === 'LIMIT_FILE_SIZE'
            ? 'File is too large.'
            : `Upload error: ${err.message}`
        return res.status(400).json({ success: false, error: message })
      }

      // fileFilter's rejection is a plain Error, not a MulterError.
      if (err instanceof Error) {
        return res.status(400).json({ success: false, error: err.message })
      }

      next(err)
    })
  }
}

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
  // Callers that only ever read one variant (e.g. processCollectionImage,
  // which the code only ever reads `.optimized.large` from) can pass a
  // trimmed size set instead of the full product/category set -- each
  // unused size is a full sharp resize+encode+disk-write for nothing,
  // and was the real cause of a 30s+ request timeout when a collection
  // update processed an image and a banner (2 files x 4 unused sizes).
  sizes: Record<
    string,
    { width: number; height: number; fit: keyof sharp.FitEnum }
  > = IMAGE_SIZES,
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
  for (const [sizeName, config] of Object.entries(sizes)) {
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
 * Process a collection (product_collections / category_collections) image
 * or banner upload -- same shape as processCategoryImage/processProductImage,
 * just its own destination folder. Both collection types share this: a
 * collection only ever stores a single URL per field (image_url/banner_url
 * columns), not a category_media-style multi-row/multi-purpose table, so
 * the caller picks whichever optimized variant it wants (typically
 * `optimized.large` for a banner) rather than this function choosing one.
 */
export async function processCollectionImage(file: Express.Multer.File) {
  const filename = `${uuidv4()}.webp`
  const destinationFolder = `${UPLOAD_DIR}/collections/images`

  // Only 'large' is ever read by callers -- see resolveCollectionImages.
  const result = await optimizeImage(file.path, destinationFolder, filename, {
    large: IMAGE_SIZES.large,
  })

  // Delete temp file
  await fs.unlink(file.path)

  return result
}

/**
 * Process a hero slide image upload -- same shape as processCollectionImage
 * (only the 'large' variant is ever read by callers), its own destination
 * folder since a hero slide is its own entity, not a collection.
 */
export async function processHeroSlideImage(file: Express.Multer.File) {
  const filename = `${uuidv4()}.webp`
  const destinationFolder = `${UPLOAD_DIR}/hero-slides/images`

  const result = await optimizeImage(file.path, destinationFolder, filename, {
    large: IMAGE_SIZES.large,
  })

  // Delete temp file
  await fs.unlink(file.path)

  return result
}

/**
 * Process a Discover feed post image -- same shape as processHeroSlideImage
 * (only the 'large' variant is ever read), used both for a video post's
 * admin-supplied poster and for each image in an image-carousel post.
 */
export async function processDiscoverImage(file: Express.Multer.File) {
  const filename = `${uuidv4()}.webp`
  const destinationFolder = `${UPLOAD_DIR}/discover/images`

  const result = await optimizeImage(file.path, destinationFolder, filename, {
    large: IMAGE_SIZES.large,
  })

  // Delete temp file
  await fs.unlink(file.path)

  return result
}

const TRANSCODE_TIMEOUT_MS = 5 * 60 * 1000 // 5 minutes -- generous for a short feed clip, bounded so a corrupt/huge upload can't hang the request forever

/**
 * Normalize any admin-uploaded video to broadly-playable H.264/AAC MP4.
 * Real necessity, not gold-plating: admin phones commonly produce
 * HEVC-in-.mov (iPhone default), which most non-Safari browsers can't
 * decode at all -- passing that through unmodified (the old behavior)
 * meant the <video> element silently never played, no error, just a
 * frozen poster frame forever. `-movflags +faststart` also moves the
 * moov atom to the front so playback can start before the whole file
 * downloads, which matters for a feed you scroll through quickly.
 */
// Shells out to the system ffmpeg binary directly (installed via apt/apk,
// see Dockerfile/Dockerfile.dev) rather than through a wrapper library --
// fluent-ffmpeg, the usual choice for this, is flagged deprecated/
// unmaintained on npm, and these calls are simple enough (one input, a
// fixed arg list, wait for exit) that spawning ffmpeg directly avoids
// that dependency for no real loss of clarity. Shared by both the video
// and audio transcode paths below.
function runFfmpeg(args: string[], timeoutMs: number, timeoutMessage: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn('ffmpeg', args)
    let stderr = ''
    proc.stderr.on('data', (chunk) => {
      stderr += chunk.toString()
    })

    const timeout = setTimeout(() => {
      proc.kill('SIGKILL')
      reject(new Error(timeoutMessage))
    }, timeoutMs)

    proc.on('error', (err) => {
      clearTimeout(timeout)
      reject(err)
    })

    proc.on('close', (code) => {
      clearTimeout(timeout)
      if (code === 0) resolve()
      else reject(new Error(`ffmpeg exited with code ${code}: ${stderr.slice(-500)}`))
    })
  })
}

function transcodeToH264Mp4(inputPath: string, outputPath: string): Promise<void> {
  return runFfmpeg(
    [
      '-y',
      '-i', inputPath,
      '-c:v', 'libx264',
      '-profile:v', 'main',
      '-preset', 'veryfast',
      '-crf', '23',
      '-pix_fmt', 'yuv420p',
      // Cap both dimensions at 1080 without upscaling smaller clips
      // (force_original_aspect_ratio=decrease keeps whichever edge is
      // the real constraint); force_divisible_by=2 rounds to an even
      // number, which yuv420p/libx264 require.
      '-vf', "scale='min(1080,iw)':'min(1080,ih)':force_original_aspect_ratio=decrease:force_divisible_by=2",
      '-c:a', 'aac',
      '-b:a', '128k',
      // Moves the moov atom to the front so playback can start before the
      // whole file downloads -- matters for a feed you scroll through fast.
      '-movflags', '+faststart',
      outputPath,
    ],
    TRANSCODE_TIMEOUT_MS,
    'Video processing timed out',
  )
}

function transcodeToAacM4a(inputPath: string, outputPath: string): Promise<void> {
  return runFfmpeg(
    [
      '-y',
      '-i', inputPath,
      '-vn', // strip any video/cover-art stream -- audio only
      '-c:a', 'aac',
      '-b:a', '192k',
      '-movflags', '+faststart',
      outputPath,
    ],
    TRANSCODE_TIMEOUT_MS,
    'Audio processing timed out',
  )
}

/**
 * Process a Discover feed post video upload -- same shape as
 * processBlogVideo, plus a real transcode step (see transcodeToH264Mp4)
 * so whatever container/codec the admin's device produced always ends up
 * as playable H.264/AAC MP4. No thumbnailUrl here (unlike
 * processBlogVideo/processVideo's unused placeholder field): Discover
 * posts require an admin-supplied poster image instead, since no ffmpeg
 * thumbnail extraction exists in this codebase -- see processDiscoverImage
 * above.
 */
export async function processDiscoverVideo(file: Express.Multer.File): Promise<{
  url: string
  fileName: string
  fileSize: number
  format: string
}> {
  const videoId = uuidv4()
  const fileName = `${videoId}.mp4`
  const transcodedPath = `${UPLOAD_DIR}/temp/${videoId}-transcoded.mp4`

  try {
    await transcodeToH264Mp4(file.path, transcodedPath)
  } catch (err) {
    await fs.unlink(file.path).catch(() => undefined)
    await fs.unlink(transcodedPath).catch(() => undefined)
    throw new Error(
      'Video: could not process this file -- it may be corrupted or in an unsupported format. Please upload a standard MP4 or MOV video.',
    )
  }

  const stats = await fs.stat(transcodedPath)
  const uploadedVideo = await storeMediaFile({
    localPath: transcodedPath,
    key: `discover/videos/${fileName}`,
    contentType: 'video/mp4',
    cacheControl: 'public, max-age=31536000, immutable',
    resourceType: 'video',
  })

  await fs.unlink(file.path).catch(() => undefined)
  await fs.unlink(transcodedPath).catch(() => undefined)

  return {
    url: uploadedVideo.url,
    fileName,
    fileSize: stats.size,
    format: 'mp4',
  }
}

/**
 * Process a Discover feed post's optional background audio upload --
 * admin's own track, not a licensed music catalog (this store has no
 * rights to one). Same reasoning as processDiscoverVideo: normalize
 * whatever container the admin uploaded (mp3/wav/ogg/webm/etc.) to AAC
 * in an .m4a container, so playback support isn't a lottery across
 * browsers/devices.
 */
export async function processDiscoverAudio(file: Express.Multer.File): Promise<{
  url: string
  fileName: string
  fileSize: number
  format: string
}> {
  const audioId = uuidv4()
  const fileName = `${audioId}.m4a`
  const transcodedPath = `${UPLOAD_DIR}/temp/${audioId}-transcoded.m4a`

  try {
    await transcodeToAacM4a(file.path, transcodedPath)
  } catch (err) {
    await fs.unlink(file.path).catch(() => undefined)
    await fs.unlink(transcodedPath).catch(() => undefined)
    throw new Error(
      'Audio: could not process this file -- it may be corrupted or in an unsupported format. Please upload a standard MP3 or WAV file.',
    )
  }

  const stats = await fs.stat(transcodedPath)
  const uploadedAudio = await storeMediaFile({
    localPath: transcodedPath,
    key: `discover/audio/${fileName}`,
    contentType: 'audio/mp4',
    cacheControl: 'public, max-age=31536000, immutable',
    resourceType: 'video', // Cloudinary has no distinct "audio" resource type -- audio-only files upload through its video endpoint by design; local storage ignores this field entirely
  })

  await fs.unlink(file.path).catch(() => undefined)
  await fs.unlink(transcodedPath).catch(() => undefined)

  return {
    url: uploadedAudio.url,
    fileName,
    fileSize: stats.size,
    format: 'm4a',
  }
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
 * Validate audio file (Discover post background track)
 */
export function validateAudioFile(file: Express.Multer.File): {
  valid: boolean
  error?: string
} {
  if (!ALLOWED_AUDIO_TYPES.includes(file.mimetype)) {
    return {
      valid: false,
      error: `Invalid audio type. Allowed types: ${ALLOWED_AUDIO_TYPES.join(
        ', ',
      )}`,
    }
  }

  if (file.size > MAX_AUDIO_SIZE) {
    return {
      valid: false,
      error: `Audio size exceeds maximum allowed size of ${
        MAX_AUDIO_SIZE / 1024 / 1024
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
