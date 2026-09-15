import { createHeroSlide, updateHeroSlide } from './hero-slides.controller'
import { query } from '../../../database/connection'

jest.mock('../../../database/connection', () => ({
  query: jest.fn(),
  getClient: jest.fn(),
}))
jest.mock('../../../utils/logger', () => ({
  __esModule: true,
  default: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}))

const mockQuery = query as jest.Mock

const makeRes = () => {
  const res: any = {}
  res.status = jest.fn(() => res)
  res.json = jest.fn(() => res)
  return res
}

const PRODUCT_ID = '11111111-1111-1111-1111-111111111111'

describe('createHeroSlide -- reference validation, no fabricated slides', () => {
  beforeEach(() => jest.clearAllMocks())

  it('rejects a "product" slide with no productId before touching the database', async () => {
    const req: any = { body: { slideType: 'product' }, files: undefined }
    const res = makeRes()

    await createHeroSlide(req, res)

    expect(mockQuery).not.toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, message: expect.stringContaining('a product') }),
    )
  })

  it('rejects a "category" slide with no categoryId before touching the database', async () => {
    const req: any = { body: { slideType: 'category' }, files: undefined }
    const res = makeRes()

    await createHeroSlide(req, res)

    expect(mockQuery).not.toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(400)
  })

  it('rejects an unknown slideType before touching the database', async () => {
    const req: any = { body: { slideType: 'not_a_real_type' }, files: undefined }
    const res = makeRes()

    await createHeroSlide(req, res)

    expect(mockQuery).not.toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(400)
  })

  it('allows a "custom" slide with no reference fields at all', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'hs1', slide_type: 'custom' }] })
    const req: any = { body: { slideType: 'custom', title: 'Sale' }, files: undefined }
    const res = makeRes()

    await createHeroSlide(req, res)

    expect(mockQuery).toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(201)
  })

  it('proceeds to the database once a required reference is actually supplied', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'hs1', slide_type: 'product', product_id: PRODUCT_ID }] })
    const req: any = { body: { slideType: 'product', productId: PRODUCT_ID }, files: undefined }
    const res = makeRes()

    await createHeroSlide(req, res)

    expect(mockQuery).toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(201)
  })

  it('translates a Postgres check-constraint violation (23514) into a clean 400, not a raw 500', async () => {
    mockQuery.mockRejectedValue({ code: '23514', message: 'valid_slide_reference violated' })
    const req: any = { body: { slideType: 'product', productId: PRODUCT_ID }, files: undefined }
    const res = makeRes()

    await createHeroSlide(req, res)

    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, message: expect.stringContaining('requires its matching reference') }),
    )
  })

  it('translates a Postgres foreign-key violation (23503) into a clean 400', async () => {
    mockQuery.mockRejectedValue({ code: '23503', message: 'products FK violated' })
    const req: any = { body: { slideType: 'product', productId: PRODUCT_ID }, files: undefined }
    const res = makeRes()

    await createHeroSlide(req, res)

    expect(res.status).toHaveBeenCalledWith(400)
  })

  it('still returns 500 for a genuinely unexpected database error', async () => {
    mockQuery.mockRejectedValue(new Error('connection reset'))
    const req: any = { body: { slideType: 'product', productId: PRODUCT_ID }, files: undefined }
    const res = makeRes()

    await createHeroSlide(req, res)

    expect(res.status).toHaveBeenCalledWith(500)
  })
})

describe('updateHeroSlide -- Postgres constraint errors translated, not leaked as 500', () => {
  beforeEach(() => jest.clearAllMocks())

  it('translates a check-constraint violation on update into a clean 400', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 'hs1' }] }) // slideCheck
      .mockRejectedValueOnce({ code: '23514', message: 'valid_slide_reference violated' }) // UPDATE
    const req: any = { params: { id: 'hs1' }, body: { productId: '' }, files: undefined }
    const res = makeRes()

    await updateHeroSlide(req, res)

    expect(res.status).toHaveBeenCalledWith(400)
  })
})
