import { __processChannelProductSyncTickForTests as processTick } from './channel-product-sync.worker'
import { query } from '../../database/connection'
import * as channelSyncService from './channel-sync.service'

jest.mock('../../database/connection', () => ({ query: jest.fn() }))
jest.mock('../../utils/logger', () => ({
  __esModule: true,
  default: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}))
jest.mock('./channel-sync.service', () => ({ previewProductSync: jest.fn() }))

const mockQuery = query as jest.Mock
const mockPreviewProductSync = channelSyncService.previewProductSync as jest.Mock

describe('channel-product-sync.worker -- automatic preview refresh, never commits', () => {
  beforeEach(() => jest.clearAllMocks())

  it('calls previewProductSync (read + diff only) for every CONNECTED, non-disabled channel account', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'account-1' }, { id: 'account-2' }] })
    mockPreviewProductSync.mockResolvedValue({ runId: 'run-x', totalItems: 0, toCreate: 0, toUpdate: 0, unmapped: 0 })

    await processTick()

    expect(mockPreviewProductSync).toHaveBeenCalledTimes(2)
    expect(mockPreviewProductSync).toHaveBeenCalledWith('account-1', null)
    expect(mockPreviewProductSync).toHaveBeenCalledWith('account-2', null)
  })

  it('only selects CONNECTED, non-disabled accounts', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] })
    await processTick()
    expect(mockQuery.mock.calls[0][0]).toContain("status = 'CONNECTED'")
    expect(mockQuery.mock.calls[0][0]).toContain('disabled_by_admin = false')
  })

  it('never calls anything named commit -- this worker only ever previews', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'account-1' }] })
    mockPreviewProductSync.mockResolvedValue({ runId: 'run-x', totalItems: 0, toCreate: 0, toUpdate: 0, unmapped: 0 })

    await processTick()

    const calledMethodNames = Object.keys(channelSyncService).filter((key) => (channelSyncService as any)[key].mock?.calls?.length > 0)
    expect(calledMethodNames).toEqual(['previewProductSync'])
  })

  it('a failure previewing one account does not stop the others from being processed', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'account-1' }, { id: 'account-2' }] })
    mockPreviewProductSync
      .mockRejectedValueOnce(new Error('channel unreachable'))
      .mockResolvedValueOnce({ runId: 'run-x', totalItems: 0, toCreate: 0, toUpdate: 0, unmapped: 0 })

    await expect(processTick()).resolves.not.toThrow()
    expect(mockPreviewProductSync).toHaveBeenCalledTimes(2)
  })

  it('never crashes the tick when the initial account-listing query throws', async () => {
    mockQuery.mockRejectedValue(new Error('connection reset'))
    await expect(processTick()).resolves.not.toThrow()
  })
})
