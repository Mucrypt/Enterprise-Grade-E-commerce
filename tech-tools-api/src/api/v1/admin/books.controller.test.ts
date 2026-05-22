import { createAdminBook, uploadAdminBookAssets } from './books.controller'
import { query } from '../../../database/connection'

jest.mock('../../../database/connection', () => ({
  query: jest.fn(),
}))

jest.mock('../../../utils/logger', () => ({
  __esModule: true,
  default: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  },
}))

jest.mock('../../../utils/media', () => ({
  inferBookAssetFormat: jest.fn(() => 'pdf'),
  processBookAsset: jest.fn(async () => ({
    url: 'https://cdn.example.com/book.pdf',
    mimeType: 'application/pdf',
    fileSize: 1024,
    format: 'pdf',
  })),
  validateBookAssetFile: jest.fn(() => ({ valid: true })),
  uploadBookAssets: {
    array: jest.fn(),
  },
}))

const mockQuery = query as jest.Mock

const makeRes = () => {
  const res: any = {}
  res.status = jest.fn(() => res)
  res.json = jest.fn(() => res)
  return res
}

describe('admin books controller', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.ENABLE_BOOKS_WEB3 = 'true'
    process.env.ENABLE_ADMIN_BOOK_PUBLISHING = 'true'
  })

  it('denies direct publish for non-super-admin', async () => {
    const req: any = {
      user: { userId: 'admin-1', userType: 'admin' },
      body: {
        name: 'Admin Book',
        basePrice: 15,
        publicationAction: 'publish',
      },
    }
    const res = makeRes()

    await createAdminBook(req, res)

    expect(res.status).toHaveBeenCalledWith(403)
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
      }),
    )
  })

  it('creates admin book for super_admin', async () => {
    mockQuery.mockImplementation(async (sql: string, params: any[]) => {
      if (sql.includes('SELECT id FROM products WHERE slug')) {
        return { rows: [] }
      }

      if (sql.includes('information_schema.columns')) {
        return { rows: [{ exists: true }] }
      }

      if (sql.includes('INSERT INTO products')) {
        return {
          rows: [
            {
              id: 'book-1',
              sku: 'BOOK-1',
              name: 'Admin Book',
              slug: 'admin-book',
              product_kind: 'book',
              publication_status: 'draft',
            },
          ],
        }
      }

      if (sql.includes('SELECT to_regclass($1) AS regclass')) {
        const tableName = params?.[0]
        if (tableName === 'public.book_metadata') {
          return { rows: [{ regclass: null }] }
        }
        return { rows: [{ regclass: 'ok' }] }
      }

      return { rows: [] }
    })

    const req: any = {
      user: { userId: 'super-1', userType: 'super_admin' },
      ip: '127.0.0.1',
      headers: { 'user-agent': 'jest' },
      body: {
        name: 'Admin Book',
        basePrice: 15,
        publicationAction: 'publish',
      },
    }
    const res = makeRes()

    await createAdminBook(req, res)

    expect(res.status).toHaveBeenCalledWith(201)
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
      }),
    )
  })

  it('denies asset upload for non-admin-origin book', async () => {
    mockQuery.mockImplementation(async (sql: string, _params: any[]) => {
      if (sql.includes('information_schema.columns')) {
        return { rows: [{ exists: true }] }
      }

      if (sql.includes('SELECT id, admin_origin')) {
        return { rows: [{ id: 'book-1', admin_origin: false }] }
      }

      return { rows: [] }
    })

    const req: any = {
      user: { userId: 'admin-1', userType: 'admin' },
      params: { bookId: 'book-1' },
      body: {},
      files: [
        {
          originalname: 'book.pdf',
          mimetype: 'application/pdf',
          size: 1024,
          buffer: Buffer.from('x'),
        },
      ],
    }
    const res = makeRes()

    await uploadAdminBookAssets(req, res)

    expect(res.status).toHaveBeenCalledWith(403)
  })

  it('uploads assets for admin-origin book', async () => {
    mockQuery.mockImplementation(async (sql: string, params: any[]) => {
      if (sql.includes('information_schema.columns')) {
        const column = params?.[1]
        if (column === 'admin_origin') {
          return { rows: [{ exists: true }] }
        }
        if (column === 'format_key') {
          return { rows: [{ exists: true }] }
        }
        if (column === 'last_uploaded_by_admin_id') {
          return { rows: [{ exists: true }] }
        }
      }

      if (sql.includes('SELECT id, admin_origin')) {
        return { rows: [{ id: 'book-1', admin_origin: true }] }
      }

      if (sql.includes('INSERT INTO digital_assets')) {
        return {
          rows: [
            {
              id: 'asset-1',
              product_id: 'book-1',
              asset_type: 'full',
              storage_url: 'https://cdn.example.com/book.pdf',
            },
          ],
        }
      }

      return { rows: [] }
    })

    const req: any = {
      user: { userId: 'admin-1', userType: 'admin' },
      params: { bookId: 'book-1' },
      ip: '127.0.0.1',
      headers: { 'user-agent': 'jest' },
      body: {
        assetType: 'full',
        formatKey: 'pdf',
      },
      files: [
        {
          originalname: 'book.pdf',
          mimetype: 'application/pdf',
          size: 1024,
          buffer: Buffer.from('x'),
        },
      ],
    }
    const res = makeRes()

    await uploadAdminBookAssets(req, res)

    expect(res.status).toHaveBeenCalledWith(201)
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          assets: expect.any(Array),
        }),
      }),
    )
  })
})
