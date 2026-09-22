jest.mock('../database/connection', () => ({ query: jest.fn(), getClient: jest.fn() }))
jest.mock('../utils/logger', () => ({
  __esModule: true,
  default: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}))

const mockStorePrivateMediaBuffer = jest.fn()
const mockStreamPrivateMedia = jest.fn()
jest.mock('./media-storage.service', () => ({
  getSellerDocumentsStorageProvider: jest.fn(() => 'local'),
  storePrivateMediaBuffer: (...args: unknown[]) => mockStorePrivateMediaBuffer(...args),
  streamPrivateMedia: (...args: unknown[]) => mockStreamPrivateMedia(...args),
}))

const mockScanStream = jest.fn()
const mockClamInit = jest.fn()
jest.mock('clamscan', () => jest.fn().mockImplementation(() => ({ init: (...args: unknown[]) => mockClamInit(...args) })))

import { query, getClient } from '../database/connection'
import {
  uploadSellerDocument,
  getSellerDocumentForDownload,
  deleteSellerDocument,
  scanDocumentForMalware,
} from './seller-documents.service'

const mockQuery = query as jest.Mock
const mockGetClient = getClient as jest.Mock

const makeClient = () => ({ query: jest.fn(), release: jest.fn() })

// Real magic bytes for each format this endpoint accepts, so tests can
// prove the signature check (not just the declared Content-Type) gates
// the upload. Bodies are padded past each format's minimum sniff length.
const REAL_JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46])
const REAL_PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00])
const REAL_PDF = Buffer.from('%PDF-1.4\n%fake-but-correctly-signed-pdf')
const NOT_A_REAL_IMAGE = Buffer.from('<script>alert(1)</script>')

describe('seller-documents.service -- upload', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockStorePrivateMediaBuffer.mockResolvedValue({ provider: 'local', key: 'seller-documents/sp-1/uuid.jpg' })
  })

  it('generates a server-controlled storage key -- an adversarial client filename never reaches storage', async () => {
    const client = makeClient()
    client.query.mockImplementation(async (sql: string) => {
      if (sql === 'BEGIN' || sql === 'COMMIT') return { rows: [] }
      if (sql.includes('UPDATE seller_verification_documents')) return { rows: [] }
      if (sql.includes('SELECT id FROM seller_verification_documents')) return { rows: [] }
      if (sql.includes('INSERT INTO seller_verification_documents'))
        return {
          rows: [
            {
              id: 'doc-1',
              category: 'identity_document',
              upload_status: 'uploaded',
              review_status: 'pending',
              malware_scan_status: 'not_scanned',
              byte_size: 4,
              content_type: 'image/jpeg',
              created_at: '2026-01-01',
              reviewed_at: null,
            },
          ],
        }
      if (sql.includes('INSERT INTO seller_audit_log')) return { rows: [] }
      return { rows: [] }
    })
    mockGetClient.mockResolvedValue(client)

    await uploadSellerDocument({
      sellerProfileId: 'sp-1',
      userId: 'user-1',
      category: 'identity_document',
      fileBuffer: REAL_JPEG,
      contentType: 'image/jpeg',
      actor: { actorId: 'user-1', ip: null, userAgent: null },
    })

    // The key handed to storage is server-generated (uuid + extension
    // inferred from content-type) -- it never contains a filename the
    // client controls, and no filename is ever passed to storage at all.
    const storeCallArgs = mockStorePrivateMediaBuffer.mock.calls[0][0]
    expect(storeCallArgs.key).toMatch(
      /^seller-documents\/sp-1\/[0-9a-f-]{36}\.jpg$/,
    )
  })

  it('rejects an unsupported content type before ever calling storage', async () => {
    await expect(
      uploadSellerDocument({
        sellerProfileId: 'sp-1',
        userId: 'user-1',
        category: 'identity_document',
        fileBuffer: Buffer.from('fake'),
        contentType: 'application/x-msdownload',
        actor: { actorId: 'user-1', ip: null, userAgent: null },
      }),
    ).rejects.toThrow(/Unsupported document content type/)

    expect(mockStorePrivateMediaBuffer).not.toHaveBeenCalled()
    expect(mockGetClient).not.toHaveBeenCalled()
  })

  describe('file-signature verification -- never trusts the declared multipart MIME type alone', () => {
    it('rejects a file whose real bytes do not match its declared image/jpeg content-type', async () => {
      await expect(
        uploadSellerDocument({
          sellerProfileId: 'sp-1',
          userId: 'user-1',
          category: 'identity_document',
          fileBuffer: NOT_A_REAL_IMAGE,
          contentType: 'image/jpeg',
          actor: { actorId: 'user-1', ip: null, userAgent: null },
        }),
      ).rejects.toThrow(/does not match its declared type/)

      expect(mockStorePrivateMediaBuffer).not.toHaveBeenCalled()
      expect(mockGetClient).not.toHaveBeenCalled()
    })

    it('rejects a real PDF declared as image/png (cross-type spoofing, not just garbage bytes)', async () => {
      await expect(
        uploadSellerDocument({
          sellerProfileId: 'sp-1',
          userId: 'user-1',
          category: 'identity_document',
          fileBuffer: REAL_PDF,
          contentType: 'image/png',
          actor: { actorId: 'user-1', ip: null, userAgent: null },
        }),
      ).rejects.toThrow(/does not match its declared type/)
    })

    it('accepts a real PNG declared as image/png', async () => {
      const client = makeClient()
      client.query.mockImplementation(async (sql: string) => {
        if (sql === 'BEGIN' || sql === 'COMMIT') return { rows: [] }
        if (sql.includes('INSERT INTO seller_verification_documents'))
          return { rows: [{ id: 'doc-2', category: 'identity_document', upload_status: 'uploaded', review_status: 'pending', malware_scan_status: 'not_scanned', byte_size: REAL_PNG.length, content_type: 'image/png', created_at: '2026-01-01', reviewed_at: null }] }
        return { rows: [] }
      })
      mockGetClient.mockResolvedValue(client)

      const result = await uploadSellerDocument({
        sellerProfileId: 'sp-1',
        userId: 'user-1',
        category: 'identity_document',
        fileBuffer: REAL_PNG,
        contentType: 'image/png',
        actor: { actorId: 'user-1', ip: null, userAgent: null },
      })

      expect(result.id).toBe('doc-2')
      expect(mockStorePrivateMediaBuffer).toHaveBeenCalled()
    })

    it('accepts a real PDF declared as application/pdf', async () => {
      const client = makeClient()
      client.query.mockImplementation(async (sql: string) => {
        if (sql === 'BEGIN' || sql === 'COMMIT') return { rows: [] }
        if (sql.includes('INSERT INTO seller_verification_documents'))
          return { rows: [{ id: 'doc-3', category: 'business_registration', upload_status: 'uploaded', review_status: 'pending', malware_scan_status: 'not_scanned', byte_size: REAL_PDF.length, content_type: 'application/pdf', created_at: '2026-01-01', reviewed_at: null }] }
        return { rows: [] }
      })
      mockGetClient.mockResolvedValue(client)

      const result = await uploadSellerDocument({
        sellerProfileId: 'sp-1',
        userId: 'user-1',
        category: 'business_registration',
        fileBuffer: REAL_PDF,
        contentType: 'application/pdf',
        actor: { actorId: 'user-1', ip: null, userAgent: null },
      })

      expect(result.id).toBe('doc-3')
    })

    it('treats image/jpg and image/jpeg as the same real signature', async () => {
      const client = makeClient()
      client.query.mockImplementation(async (sql: string) => {
        if (sql === 'BEGIN' || sql === 'COMMIT') return { rows: [] }
        if (sql.includes('INSERT INTO seller_verification_documents'))
          return { rows: [{ id: 'doc-4', category: 'identity_document', upload_status: 'uploaded', review_status: 'pending', malware_scan_status: 'not_scanned', byte_size: REAL_JPEG.length, content_type: 'image/jpg', created_at: '2026-01-01', reviewed_at: null }] }
        return { rows: [] }
      })
      mockGetClient.mockResolvedValue(client)

      const result = await uploadSellerDocument({
        sellerProfileId: 'sp-1',
        userId: 'user-1',
        category: 'identity_document',
        fileBuffer: REAL_JPEG,
        contentType: 'image/jpg',
        actor: { actorId: 'user-1', ip: null, userAgent: null },
      })

      expect(result.id).toBe('doc-4')
    })
  })

  it('rejects an empty file before calling storage', async () => {
    await expect(
      uploadSellerDocument({
        sellerProfileId: 'sp-1',
        userId: 'user-1',
        category: 'identity_document',
        fileBuffer: Buffer.alloc(0),
        contentType: 'image/jpeg',
        actor: { actorId: 'user-1', ip: null, userAgent: null },
      }),
    ).rejects.toThrow(/Empty file/)

    expect(mockStorePrivateMediaBuffer).not.toHaveBeenCalled()
  })
})

describe('seller-documents.service -- ownership authorization (IDOR)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('getSellerDocumentForDownload returns null (not the file) when a non-owning, non-admin caller requests someone else\'s document', async () => {
    mockQuery.mockResolvedValue({
      rows: [{ id: 'doc-1', user_id: 'seller-A', storage_provider: 'local', storage_key: 'k', content_type: 'image/jpeg', category: 'identity_document' }],
    })

    const result = await getSellerDocumentForDownload('doc-1', { userId: 'seller-B', isAdmin: false })

    expect(result).toBeNull()
    expect(mockStreamPrivateMedia).not.toHaveBeenCalled()
  })

  it('getSellerDocumentForDownload succeeds for the owning seller', async () => {
    mockQuery.mockResolvedValue({
      rows: [{ id: 'doc-1', user_id: 'seller-A', storage_provider: 'local', storage_key: 'k', content_type: 'image/jpeg', category: 'identity_document' }],
    })
    mockStreamPrivateMedia.mockResolvedValue({ stream: 'a-stream', contentLength: 10 })

    const result = await getSellerDocumentForDownload('doc-1', { userId: 'seller-A', isAdmin: false })

    expect(result).not.toBeNull()
    expect(mockStreamPrivateMedia).toHaveBeenCalledWith('local', 'k')
  })

  it('getSellerDocumentForDownload succeeds for an admin regardless of ownership', async () => {
    mockQuery.mockResolvedValue({
      rows: [{ id: 'doc-1', user_id: 'seller-A', storage_provider: 'local', storage_key: 'k', content_type: 'image/jpeg', category: 'identity_document' }],
    })
    mockStreamPrivateMedia.mockResolvedValue({ stream: 'a-stream', contentLength: 10 })

    const result = await getSellerDocumentForDownload('doc-1', { isAdmin: true })

    expect(result).not.toBeNull()
  })

  it('deleteSellerDocument refuses (returns false) for a non-owning caller and never soft-deletes the row', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'doc-1', user_id: 'seller-A' }] })

    const deleted = await deleteSellerDocument('doc-1', { userId: 'seller-B', isAdmin: false }, { actorId: 'seller-B', ip: null, userAgent: null })

    expect(deleted).toBe(false)
    const updateCall = mockQuery.mock.calls.find((c: any[]) => c[0].includes('UPDATE seller_verification_documents'))
    expect(updateCall).toBeUndefined()
  })
})

describe('seller-documents.service -- scanDocumentForMalware (fail-closed contract)', () => {
  const originalClamavHost = process.env.CLAMAV_HOST

  beforeEach(() => {
    jest.clearAllMocks()
    mockClamInit.mockResolvedValue({ scanStream: mockScanStream })
    mockStreamPrivateMedia.mockResolvedValue({ stream: 'fake-stream' })
  })

  afterEach(() => {
    if (originalClamavHost === undefined) delete process.env.CLAMAV_HOST
    else process.env.CLAMAV_HOST = originalClamavHost
  })

  it('fails closed to "error" without attempting a network scan when no scanner is configured', async () => {
    delete process.env.CLAMAV_HOST
    mockQuery.mockResolvedValue({ rows: [] })

    await scanDocumentForMalware('doc-1')

    expect(mockStreamPrivateMedia).not.toHaveBeenCalled()
    expect(mockScanStream).not.toHaveBeenCalled()
    expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining("malware_scan_status = 'error'"), ['doc-1'])
  })

  it('marks a document clean when ClamAV reports no infection', async () => {
    process.env.CLAMAV_HOST = 'clamav'
    mockQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('SELECT storage_provider')) return { rows: [{ storage_provider: 'local', storage_key: 'k' }] }
      return { rows: [] }
    })
    mockScanStream.mockResolvedValue({ isInfected: false })

    await scanDocumentForMalware('doc-2')

    const updateCall = mockQuery.mock.calls.find((c: any[]) => c[0].includes('SET malware_scan_status'))
    expect(updateCall[1]).toEqual(['clean', 'doc-2'])
  })

  it('flags a document when ClamAV reports an infection -- never silently defaults to clean', async () => {
    process.env.CLAMAV_HOST = 'clamav'
    mockQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('SELECT storage_provider')) return { rows: [{ storage_provider: 'local', storage_key: 'k' }] }
      return { rows: [] }
    })
    mockScanStream.mockResolvedValue({ isInfected: true })

    await scanDocumentForMalware('doc-3')

    const updateCall = mockQuery.mock.calls.find((c: any[]) => c[0].includes('SET malware_scan_status'))
    expect(updateCall[1]).toEqual(['flagged', 'doc-3'])
  })

  it('fails closed to "error" (never "clean") when the scan connection itself fails', async () => {
    process.env.CLAMAV_HOST = 'clamav'
    mockQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('SELECT storage_provider')) return { rows: [{ storage_provider: 'local', storage_key: 'k' }] }
      return { rows: [] }
    })
    mockScanStream.mockRejectedValue(new Error('ECONNREFUSED'))

    await scanDocumentForMalware('doc-4')

    const updateCall = mockQuery.mock.calls.find((c: any[]) => c[0].includes('SET malware_scan_status'))
    expect(updateCall[1]).toEqual(['error', 'doc-4'])
  })

  it('fails closed to "error" when ClamAV returns an inconclusive (non-boolean) result', async () => {
    process.env.CLAMAV_HOST = 'clamav'
    mockQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('SELECT storage_provider')) return { rows: [{ storage_provider: 'local', storage_key: 'k' }] }
      return { rows: [] }
    })
    mockScanStream.mockResolvedValue({ isInfected: null })

    await scanDocumentForMalware('doc-5')

    const updateCall = mockQuery.mock.calls.find((c: any[]) => c[0].includes('SET malware_scan_status'))
    expect(updateCall[1]).toEqual(['error', 'doc-5'])
  })

  it('does nothing when the document was replaced/removed before the scan could run', async () => {
    process.env.CLAMAV_HOST = 'clamav'
    mockQuery.mockResolvedValue({ rows: [] })

    await scanDocumentForMalware('doc-6')

    expect(mockStreamPrivateMedia).not.toHaveBeenCalled()
    const updateCall = mockQuery.mock.calls.find((c: any[]) => c[0].includes('SET malware_scan_status'))
    expect(updateCall).toBeUndefined()
  })
})
