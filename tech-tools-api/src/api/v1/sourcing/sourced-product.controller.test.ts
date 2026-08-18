import {
  captureSourcedProduct,
  verifySourcingToken,
  listSourcedProductsHandler,
  getSourcedProduct,
  reviewSourcedProduct,
  regenerateSourcedProductRewrite,
  commitSourcedProductHandler,
  discardSourcedProductHandler,
} from './sourced-product.controller'
import * as sourcedProductService from '../../../services/sourcing/sourced-product.service'
import * as rewriteService from '../../../services/sourcing/sourcing-rewrite.service'

jest.mock('../../../utils/logger', () => ({
  __esModule: true,
  default: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}))
jest.mock('../../../services/sourcing/sourced-product.service', () => ({
  captureProduct: jest.fn(),
  listSourcedProducts: jest.fn(),
  getSourcedProductById: jest.fn(),
  updateReviewFields: jest.fn(),
  discardSourcedProduct: jest.fn(),
  commitSourcedProduct: jest.fn(),
}))
jest.mock('../../../services/sourcing/sourcing-rewrite.service', () => ({ regenerateRewrite: jest.fn() }))

const mockCaptureProduct = sourcedProductService.captureProduct as jest.Mock
const mockListSourcedProducts = sourcedProductService.listSourcedProducts as jest.Mock
const mockGetSourcedProductById = sourcedProductService.getSourcedProductById as jest.Mock
const mockUpdateReviewFields = sourcedProductService.updateReviewFields as jest.Mock
const mockDiscardSourcedProduct = sourcedProductService.discardSourcedProduct as jest.Mock
const mockCommitSourcedProduct = sourcedProductService.commitSourcedProduct as jest.Mock
const mockRegenerateRewrite = rewriteService.regenerateRewrite as jest.Mock

const makeRes = () => {
  const res: any = {}
  res.status = jest.fn(() => res)
  res.json = jest.fn(() => res)
  return res
}
const makeReq = (overrides: any = {}) => ({ user: { userId: 'user-1', userType: 'admin' }, body: {}, query: {}, params: {}, ...overrides })

describe('verifySourcingToken', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns the resolved email once authenticateSourcingToken has already validated the request', async () => {
    const req: any = makeReq({ user: { userId: 'user-1', userType: 'admin', email: 'founder@example.com' } })
    const res = makeRes()
    await verifySourcingToken(req, res)
    expect(res.json).toHaveBeenCalledWith({ success: true, email: 'founder@example.com' })
  })
})

describe('captureSourcedProduct', () => {
  beforeEach(() => jest.clearAllMocks())

  it('requires title, sourceUrl, and sourcePlatform', async () => {
    const req: any = makeReq({ body: { title: 'X' } })
    const res = makeRes()
    await captureSourcedProduct(req, res)
    expect(res.status).toHaveBeenCalledWith(400)
    expect(mockCaptureProduct).not.toHaveBeenCalled()
  })

  it('passes the sourcing token id through when the token middleware set one', async () => {
    mockCaptureProduct.mockResolvedValue({ id: 'sp-1' })
    const req: any = makeReq({ body: { title: 'X', sourceUrl: 'https://alibaba.com/x', sourcePlatform: 'alibaba' }, sourcingTokenId: 'token-1' })
    const res = makeRes()
    await captureSourcedProduct(req, res)
    expect(res.status).toHaveBeenCalledWith(201)
    expect(mockCaptureProduct).toHaveBeenCalledWith(req.body, 'user-1', 'token-1')
  })

  it('returns 400 (not 500) when the service throws a real validation error', async () => {
    mockCaptureProduct.mockRejectedValue(new Error('Captured product has no title'))
    const req: any = makeReq({ body: { title: 'X', sourceUrl: 'https://alibaba.com/x', sourcePlatform: 'alibaba' } })
    const res = makeRes()
    await captureSourcedProduct(req, res)
    expect(res.status).toHaveBeenCalledWith(400)
  })
})

describe('listSourcedProductsHandler', () => {
  beforeEach(() => jest.clearAllMocks())

  it('passes a status filter through when provided', async () => {
    mockListSourcedProducts.mockResolvedValue([])
    const req: any = makeReq({ query: { status: 'ready_for_review' } })
    await listSourcedProductsHandler(req, makeRes())
    expect(mockListSourcedProducts).toHaveBeenCalledWith({ status: 'ready_for_review' })
  })
})

describe('getSourcedProduct', () => {
  beforeEach(() => jest.clearAllMocks())

  it('404s when not found', async () => {
    mockGetSourcedProductById.mockResolvedValue(null)
    const req: any = makeReq({ params: { id: 'missing' } })
    const res = makeRes()
    await getSourcedProduct(req, res)
    expect(res.status).toHaveBeenCalledWith(404)
  })
})

describe('reviewSourcedProduct', () => {
  beforeEach(() => jest.clearAllMocks())

  it('forwards edit fields to the service', async () => {
    mockUpdateReviewFields.mockResolvedValue(undefined)
    const req: any = makeReq({ params: { id: 'sp-1' }, body: { reviewTitle: 'New title', finalSalePrice: 12.5 } })
    await reviewSourcedProduct(req, makeRes())
    expect(mockUpdateReviewFields).toHaveBeenCalledWith(
      'sp-1',
      { reviewTitle: 'New title', reviewDescriptionHtml: undefined, reviewImages: undefined, finalCostPrice: undefined, finalSalePrice: 12.5 },
      'user-1',
    )
  })

  it('returns 400 (not 500) when editing an already-committed row', async () => {
    mockUpdateReviewFields.mockRejectedValue(new Error('Cannot edit a sourced product that is already "committed"'))
    const req: any = makeReq({ params: { id: 'sp-1' }, body: {} })
    const res = makeRes()
    await reviewSourcedProduct(req, res)
    expect(res.status).toHaveBeenCalledWith(400)
  })
})

describe('regenerateSourcedProductRewrite', () => {
  beforeEach(() => jest.clearAllMocks())

  it('regenerates and returns the refreshed product', async () => {
    mockRegenerateRewrite.mockResolvedValue(undefined)
    mockGetSourcedProductById.mockResolvedValue({ id: 'sp-1', status: 'ready_for_review' })
    const req: any = makeReq({ params: { id: 'sp-1' } })
    const res = makeRes()
    await regenerateSourcedProductRewrite(req, res)
    expect(mockRegenerateRewrite).toHaveBeenCalledWith('sp-1')
    expect(res.json).toHaveBeenCalledWith({ success: true, product: { id: 'sp-1', status: 'ready_for_review' } })
  })
})

describe('commitSourcedProductHandler', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns the committed product id on success', async () => {
    mockCommitSourcedProduct.mockResolvedValue({ productId: 'product-1' })
    const req: any = makeReq({ params: { id: 'sp-1' } })
    const res = makeRes()
    await commitSourcedProductHandler(req, res)
    expect(res.json).toHaveBeenCalledWith({ success: true, data: { productId: 'product-1' } })
  })

  it('returns 400 (not 500) with the real reason when commit validation fails', async () => {
    mockCommitSourcedProduct.mockRejectedValue(new Error('Cannot commit: at least one image is required'))
    const req: any = makeReq({ params: { id: 'sp-1' } })
    const res = makeRes()
    await commitSourcedProductHandler(req, res)
    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json.mock.calls[0][0].error).toMatch(/image/i)
  })
})

describe('discardSourcedProductHandler', () => {
  beforeEach(() => jest.clearAllMocks())

  it('forwards the discard reason', async () => {
    mockDiscardSourcedProduct.mockResolvedValue(undefined)
    const req: any = makeReq({ params: { id: 'sp-1' }, body: { reason: 'duplicate' } })
    await discardSourcedProductHandler(req, makeRes())
    expect(mockDiscardSourcedProduct).toHaveBeenCalledWith('sp-1', 'duplicate', 'user-1')
  })
})
