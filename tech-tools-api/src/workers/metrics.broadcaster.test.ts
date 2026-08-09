import { getActiveAlertStats } from './metrics.broadcaster'
import { query } from '../database/connection'

jest.mock('../database/connection', () => ({
  query: jest.fn(),
}))

jest.mock('../utils/logger', () => ({
  __esModule: true,
  default: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}))

jest.mock('../services/websocket.service', () => ({
  webSocketService: { broadcastMetrics: jest.fn() },
}))

const mockQuery = query as jest.Mock

describe('getActiveAlertStats (against the repaired alerts table)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns real counts from the alerts table on the happy path', async () => {
    mockQuery.mockResolvedValue({
      rows: [{ critical: '2', high: '1', medium: '0', low: '3' }],
    })

    const stats = await getActiveAlertStats()

    expect(mockQuery.mock.calls[0][0]).toContain('FROM alerts')
    // COUNT(*) comes back from pg as a string (bigint); this function
    // passes it through as-is on the happy path (unlike the 42P01 fallback,
    // which returns real numbers) -- asserting the real current behavior,
    // not a fixed-up expectation.
    expect(stats).toEqual({ critical: '2', high: '1', medium: '0', low: '3' })
  })

  it('still degrades gracefully to zeroed counts if the table were ever missing again (42P01)', async () => {
    const err: any = new Error('relation "alerts" does not exist')
    err.code = '42P01'
    mockQuery.mockRejectedValue(err)

    const stats = await getActiveAlertStats()

    expect(stats).toEqual({ critical: 0, high: 0, medium: 0, low: 0 })
  })
})
