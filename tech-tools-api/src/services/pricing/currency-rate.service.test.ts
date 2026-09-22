import { getRate, getRates, isSupportedCurrency, SUPPORTED_CURRENCIES } from './currency-rate.service'
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

describe('isSupportedCurrency', () => {
  it('accepts every currency in the curated list and rejects anything else', () => {
    for (const currency of SUPPORTED_CURRENCIES) {
      expect(isSupportedCurrency(currency)).toBe(true)
    }
    expect(isSupportedCurrency('JPY')).toBe(false)
    expect(isSupportedCurrency('')).toBe(false)
  })
})

describe('getRate -- same currency', () => {
  it('short-circuits to 1 and never touches Redis or fetch', async () => {
    global.fetch = jest.fn()
    const result = await getRate('EUR', 'EUR')
    expect(result).toBe(1)
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('is case-insensitive on both currency codes', async () => {
    global.fetch = jest.fn()
    const result = await getRate('eur', 'eur')
    expect(result).toBe(1)
  })
})

describe('getRate -- cross-currency, cache miss', () => {
  it('fetches a real bidirectional rate from the provider and caches it', async () => {
    const mockRedis = { get: jest.fn().mockResolvedValue(null), set: jest.fn().mockResolvedValue('OK') }
    mockGetRedisClient.mockReturnValue(mockRedis)
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ rates: { USD: 1.08 } }) })

    const result = await getRate('EUR', 'USD')

    expect(result).toBe(1.08)
    expect(global.fetch).toHaveBeenCalledTimes(1)
    const url = (global.fetch as jest.Mock).mock.calls[0][0]
    expect(url).toContain('base=EUR')
    expect(url).toContain('symbols=USD')
    expect(mockRedis.set).toHaveBeenCalledWith('fx_rate:EUR:USD:' + new Date().toISOString().slice(0, 10), '1.08', {
      EX: 24 * 60 * 60,
    })
  })
})

describe('getRate -- cache hit', () => {
  it('reuses the cached rate and never calls fetch', async () => {
    const mockRedis = { get: jest.fn().mockResolvedValue('0.79'), set: jest.fn() }
    mockGetRedisClient.mockReturnValue(mockRedis)
    global.fetch = jest.fn()

    const result = await getRate('EUR', 'GBP')

    expect(result).toBe(0.79)
    expect(global.fetch).not.toHaveBeenCalled()
    expect(mockRedis.set).not.toHaveBeenCalled()
  })
})

describe('getRate -- failure handling (never guesses, never throws)', () => {
  it('returns null when the provider HTTP call fails', async () => {
    const mockRedis = { get: jest.fn().mockResolvedValue(null), set: jest.fn() }
    mockGetRedisClient.mockReturnValue(mockRedis)
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 500 })

    await expect(getRate('EUR', 'USD')).resolves.toBeNull()
  })

  it('returns null when the provider response has no usable rate for the target', async () => {
    const mockRedis = { get: jest.fn().mockResolvedValue(null), set: jest.fn() }
    mockGetRedisClient.mockReturnValue(mockRedis)
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ rates: {} }) })

    await expect(getRate('EUR', 'USD')).resolves.toBeNull()
  })

  it('falls back to a direct (uncached) provider call if Redis itself is unavailable', async () => {
    mockGetRedisClient.mockImplementation(() => {
      throw new Error('Redis not connected')
    })
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ rates: { USD: 1.08 } }) })

    await expect(getRate('EUR', 'USD')).resolves.toBe(1.08)
  })

  it('returns null (never throws) if both Redis and the direct fallback fail', async () => {
    mockGetRedisClient.mockImplementation(() => {
      throw new Error('Redis not connected')
    })
    global.fetch = jest.fn().mockRejectedValue(new Error('network down'))

    await expect(getRate('EUR', 'USD')).resolves.toBeNull()
  })

  it('returns null for a missing/empty currency', async () => {
    await expect(getRate('EUR', '')).resolves.toBeNull()
    await expect(getRate('', 'USD')).resolves.toBeNull()
  })
})

describe('getRates -- multi-target', () => {
  it('fetches only the missing targets and skips a failed one rather than failing the whole batch', async () => {
    const mockRedis = {
      get: jest.fn((key: string) => (key.includes(':GBP:') ? Promise.resolve('0.79') : Promise.resolve(null))),
      set: jest.fn().mockResolvedValue('OK'),
    }
    mockGetRedisClient.mockReturnValue(mockRedis)
    global.fetch = jest.fn((url: string) => {
      if (url.includes('symbols=USD')) {
        return Promise.resolve({ ok: true, json: async () => ({ rates: { USD: 1.08 } }) })
      }
      // CHF lookup fails -- must not take GBP/USD down with it.
      return Promise.resolve({ ok: false, status: 500 })
    }) as unknown as typeof fetch

    const result = await getRates('EUR', ['USD', 'GBP', 'CHF'])

    expect(result).toEqual({ USD: 1.08, GBP: 0.79 })
    expect(result.CHF).toBeUndefined()
  })

  it('excludes the base currency from the results even if passed as a target', async () => {
    const mockRedis = { get: jest.fn().mockResolvedValue(null), set: jest.fn() }
    mockGetRedisClient.mockReturnValue(mockRedis)
    global.fetch = jest.fn()

    const result = await getRates('EUR', ['EUR'])

    expect(result).toEqual({})
    expect(global.fetch).not.toHaveBeenCalled()
  })
})
