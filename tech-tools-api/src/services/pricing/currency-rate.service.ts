/**
 * Customer-facing currency conversion for the region/language picker --
 * lets a shopper see prices converted to their preferred currency while
 * TechTools' actual store/checkout currency stays EUR (see
 * services/sourcing/sourcing-fx.service.ts's header comment for why EUR
 * is the store currency). This is a deliberate sibling of that service,
 * not an extension of it: that module is scoped to sourcing-cost capture
 * (one-directional, X->EUR only) and its own doc comment frames it as
 * internal-only. This one is bidirectional and multi-target, but reuses
 * the exact same proven pattern: api.frankfurter.dev (ECB reference
 * rates, no API key), a once-per-calendar-day Redis cache via the shared
 * client (config/redis.ts), and a failed lookup that returns null and
 * never guesses a rate.
 */
import getRedisClient from '../../config/redis'
import logger from '../../utils/logger'

const FX_CACHE_TTL_SECONDS = 24 * 60 * 60
const FX_API_BASE_URL = 'https://api.frankfurter.dev/v1'
export const FX_RATE_SOURCE = 'frankfurter.dev'

// Curated, intentionally small set of display currencies for v1 -- not
// full ISO 4217 coverage. A country outside this set falls back to
// showing EUR rather than guessing a currency nobody validated.
export const SUPPORTED_CURRENCIES = ['EUR', 'USD', 'GBP', 'CHF', 'CAD'] as const
export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number]

export function isSupportedCurrency(value: string): value is SupportedCurrency {
  return (SUPPORTED_CURRENCIES as readonly string[]).includes(value)
}

function fxCacheKey(base: string, target: string, dateKey: string): string {
  return `fx_rate:${base}:${target}:${dateKey}`
}

function todayDateKey(): string {
  return new Date().toISOString().slice(0, 10)
}

/**
 * Returns the rate to multiply an amount in `base` by to get the
 * equivalent in `target`. Never throws, never guesses -- null means "we
 * don't know", and callers must treat that as "show the base-currency
 * price", not silently render zero or the un-converted number labeled
 * as the target currency.
 */
export async function getRate(base: string, target: string): Promise<number | null> {
  const from = (base || '').toUpperCase()
  const to = (target || '').toUpperCase()
  if (!from || !to) return null
  if (from === to) return 1

  const key = fxCacheKey(from, to, todayDateKey())

  try {
    const redisClient = getRedisClient()
    const cached = await redisClient.get(key)
    if (cached) {
      const cachedRate = Number(cached)
      if (Number.isFinite(cachedRate)) return cachedRate
    }

    const rate = await fetchRateFromProvider(from, to)
    if (rate !== null) {
      await redisClient.set(key, String(rate), { EX: FX_CACHE_TTL_SECONDS })
    }
    return rate
  } catch (error) {
    // Redis unavailable is not a reason to fail the request -- fall back
    // to a direct, uncached provider call, matching sourcing-fx.service.ts.
    logger.error(`[CurrencyRate] Cache unavailable for ${from}->${to}, fetching rate directly`, error)
    try {
      return await fetchRateFromProvider(from, to)
    } catch (fetchError) {
      logger.error(`[CurrencyRate] Direct rate fetch also failed for ${from}->${to}`, fetchError)
      return null
    }
  }
}

/** Fetches rates for several targets against one base in a single request. */
export async function getRates(
  base: string,
  targets: string[],
): Promise<Record<string, number>> {
  const from = (base || '').toUpperCase()
  const results: Record<string, number> = {}

  const toFetch = targets.map((t) => t.toUpperCase()).filter((t) => t && t !== from)
  if (toFetch.length === 0) return results

  // Each target still goes through the same per-pair cache (getRate),
  // so a partial cache hit doesn't force a full re-fetch of every
  // currency -- only the missing ones hit the provider.
  await Promise.all(
    toFetch.map(async (target) => {
      const rate = await getRate(from, target)
      if (rate !== null) results[target] = rate
    }),
  )

  return results
}

async function fetchRateFromProvider(base: string, target: string): Promise<number | null> {
  const url = `${FX_API_BASE_URL}/latest?base=${encodeURIComponent(base)}&symbols=${encodeURIComponent(target)}`
  const res = await fetch(url)
  if (!res.ok) {
    logger.error(`[CurrencyRate] Provider returned HTTP ${res.status} for ${base}->${target}`)
    return null
  }
  const body = (await res.json()) as { rates?: Record<string, number> }
  const rate = body.rates?.[target]
  return typeof rate === 'number' && Number.isFinite(rate) ? rate : null
}
