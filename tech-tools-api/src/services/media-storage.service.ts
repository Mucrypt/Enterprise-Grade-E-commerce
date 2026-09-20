import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import { createHash } from 'crypto'
import fs from 'fs/promises'
import fsSync from 'fs'
import path from 'path'
import type { Readable } from 'stream'
import logger from '../utils/logger'

export type MediaStorageProvider = 'local' | 'r2' | 'cloudinary'
export type MediaResourceType = 'image' | 'video' | 'raw'

interface StoreMediaInput {
  key: string
  body: Buffer
  contentType: string
  cacheControl?: string
  resourceType?: MediaResourceType
}

interface StoreMediaFileInput {
  localPath: string
  key: string
  contentType: string
  cacheControl?: string
  resourceType?: MediaResourceType
}

interface StoredMediaResult {
  key: string
  url: string
}

const UPLOAD_DIR = process.env.UPLOAD_DIR || 'uploads'

function normalizeKey(key: string): string {
  return key.replace(/^\/+/, '').replace(/\\/g, '/')
}

function ensureProvider(value: string | undefined): MediaStorageProvider {
  const provider = (value || 'local').toLowerCase()
  if (provider === 'r2' || provider === 'cloudinary' || provider === 'local') {
    return provider
  }
  return 'local'
}

export function getMediaStorageProvider(): MediaStorageProvider {
  return ensureProvider(process.env.MEDIA_STORAGE_PROVIDER)
}

export function isAbsoluteMediaUrl(url: string): boolean {
  return /^https?:\/\//i.test(url)
}

function getLocalPathForKey(key: string): string {
  return path.join(UPLOAD_DIR, normalizeKey(key))
}

function getLocalUrlForKey(key: string): string {
  return `/${path.posix.join('media', normalizeKey(key))}`
}

async function storeLocalMedia(
  input: StoreMediaInput,
): Promise<StoredMediaResult> {
  const key = normalizeKey(input.key)
  const filePath = getLocalPathForKey(key)

  await fs.mkdir(path.dirname(filePath), { recursive: true })
  await fs.writeFile(filePath, input.body)

  return {
    key,
    url: getLocalUrlForKey(key),
  }
}

async function deleteLocalMedia(url: string): Promise<void> {
  const key = extractLocalMediaKey(url)
  if (!key) return

  await fs.unlink(getLocalPathForKey(key)).catch(() => undefined)
}

function extractLocalMediaKey(url: string): string | null {
  if (!url) return null

  if (isAbsoluteMediaUrl(url)) {
    const parsed = new URL(url)
    if (!parsed.pathname.startsWith('/media/')) return null
    return normalizeKey(parsed.pathname.slice('/media/'.length))
  }

  if (url.startsWith('/media/')) {
    return normalizeKey(url.slice('/media/'.length))
  }

  return normalizeKey(url)
}

function getRequiredEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`${name} is required for external media storage`)
  }
  return value
}

let r2Client: S3Client | null = null

function getR2Client(): S3Client {
  if (r2Client) {
    return r2Client
  }

  const endpoint =
    process.env.R2_ENDPOINT ||
    (process.env.R2_ACCOUNT_ID
      ? `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`
      : undefined)

  if (!endpoint) {
    throw new Error(
      'R2_ENDPOINT or R2_ACCOUNT_ID is required for MEDIA_STORAGE_PROVIDER=r2',
    )
  }

  r2Client = new S3Client({
    region: 'auto',
    endpoint,
    credentials: {
      accessKeyId: getRequiredEnv('R2_ACCESS_KEY_ID'),
      secretAccessKey: getRequiredEnv('R2_SECRET_ACCESS_KEY'),
    },
  })

  return r2Client
}

function getR2BucketName(): string {
  return getRequiredEnv('R2_BUCKET_NAME')
}

function getR2PublicBaseUrl(): string {
  const baseUrl = process.env.R2_PUBLIC_URL || process.env.MEDIA_CDN_BASE_URL
  if (!baseUrl) {
    throw new Error(
      'R2_PUBLIC_URL or MEDIA_CDN_BASE_URL is required for MEDIA_STORAGE_PROVIDER=r2',
    )
  }
  return baseUrl.replace(/\/$/, '')
}

function buildR2PublicUrl(key: string): string {
  return `${getR2PublicBaseUrl()}/${normalizeKey(key)}`
}

async function storeR2Media(
  input: StoreMediaInput,
): Promise<StoredMediaResult> {
  const key = normalizeKey(input.key)

  await getR2Client().send(
    new PutObjectCommand({
      Bucket: getR2BucketName(),
      Key: key,
      Body: input.body,
      ContentType: input.contentType,
      CacheControl: input.cacheControl,
    }),
  )

  return {
    key,
    url: buildR2PublicUrl(key),
  }
}

function extractR2Key(url: string): string | null {
  if (!url) return null

  const publicBaseUrl = getR2PublicBaseUrl()
  if (!url.startsWith(publicBaseUrl)) {
    return null
  }

  const base = new URL(publicBaseUrl)
  const parsed = new URL(url)
  const basePath = base.pathname.replace(/\/$/, '')
  const keyPath = parsed.pathname.startsWith(basePath)
    ? parsed.pathname.slice(basePath.length)
    : parsed.pathname

  return normalizeKey(keyPath)
}

async function deleteR2Media(url: string): Promise<void> {
  const key = extractR2Key(url)
  if (!key) return

  await getR2Client().send(
    new DeleteObjectCommand({
      Bucket: getR2BucketName(),
      Key: key,
    }),
  )
}

/**
 * Derives an adaptive-bitrate HLS manifest URL from an already-uploaded
 * Cloudinary video, via URL transformation only -- no re-upload, no new
 * storage infra. `sp_auto` tells Cloudinary to generate (and cache) a
 * multi-bitrate streaming profile on first request; the extension swap
 * to .m3u8 is what actually requests the manifest instead of the raw
 * file. Returns null for anything that isn't a Cloudinary delivery URL
 * (local/R2 storage, or a malformed URL) -- callers should treat that as
 * "no streaming variant available" and fall back to the plain video URL,
 * never throw.
 */
export function getCloudinaryStreamingUrl(videoUrl: string | null | undefined): string | null {
  if (!videoUrl) return null

  try {
    const parsed = new URL(videoUrl)
    if (!parsed.hostname.endsWith('res.cloudinary.com')) return null

    const uploadMarker = '/upload/'
    const uploadIndex = parsed.pathname.indexOf(uploadMarker)
    if (uploadIndex === -1) return null

    const before = parsed.pathname.slice(0, uploadIndex + uploadMarker.length)
    const after = parsed.pathname.slice(uploadIndex + uploadMarker.length)
    if (!after) return null

    const asManifest = after.replace(/\.[^./]+$/, '.m3u8')
    return `${parsed.origin}${before}sp_auto/${asManifest}`
  } catch {
    return null
  }
}

function inferCloudinaryResourceType(url: string): MediaResourceType {
  if (url.includes('/video/upload/')) {
    return 'video'
  }

  return /\.(mp4|mov|mpe?g|avi|webm)$/i.test(url) ? 'video' : 'image'
}

function buildCloudinarySignature(params: Record<string, string>): string {
  const apiSecret = getRequiredEnv('CLOUDINARY_API_SECRET')
  const serialized = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== '')
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join('&')

  return createHash('sha1').update(`${serialized}${apiSecret}`).digest('hex')
}

function getCloudinaryCloudName(): string {
  return getRequiredEnv('CLOUDINARY_CLOUD_NAME')
}

function getCloudinaryApiKey(): string {
  return getRequiredEnv('CLOUDINARY_API_KEY')
}

function toCloudinaryPublicId(key: string): string {
  return normalizeKey(key).replace(/\.[^.]+$/, '')
}

function extractCloudinaryPublicId(url: string): string | null {
  if (!url) return null

  const parsed = new URL(url)
  const uploadIndex = parsed.pathname.indexOf('/upload/')
  if (uploadIndex === -1) return null

  const afterUpload = parsed.pathname.slice(uploadIndex + '/upload/'.length)
  const segments = afterUpload.split('/').filter(Boolean)
  if (segments.length === 0) return null

  const withoutVersion = /^v\d+$/.test(segments[0])
    ? segments.slice(1)
    : segments
  if (withoutVersion.length === 0) return null

  const lastSegment = withoutVersion[withoutVersion.length - 1]
  withoutVersion[withoutVersion.length - 1] = lastSegment.replace(
    /\.[^.]+$/,
    '',
  )

  return withoutVersion.join('/')
}

async function uploadToCloudinary(
  input: StoreMediaInput,
): Promise<StoredMediaResult> {
  const publicId = toCloudinaryPublicId(input.key)
  const timestamp = Math.floor(Date.now() / 1000).toString()
  const signature = buildCloudinarySignature({
    public_id: publicId,
    timestamp,
  })

  const formData = new FormData()
  formData.set(
    'file',
    new Blob([input.body], { type: input.contentType }),
    path.basename(input.key),
  )
  formData.set('api_key', getCloudinaryApiKey())
  formData.set('timestamp', timestamp)
  formData.set('signature', signature)
  formData.set('public_id', publicId)

  const resourceType = input.resourceType || 'image'
  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${getCloudinaryCloudName()}/${resourceType}/upload`,
    {
      method: 'POST',
      body: formData as any,
    },
  )

  if (!response.ok) {
    const details = await response.text()
    throw new Error(`Cloudinary upload failed: ${details}`)
  }

  const payload = (await response.json()) as { secure_url: string }

  return {
    key: publicId,
    url: payload.secure_url,
  }
}

async function deleteCloudinaryMedia(url: string): Promise<void> {
  const publicId = extractCloudinaryPublicId(url)
  if (!publicId) return

  const timestamp = Math.floor(Date.now() / 1000).toString()
  const signature = buildCloudinarySignature({
    public_id: publicId,
    timestamp,
  })

  const formData = new FormData()
  formData.set('api_key', getCloudinaryApiKey())
  formData.set('timestamp', timestamp)
  formData.set('signature', signature)
  formData.set('public_id', publicId)

  const resourceType = inferCloudinaryResourceType(url)
  await fetch(
    `https://api.cloudinary.com/v1_1/${getCloudinaryCloudName()}/${resourceType}/destroy`,
    {
      method: 'POST',
      body: formData as any,
    },
  )
}

export async function storeMediaBuffer(
  input: StoreMediaInput,
): Promise<StoredMediaResult> {
  const provider = getMediaStorageProvider()

  if (provider === 'r2') {
    return storeR2Media(input)
  }

  if (provider === 'cloudinary') {
    return uploadToCloudinary(input)
  }

  return storeLocalMedia(input)
}

export async function storeMediaFile(
  input: StoreMediaFileInput,
): Promise<StoredMediaResult> {
  const body = await fs.readFile(input.localPath)

  return storeMediaBuffer({
    key: input.key,
    body,
    contentType: input.contentType,
    cacheControl: input.cacheControl,
    resourceType: input.resourceType,
  })
}

export async function deleteStoredMedia(url: string): Promise<void> {
  const provider = getMediaStorageProvider()

  if (provider === 'r2') {
    await deleteR2Media(url)
    return
  }

  if (provider === 'cloudinary') {
    await deleteCloudinaryMedia(url)
    return
  }

  await deleteLocalMedia(url)
}

// =====================================================
// Private media -- for seller verification documents. Deliberately a
// SEPARATE code path from everything above, not a flag on it: every
// function above always returns a public `url`, and src/app.ts serves
// the ENTIRE `UPLOAD_DIR` tree unauthenticated at `/media`. A "private"
// subfolder of that tree would still be publicly reachable. Private
// media therefore lives under its own directory that is never passed to
// `express.static`, and these functions never return a URL at all --
// only a (provider, key) pair that must be re-authorized and streamed
// through an authenticated route on every read.
//
// Cloudinary is deliberately excluded here: its delivery model in this
// codebase always yields a public CDN URL (see uploadToCloudinary
// above), and there is no private/signed-delivery mechanism for it
// anywhere in this codebase today. Building one is out of scope for
// this phase, so a request for provider='cloudinary' is coerced to
// 'local' with a loud warning rather than silently uploading a
// verification document somewhere public.
// =====================================================

export type PrivateMediaProvider = 'local' | 'r2'

const PRIVATE_UPLOAD_DIR = process.env.PRIVATE_UPLOAD_DIR || 'private-uploads'

export function getSellerDocumentsStorageProvider(): PrivateMediaProvider {
  const configured = (
    process.env.SELLER_DOCUMENTS_STORAGE_PROVIDER || process.env.MEDIA_STORAGE_PROVIDER || 'local'
  ).toLowerCase()

  if (configured === 'r2') return 'r2'
  if (configured === 'cloudinary') {
    logger.warn(
      'SELLER_DOCUMENTS_STORAGE_PROVIDER/MEDIA_STORAGE_PROVIDER=cloudinary has no private-delivery ' +
        'mechanism in this codebase -- storing verification documents on local disk instead.',
    )
    return 'local'
  }
  return 'local'
}

function getPrivateLocalPathForKey(key: string): string {
  return path.join(PRIVATE_UPLOAD_DIR, normalizeKey(key))
}

function getR2PrivateBucketName(): string {
  const dedicated = process.env.R2_PRIVATE_BUCKET_NAME
  if (dedicated) return dedicated
  // No safe fallback here -- assertPrivateMediaStorageIsSafe() below
  // refuses to let the app start using the R2 provider without a
  // dedicated bucket configured, so this line should be unreachable in
  // a running process. It still throws rather than silently returning
  // the public bucket, in case this function is ever called from a path
  // that bypassed that startup check (e.g. a future test or script).
  throw new Error(
    'R2_PRIVATE_BUCKET_NAME must be set to use the r2 provider for seller documents -- ' +
      'falling back to the public media bucket would let a verification document be reachable ' +
      'through that bucket\'s own public delivery domain, bypassing streamPrivateMedia entirely.',
  )
}

// =====================================================
// Fail-closed startup safety checks -- called once from src/index.ts
// before the server starts accepting requests. Every check here guards
// against a misconfiguration that would silently make a verification
// document publicly reachable:
//
//  1. PRIVATE_UPLOAD_DIR must not equal, contain, or be contained by
//     UPLOAD_DIR -- src/app.ts serves the ENTIRE UPLOAD_DIR tree
//     unauthenticated at /media, so any overlap between the two would
//     make private documents reachable through that static mount.
//  2. If the local provider is in use, the private directory must
//     actually be creatable/writable -- fatal in production (a
//     misconfigured/read-only volume must stop the app from starting,
//     not silently start accepting uploads that go nowhere safe), a
//     warning otherwise (so local dev without a real volume mounted
//     still boots).
//  3. If the R2 provider is in use, a DEDICATED private bucket must be
//     configured and must differ from the public media bucket -- this
//     is a structural safety property, not an availability one, so it
//     is fatal in every environment, not just production.
// =====================================================

function resolvedAbsolutePath(dir: string): string {
  return path.resolve(process.cwd(), dir)
}

function pathsCollide(a: string, b: string): boolean {
  if (a === b) return true
  // Segment-boundary aware containment check -- `/app/uploads` must not
  // be flagged as containing `/app/uploads-extra`, only `/app/uploads/x`.
  const aWithSep = a.endsWith(path.sep) ? a : a + path.sep
  const bWithSep = b.endsWith(path.sep) ? b : b + path.sep
  return b.startsWith(aWithSep) || a.startsWith(bWithSep)
}

export async function assertPrivateMediaStorageIsSafe(): Promise<void> {
  const isProduction = process.env.NODE_ENV === 'production'

  const publicDir = resolvedAbsolutePath(UPLOAD_DIR)
  const privateDir = resolvedAbsolutePath(PRIVATE_UPLOAD_DIR)

  if (pathsCollide(publicDir, privateDir)) {
    throw new Error(
      `PRIVATE_UPLOAD_DIR ("${privateDir}") must not equal or nest inside/around UPLOAD_DIR ` +
        `("${publicDir}") -- that directory is served unauthenticated at /media (see src/app.ts), ` +
        'so any overlap would make verification documents publicly reachable.',
    )
  }

  const provider = getSellerDocumentsStorageProvider()

  if (provider === 'local') {
    try {
      await fs.mkdir(privateDir, { recursive: true })
      const probeKey = `.startup-write-check-${Date.now()}`
      const probePath = path.join(privateDir, probeKey)
      await fs.writeFile(probePath, 'ok')
      await fs.unlink(probePath)
    } catch (error) {
      const message = `Private document storage directory "${privateDir}" is missing or not writable: ${
        (error as Error).message
      }`
      if (isProduction) throw new Error(message)
      logger.warn(message)
    }
  }

  if (provider === 'r2') {
    const dedicated = process.env.R2_PRIVATE_BUCKET_NAME
    if (!dedicated || dedicated === process.env.R2_BUCKET_NAME) {
      throw new Error(
        'R2_PRIVATE_BUCKET_NAME must be set to a bucket DIFFERENT from R2_BUCKET_NAME to store seller ' +
          'verification documents on R2 -- reusing the public media bucket would let a document be ' +
          "reachable through that bucket's own public delivery domain, bypassing this app's " +
          'authorization checks entirely.',
      )
    }
  }
}

export interface StorePrivateMediaInput {
  key: string
  body: Buffer
  contentType: string
}

export interface StoredPrivateMediaResult {
  provider: PrivateMediaProvider
  key: string
}

export async function storePrivateMediaBuffer(
  input: StorePrivateMediaInput,
): Promise<StoredPrivateMediaResult> {
  const provider = getSellerDocumentsStorageProvider()
  const key = normalizeKey(input.key)

  if (provider === 'r2') {
    await getR2Client().send(
      new PutObjectCommand({
        Bucket: getR2PrivateBucketName(),
        Key: key,
        Body: input.body,
        ContentType: input.contentType,
      }),
    )
    return { provider: 'r2', key }
  }

  const filePath = getPrivateLocalPathForKey(key)
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  await fs.writeFile(filePath, input.body)
  return { provider: 'local', key }
}

export interface StreamedPrivateMedia {
  stream: Readable
  contentLength?: number
}

export async function streamPrivateMedia(
  provider: PrivateMediaProvider,
  key: string,
): Promise<StreamedPrivateMedia> {
  const normalizedKey = normalizeKey(key)

  if (provider === 'r2') {
    const result = await getR2Client().send(
      new GetObjectCommand({ Bucket: getR2PrivateBucketName(), Key: normalizedKey }),
    )
    return {
      stream: result.Body as Readable,
      contentLength: result.ContentLength,
    }
  }

  const filePath = getPrivateLocalPathForKey(normalizedKey)
  const stat = await fs.stat(filePath)
  return {
    stream: fsSync.createReadStream(filePath),
    contentLength: stat.size,
  }
}

export async function deletePrivateMedia(provider: PrivateMediaProvider, key: string): Promise<void> {
  const normalizedKey = normalizeKey(key)

  if (provider === 'r2') {
    await getR2Client().send(
      new DeleteObjectCommand({ Bucket: getR2PrivateBucketName(), Key: normalizedKey }),
    )
    return
  }

  await fs.unlink(getPrivateLocalPathForKey(normalizedKey)).catch(() => undefined)
}
