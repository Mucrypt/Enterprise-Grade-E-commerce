import { convertToEur } from './sourcing-fx.service'
import getRedisClient from '../../config/redis'

jest.mock('../../config/redis', () => ({ __esModule: true, default: jest.fn() }))
jest.mock('../../utils/logger', () => ({
  __esModule: true,
  default: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}))

const mockGetRedisClient = getRedisClient as jest.Mock
const originalFetch = global.fetch

afterEach(() => {
  global.fetch = originalFetch
  jest.clearAllMocks()
})

describe('convertToEur -- same currency', () => {
  it('short-circuits with rate 1 and never touches Redis or fetch for EUR -> EUR', async () => {
    global.fetch = jest.fn()
    const result = await convertToEur(10, 'EUR')
    expect(result).toEqual({ amountEur: 10, rate: 1, source: 'same-currency' })
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('is case-insensitive on the currency code', async () => {
    global.fetch = jest.fn()
    const result = await convertToEur(10, 'eur')
    expect(result?.rate).toBe(1)
  })
})

describe('convertToEur -- cross-currency, cache miss', () => {
  it('fetches a real rate from the provider and converts', async () => {
    const mockRedis = { get: jest.fn().mockResolvedValue(null), set: jest.fn().mockResolvedValue('OK') }
    mockGetRedisClient.mockReturnValue(mockRedis)
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ rates: { EUR: 0.86 } }) })

    const result = await convertToEur(100, 'USD')

    expect(result).toEqual({ amountEur: 86, rate: 0.86, source: 'frankfurter.dev' })
    expect(global.fetch).toHaveBeenCalledTimes(1)
    expect((global.fetch as jest.Mock).mock.calls[0][0]).toContain('base=USD')
    expect(mockRedis.set).toHaveBeenCalledWith(expect.stringContaining('USD'), '0.86', { EX: 24 * 60 * 60 })
  })
})

describe('convertToEur -- cache hit', () => {
  it('reuses the cached rate and never calls fetch', async () => {
    const mockRedis = { get: jest.fn().mockResolvedValue('0.9'), set: jest.fn() }
    mockGetRedisClient.mockReturnValue(mockRedis)
    global.fetch = jest.fn()

    const result = await convertToEur(50, 'USD')

    expect(result).toEqual({ amountEur: 45, rate: 0.9, source: 'frankfurter.dev' })
    expect(global.fetch).not.toHaveBeenCalled()
    expect(mockRedis.set).not.toHaveBeenCalled()
  })
})

describe('convertToEur -- failure handling (never guesses, never throws)', () => {
  it('returns null (not a guessed value) when the provider HTTP call fails', async () => {
    const mockRedis = { get: jest.fn().mockResolvedValue(null), set: jest.fn() }
    mockGetRedisClient.mockReturnValue(mockRedis)
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 500 })

    const result = await convertToEur(100, 'USD')
    expect(result).toBeNull()
  })

  it('returns null when the provider response has no usable EUR rate', async () => {
    const mockRedis = { get: jest.fn().mockResolvedValue(null), set: jest.fn() }
    mockGetRedisClient.mockReturnValue(mockRedis)
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ rates: {} }) })

    const result = await convertToEur(100, 'USD')
    expect(result).toBeNull()
  })

  it('falls back to a direct (uncached) provider call if Redis itself is unavailable, rather than failing the conversion', async () => {
    mockGetRedisClient.mockImplementation(() => {
      throw new Error('Redis not connected')
    })
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ rates: { EUR: 0.86 } }) })

    const result = await convertToEur(100, 'USD')
    expect(result).toEqual({ amountEur: 86, rate: 0.86, source: 'frankfurter.dev' })
  })

  it('returns null (never throws) if both Redis and the direct fallback fail', async () => {
    mockGetRedisClient.mockImplementation(() => {
      throw new Error('Redis not connected')
    })
    global.fetch = jest.fn().mockRejectedValue(new Error('network down'))

    await expect(convertToEur(100, 'USD')).resolves.toBeNull()
  })

  it('returns null for a non-finite amount rather than propagating NaN', async () => {
    const result = await convertToEur(NaN, 'USD')
    expect(result).toBeNull()
  })

  it('returns null for a missing/empty currency', async () => {
    const result = await convertToEur(100, '')
    expect(result).toBeNull()
  })
})
