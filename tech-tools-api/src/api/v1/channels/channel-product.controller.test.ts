import { listProductMappings, previewSync, commitSync } from './channel-product.controller'
import * as channelSyncService from '../../../services/channels/channel-sync.service'
import { query } from '../../../database/connection'

jest.mock('../../../database/connection', () => ({ query: jest.fn() }))
jest.mock('../../../utils/logger', () => ({
  __esModule: true,
  default: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}))
jest.mock('../../../services/channels/channel-sync.service', () => ({
  previewProductSync: jest.fn(),
  commitProductSync: jest.fn(),
}))

const mockQuery = query as jest.Mock
const mockPreview = channelSyncService.previewProductSync as jest.Mock
const mockCommit = channelSyncService.commitProductSync as jest.Mock

const makeRes = () => {
  const res: any = {}
  res.status = jest.fn(() => res)
  res.json = jest.fn(() => res)
  return res
}
const makeReq = (overrides: any = {}) => ({ user: { userId: 'user-1', userType: 'customer' }, body: {}, query: {}, ...overrides })

describe('listProductMappings', () => {
  beforeEach(() => jest.clearAllMocks())

  it('filters by channelAccountId when provided', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] })
    const req: any = makeReq({ query: { channelAccountId: 'account-1' } })
    await listProductMappings(req, makeRes())

    expect(mockQuery.mock.calls[0][0]).toContain('WHERE channel_account_id = $1')
    expect(mockQuery.mock.calls[0][1]).toEqual(['account-1'])
  })

  it('lists all mappings when no filter is provided', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] })
    const req: any = makeReq()
    await listProductMappings(req, makeRes())

    expect(mockQuery.mock.calls[0][0]).not.toContain('WHERE')
  })
})

describe('previewSync', () => {
  beforeEach(() => jest.clearAllMocks())

  it('requires channelAccountId', async () => {
    const req: any = makeReq({ body: {} })
    const res = makeRes()
    await previewSync(req, res)
    expect(res.status).toHaveBeenCalledWith(400)
  })

  it('returns 201 with the preview summary on success', async () => {
    mockPreview.mockResolvedValue({ runId: 'run-1', totalItems: 5, toCreate: 2, toUpdate: 3, unmapped: 1 })
    const req: any = makeReq({ body: { channelAccountId: 'account-1' } })
    const res = makeRes()
    await previewSync(req, res)

    expect(res.status).toHaveBeenCalledWith(201)
    expect(mockPreview).toHaveBeenCalledWith('account-1', 'user-1')
  })

  it('returns 400 (not 500) when the service throws a real, actionable error', async () => {
    mockPreview.mockRejectedValue(new Error('Channel account is not connected -- cannot preview a product sync.'))
    const req: any = makeReq({ body: { channelAccountId: 'account-1' } })
    const res = makeRes()
    await previewSync(req, res)

    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json.mock.calls[0][0].error).toMatch(/not connected/i)
  })
})

describe('commitSync', () => {
  beforeEach(() => jest.clearAllMocks())

  it('requires channelAccountId and runId', async () => {
    const req: any = makeReq({ body: { channelAccountId: 'account-1' } })
    const res = makeRes()
    await commitSync(req, res)
    expect(res.status).toHaveBeenCalledWith(400)
  })

  it('commits and returns the result summary', async () => {
    mockCommit.mockResolvedValue({ createdCount: 2, updatedCount: 3 })
    const req: any = makeReq({ body: { channelAccountId: 'account-1', runId: 'run-1' } })
    const res = makeRes()
    await commitSync(req, res)

    expect(mockCommit).toHaveBeenCalledWith('account-1', 'run-1', 'user-1')
    expect(res.json.mock.calls[0][0].success).toBe(true)
  })

  it('rejects re-committing an already-committed run with 400, not 500', async () => {
    mockCommit.mockRejectedValue(new Error('This sync run is already "committed" and cannot be committed again.'))
    const req: any = makeReq({ body: { channelAccountId: 'account-1', runId: 'run-1' } })
    const res = makeRes()
    await commitSync(req, res)

    expect(res.status).toHaveBeenCalledWith(400)
  })
})
