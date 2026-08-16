import { __processChannelInventoryDiffTickForTests as processTick } from './channel-inventory-diff.worker'
import { query } from '../../database/connection'
import * as channelSyncService from './channel-sync.service'

jest.mock('../../database/connection', () => ({ query: jest.fn() }))
jest.mock('../../utils/logger', () => ({
  __esModule: true,
  default: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}))
jest.mock('./channel-sync.service', () => ({ runInventoryDiff: jest.fn() }))

const mockQuery = query as jest.Mock
const mockRunInventoryDiff = channelSyncService.runInventoryDiff as jest.Mock

describe('channel-inventory-diff.worker -- automatic diff refresh, read-only', () => {
  beforeEach(() => jest.clearAllMocks())

  it('calls runInventoryDiff for every CONNECTED, non-disabled channel account', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'account-1' }, { id: 'account-2' }] })
    mockRunInventoryDiff.mockResolvedValue({ runId: 'run-x', comparedCount: 0, flaggedCount: 0 })

    await processTick()

    expect(mockRunInventoryDiff).toHaveBeenCalledTimes(2)
    expect(mockRunInventoryDiff).toHaveBeenCalledWith('account-1', null)
    expect(mockRunInventoryDiff).toHaveBeenCalledWith('account-2', null)
  })

  it('only selects CONNECTED, non-disabled accounts', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] })
    await processTick()
    expect(mockQuery.mock.calls[0][0]).toContain("status = 'CONNECTED'")
    expect(mockQuery.mock.calls[0][0]).toContain('disabled_by_admin = false')
  })

  it('a failure diffing one account does not stop the others from being processed', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'account-1' }, { id: 'account-2' }] })
    mockRunInventoryDiff
      .mockRejectedValueOnce(new Error('channel unreachable'))
      .mockResolvedValueOnce({ runId: 'run-x', comparedCount: 0, flaggedCount: 0 })

    await expect(processTick()).resolves.not.toThrow()
    expect(mockRunInventoryDiff).toHaveBeenCalledTimes(2)
  })

  it('never crashes the tick when the initial account-listing query throws', async () => {
    mockQuery.mockRejectedValue(new Error('connection reset'))
    await expect(processTick()).resolves.not.toThrow()
  })
})
