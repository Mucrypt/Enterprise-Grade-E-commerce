import { __processSourcingRewriteTickForTests as processTick } from './sourcing-rewrite.worker'
import { query } from '../../database/connection'
import * as rewriteService from './sourcing-rewrite.service'

jest.mock('../../database/connection', () => ({ query: jest.fn() }))
jest.mock('../../utils/logger', () => ({
  __esModule: true,
  default: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}))
jest.mock('./sourcing-rewrite.service', () => ({ rewriteSourcedProduct: jest.fn() }))

const mockQuery = query as jest.Mock
const mockRewriteSourcedProduct = rewriteService.rewriteSourcedProduct as jest.Mock

describe('sourcing-rewrite.worker -- picks up captured rows, never blocks the extension', () => {
  beforeEach(() => jest.clearAllMocks())

  it('calls rewriteSourcedProduct for every eligible row', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'sp-1' }, { id: 'sp-2' }] })
    mockRewriteSourcedProduct.mockResolvedValue(undefined)

    await processTick()

    expect(mockRewriteSourcedProduct).toHaveBeenCalledTimes(2)
    expect(mockRewriteSourcedProduct).toHaveBeenCalledWith('sp-1')
    expect(mockRewriteSourcedProduct).toHaveBeenCalledWith('sp-2')
  })

  it('only selects captured rows under the retry cap', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] })
    await processTick()
    expect(mockQuery.mock.calls[0][0]).toContain("status = 'captured'")
    expect(mockQuery.mock.calls[0][0]).toContain('rewrite_attempt_count <')
    expect(mockQuery.mock.calls[0][1]).toEqual([3, 10])
  })

  it('a failure rewriting one row does not stop the others from being processed', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'sp-1' }, { id: 'sp-2' }] })
    mockRewriteSourcedProduct.mockRejectedValueOnce(new Error('OpenAI down')).mockResolvedValueOnce(undefined)

    await expect(processTick()).resolves.not.toThrow()
    expect(mockRewriteSourcedProduct).toHaveBeenCalledTimes(2)
  })

  it('never crashes the tick when the initial listing query throws', async () => {
    mockQuery.mockRejectedValue(new Error('connection reset'))
    await expect(processTick()).resolves.not.toThrow()
  })
})
