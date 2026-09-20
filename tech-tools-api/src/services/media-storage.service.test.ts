import fs from 'fs/promises'
import fsSync from 'fs'
import os from 'os'
import path from 'path'

jest.mock('../utils/logger', () => ({
  __esModule: true,
  default: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}))

// Real filesystem, real temp directories -- this is the single most
// important regression guard in this phase: src/app.ts serves the
// ENTIRE UPLOAD_DIR tree unauthenticated at /media (confirmed by
// reading app.ts directly), so private/verification-document storage
// must never write under it, and must never hand back a `url` the way
// every public-media function in this file does.
function loadServiceFresh(env: Record<string, string | undefined>) {
  jest.resetModules()
  for (const [key, value] of Object.entries(env)) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require('./media-storage.service') as typeof import('./media-storage.service')
}

describe('media-storage.service -- private document storage', () => {
  let uploadDir: string
  let privateUploadDir: string

  beforeEach(async () => {
    uploadDir = await fs.mkdtemp(path.join(os.tmpdir(), 'public-uploads-'))
    privateUploadDir = await fs.mkdtemp(path.join(os.tmpdir(), 'private-uploads-'))
  })

  afterEach(async () => {
    await fs.rm(uploadDir, { recursive: true, force: true })
    await fs.rm(privateUploadDir, { recursive: true, force: true })
    delete process.env.UPLOAD_DIR
    delete process.env.PRIVATE_UPLOAD_DIR
    delete process.env.MEDIA_STORAGE_PROVIDER
    delete process.env.SELLER_DOCUMENTS_STORAGE_PROVIDER
  })

  it('storePrivateMediaBuffer never returns a url, and writes under PRIVATE_UPLOAD_DIR, never UPLOAD_DIR', async () => {
    const service = loadServiceFresh({
      UPLOAD_DIR: uploadDir,
      PRIVATE_UPLOAD_DIR: privateUploadDir,
      MEDIA_STORAGE_PROVIDER: 'local',
    })

    const result = await service.storePrivateMediaBuffer({
      key: 'seller-documents/sp-1/doc.pdf',
      body: Buffer.from('fake pdf bytes'),
      contentType: 'application/pdf',
    })

    expect(result).toEqual({ provider: 'local', key: 'seller-documents/sp-1/doc.pdf' })
    expect((result as any).url).toBeUndefined()

    const writtenUnderPrivate = path.join(privateUploadDir, 'seller-documents/sp-1/doc.pdf')
    const writtenUnderPublic = path.join(uploadDir, 'seller-documents/sp-1/doc.pdf')

    await expect(fs.access(writtenUnderPrivate)).resolves.toBeUndefined()
    await expect(fs.access(writtenUnderPublic)).rejects.toThrow()
  })

  it('streamPrivateMedia reads back exactly what storePrivateMediaBuffer wrote', async () => {
    const service = loadServiceFresh({
      UPLOAD_DIR: uploadDir,
      PRIVATE_UPLOAD_DIR: privateUploadDir,
      MEDIA_STORAGE_PROVIDER: 'local',
    })

    const body = Buffer.from('identity document contents')
    await service.storePrivateMediaBuffer({ key: 'doc-1.jpg', body, contentType: 'image/jpeg' })

    const { stream, contentLength } = await service.streamPrivateMedia('local', 'doc-1.jpg')
    expect(contentLength).toBe(body.length)

    const chunks: Buffer[] = []
    for await (const chunk of stream as fsSync.ReadStream) chunks.push(chunk as Buffer)
    expect(Buffer.concat(chunks).toString()).toBe('identity document contents')
  })

  it('coerces MEDIA_STORAGE_PROVIDER=cloudinary to local for seller documents (no private-delivery mechanism exists for it)', async () => {
    const service = loadServiceFresh({
      UPLOAD_DIR: uploadDir,
      PRIVATE_UPLOAD_DIR: privateUploadDir,
      MEDIA_STORAGE_PROVIDER: 'cloudinary',
    })

    expect(service.getSellerDocumentsStorageProvider()).toBe('local')
  })

  it('a dedicated SELLER_DOCUMENTS_STORAGE_PROVIDER overrides the general MEDIA_STORAGE_PROVIDER', async () => {
    const service = loadServiceFresh({
      UPLOAD_DIR: uploadDir,
      PRIVATE_UPLOAD_DIR: privateUploadDir,
      MEDIA_STORAGE_PROVIDER: 'local',
      SELLER_DOCUMENTS_STORAGE_PROVIDER: 'r2',
    })

    expect(service.getSellerDocumentsStorageProvider()).toBe('r2')
  })

  it('deletePrivateMedia removes the file from private storage only', async () => {
    const service = loadServiceFresh({
      UPLOAD_DIR: uploadDir,
      PRIVATE_UPLOAD_DIR: privateUploadDir,
      MEDIA_STORAGE_PROVIDER: 'local',
    })

    await service.storePrivateMediaBuffer({ key: 'to-delete.png', body: Buffer.from('x'), contentType: 'image/png' })
    await service.deletePrivateMedia('local', 'to-delete.png')

    await expect(fs.access(path.join(privateUploadDir, 'to-delete.png'))).rejects.toThrow()
  })
})

describe('media-storage.service -- assertPrivateMediaStorageIsSafe (fail-closed startup checks)', () => {
  let uploadDir: string
  let privateUploadDir: string
  const originalNodeEnv = process.env.NODE_ENV

  beforeEach(async () => {
    uploadDir = await fs.mkdtemp(path.join(os.tmpdir(), 'public-uploads-'))
    privateUploadDir = await fs.mkdtemp(path.join(os.tmpdir(), 'private-uploads-'))
  })

  afterEach(async () => {
    await fs.rm(uploadDir, { recursive: true, force: true }).catch(() => undefined)
    await fs.rm(privateUploadDir, { recursive: true, force: true }).catch(() => undefined)
    delete process.env.UPLOAD_DIR
    delete process.env.PRIVATE_UPLOAD_DIR
    delete process.env.MEDIA_STORAGE_PROVIDER
    delete process.env.SELLER_DOCUMENTS_STORAGE_PROVIDER
    delete process.env.R2_PRIVATE_BUCKET_NAME
    delete process.env.R2_BUCKET_NAME
    process.env.NODE_ENV = originalNodeEnv
  })

  it('rejects PRIVATE_UPLOAD_DIR === UPLOAD_DIR', async () => {
    const service = loadServiceFresh({
      UPLOAD_DIR: uploadDir,
      PRIVATE_UPLOAD_DIR: uploadDir,
      MEDIA_STORAGE_PROVIDER: 'local',
    })

    await expect(service.assertPrivateMediaStorageIsSafe()).rejects.toThrow(/must not equal/)
  })

  it('rejects PRIVATE_UPLOAD_DIR nested inside UPLOAD_DIR', async () => {
    const nested = path.join(uploadDir, 'private')
    const service = loadServiceFresh({
      UPLOAD_DIR: uploadDir,
      PRIVATE_UPLOAD_DIR: nested,
      MEDIA_STORAGE_PROVIDER: 'local',
    })

    await expect(service.assertPrivateMediaStorageIsSafe()).rejects.toThrow(/must not equal/)
  })

  it('rejects UPLOAD_DIR nested inside PRIVATE_UPLOAD_DIR (containment checked both directions)', async () => {
    const nested = path.join(privateUploadDir, 'public')
    const service = loadServiceFresh({
      UPLOAD_DIR: nested,
      PRIVATE_UPLOAD_DIR: privateUploadDir,
      MEDIA_STORAGE_PROVIDER: 'local',
    })

    await expect(service.assertPrivateMediaStorageIsSafe()).rejects.toThrow(/must not equal/)
  })

  it('does NOT falsely flag a sibling directory that merely shares a name prefix (e.g. uploads vs uploads-extra)', async () => {
    const sibling = `${uploadDir}-extra`
    await fs.mkdir(sibling, { recursive: true })
    try {
      const service = loadServiceFresh({
        UPLOAD_DIR: uploadDir,
        PRIVATE_UPLOAD_DIR: sibling,
        MEDIA_STORAGE_PROVIDER: 'local',
      })
      await expect(service.assertPrivateMediaStorageIsSafe()).resolves.toBeUndefined()
    } finally {
      await fs.rm(sibling, { recursive: true, force: true })
    }
  })

  it('passes for two genuinely separate directories and leaves the private directory writable', async () => {
    const service = loadServiceFresh({
      UPLOAD_DIR: uploadDir,
      PRIVATE_UPLOAD_DIR: privateUploadDir,
      MEDIA_STORAGE_PROVIDER: 'local',
    })

    await expect(service.assertPrivateMediaStorageIsSafe()).resolves.toBeUndefined()
  })

  it('throws in production when the local private directory cannot be created/written', async () => {
    process.env.NODE_ENV = 'production'
    // Point PRIVATE_UPLOAD_DIR at a path that cannot be created: a file
    // (not a directory) sitting where a directory is expected.
    const blockingFile = path.join(os.tmpdir(), `blocking-file-${Date.now()}`)
    await fs.writeFile(blockingFile, 'x')
    try {
      const service = loadServiceFresh({
        UPLOAD_DIR: uploadDir,
        PRIVATE_UPLOAD_DIR: path.join(blockingFile, 'private'),
        MEDIA_STORAGE_PROVIDER: 'local',
      })

      await expect(service.assertPrivateMediaStorageIsSafe()).rejects.toThrow(/missing or not writable/)
    } finally {
      await fs.unlink(blockingFile).catch(() => undefined)
    }
  })

  it('only warns (does not throw) outside production for the same unwritable-directory condition', async () => {
    process.env.NODE_ENV = 'development'
    const blockingFile = path.join(os.tmpdir(), `blocking-file-${Date.now()}`)
    await fs.writeFile(blockingFile, 'x')
    try {
      const service = loadServiceFresh({
        UPLOAD_DIR: uploadDir,
        PRIVATE_UPLOAD_DIR: path.join(blockingFile, 'private'),
        MEDIA_STORAGE_PROVIDER: 'local',
      })

      await expect(service.assertPrivateMediaStorageIsSafe()).resolves.toBeUndefined()
    } finally {
      await fs.unlink(blockingFile).catch(() => undefined)
    }
  })

  it('rejects the R2 provider with no dedicated private bucket configured, in every environment', async () => {
    process.env.NODE_ENV = 'development'
    const service = loadServiceFresh({
      UPLOAD_DIR: uploadDir,
      PRIVATE_UPLOAD_DIR: privateUploadDir,
      MEDIA_STORAGE_PROVIDER: 'r2',
      R2_BUCKET_NAME: 'techtools-public-media',
    })

    await expect(service.assertPrivateMediaStorageIsSafe()).rejects.toThrow(/R2_PRIVATE_BUCKET_NAME/)
  })

  it('rejects the R2 provider when R2_PRIVATE_BUCKET_NAME equals the public R2_BUCKET_NAME', async () => {
    const service = loadServiceFresh({
      UPLOAD_DIR: uploadDir,
      PRIVATE_UPLOAD_DIR: privateUploadDir,
      MEDIA_STORAGE_PROVIDER: 'r2',
      R2_BUCKET_NAME: 'techtools-public-media',
      R2_PRIVATE_BUCKET_NAME: 'techtools-public-media',
    })

    await expect(service.assertPrivateMediaStorageIsSafe()).rejects.toThrow(/R2_PRIVATE_BUCKET_NAME/)
  })

  it('accepts the R2 provider when a genuinely distinct private bucket is configured', async () => {
    const service = loadServiceFresh({
      UPLOAD_DIR: uploadDir,
      PRIVATE_UPLOAD_DIR: privateUploadDir,
      MEDIA_STORAGE_PROVIDER: 'r2',
      R2_BUCKET_NAME: 'techtools-public-media',
      R2_PRIVATE_BUCKET_NAME: 'techtools-private-documents',
    })

    await expect(service.assertPrivateMediaStorageIsSafe()).resolves.toBeUndefined()
  })
})
