import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import { createHash } from 'crypto'
import fs from 'fs/promises'
import path from 'path'

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
