/**
 * Currency conversion for the sourcing domain (SOURCING-1) -- captured
 * Alibaba/Amazon prices are almost always USD; TechTools' store currency
 * is EUR. Uses api.frankfurter.dev, a free, no-API-key exchange-rate
 * service backed by official European Central Bank reference rates
 * (verified live: `curl "https://api.frankfurter.dev/v1/latest?base=USD&symbols=EUR"`
 * returns `{"amount":1.0,"base":"USD","rates":{"EUR":...}}`) -- an
 * appropriate source given this is a EUR-denominated European business.
 *
 * Rates are cached once per calendar day (Redis, same client this
 * codebase already uses for OAuth state -- see config/redis.ts) rather
 * than fetched per capture. A failed lookup NEVER guesses a rate or
 * blocks the capture -- convertToEur() returns null, and the caller
 * (sourced-product.service.ts) leaves captured_cost_price_eur NULL and
 * visibly flags the row for the founder to enter a cost manually. This
 * matches this codebase's established "NULL, not a guessed value"
 * discipline used throughout the TikTok Shop integration.
 */
import getRedisClient from '../../config/redis'
import logger from '../../utils/logger'

const FX_CACHE_TTL_SECONDS = 24 * 60 * 60
const FX_API_BASE_URL = 'https://api.frankfurter.dev/v1'
export const FX_RATE_SOURCE = 'frankfurter.dev'

export interface FxConversionResult {
  amountEur: number
  rate: number
  source: string
}

function fxCacheKey(currency: string, dateKey: string): string {
  return `sourcing_fx_rate:${currency}:${dateKey}`
}

function todayDateKey(): string {
  return new Date().toISOString().slice(0, 10)
}

/** Returns null (never throws, never guesses) if the rate cannot be determined. */
export async function convertToEur(amount: number, fromCurrency: string): Promise<FxConversionResult | null> {
  const currency = (fromCurrency || '').toUpperCase()
  if (!currency || !Number.isFinite(amount)) return null

  if (currency === 'EUR') {
    return { amountEur: amount, rate: 1, source: 'same-currency' }
  }

  const rate = await getRate(currency)
  if (rate === null) return null

  return { amountEur: Math.round(amount * rate * 100) / 100, rate, source: FX_RATE_SOURCE }
}

async function getRate(currency: string): Promise<number | null> {
  const key = fxCacheKey(currency, todayDateKey())

  try {
    const redisClient = getRedisClient()
    const cached = await redisClient.get(key)
    if (cached) {
      const cachedRate = Number(cached)
      if (Number.isFinite(cachedRate)) return cachedRate
    }

    const rate = await fetchRateFromProvider(currency)
    if (rate !== null) {
      await redisClient.set(key, String(rate), { EX: FX_CACHE_TTL_SECONDS })
    }
    return rate
  } catch (error) {
    // Redis unavailable is not a reason to fail the whole capture -- fall
    // back to a direct, uncached provider call.
    logger.error(`[SourcingFx] Cache unavailable for ${currency}, fetching rate directly`, error)
    try {
      return await fetchRateFromProvider(currency)
    } catch (fetchError) {
      logger.error(`[SourcingFx] Direct rate fetch also failed for ${currency}`, fetchError)
      return null
    }
  }
}

async function fetchRateFromProvider(currency: string): Promise<number | null> {
  const url = `${FX_API_BASE_URL}/latest?base=${encodeURIComponent(currency)}&symbols=EUR`
  const res = await fetch(url)
  if (!res.ok) {
    logger.error(`[SourcingFx] Provider returned HTTP ${res.status} for ${currency}`)
    return null
  }
  const body = (await res.json()) as { rates?: Record<string, number> }
  const rate = body.rates?.EUR
  return typeof rate === 'number' && Number.isFinite(rate) ? rate : null
}
