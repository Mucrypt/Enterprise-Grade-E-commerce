import { __processChannelOrderImportTickForTests as processTick } from './channel-order-import.worker'
import { query } from '../../database/connection'
import * as channelSyncService from './channel-sync.service'

jest.mock('../../database/connection', () => ({ query: jest.fn() }))
jest.mock('../../utils/logger', () => ({
  __esModule: true,
  default: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}))
jest.mock('./channel-sync.service', () => ({ importOrders: jest.fn() }))

const mockQuery = query as jest.Mock
const mockImportOrders = channelSyncService.importOrders as jest.Mock

describe('channel-order-import.worker -- polling reconciliation, never trusts a webhook payload alone', () => {
  beforeEach(() => jest.clearAllMocks())

  it('calls importOrders for every CONNECTED, non-disabled channel account', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'account-1' }, { id: 'account-2' }] })
    mockImportOrders.mockResolvedValue({ runId: 'run-x', totalFetched: 0, importedCount: 0, updatedCount: 0, failedCount: 0 })

    await processTick()

    expect(mockImportOrders).toHaveBeenCalledTimes(2)
    expect(mockImportOrders).toHaveBeenCalledWith('account-1', null)
    expect(mockImportOrders).toHaveBeenCalledWith('account-2', null)
  })

  it('only selects CONNECTED, non-disabled accounts', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] })
    await processTick()
    expect(mockQuery.mock.calls[0][0]).toContain("status = 'CONNECTED'")
    expect(mockQuery.mock.calls[0][0]).toContain('disabled_by_admin = false')
  })

  it('a failure importing one account does not stop the others from being processed', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'account-1' }, { id: 'account-2' }] })
    mockImportOrders
      .mockRejectedValueOnce(new Error('channel unreachable'))
      .mockResolvedValueOnce({ runId: 'run-x', totalFetched: 0, importedCount: 0, updatedCount: 0, failedCount: 0 })

    await expect(processTick()).resolves.not.toThrow()
    expect(mockImportOrders).toHaveBeenCalledTimes(2)
  })

  it('never crashes the tick when the initial account-listing query throws', async () => {
    mockQuery.mockRejectedValue(new Error('connection reset'))
    await expect(processTick()).resolves.not.toThrow()
  })
})
