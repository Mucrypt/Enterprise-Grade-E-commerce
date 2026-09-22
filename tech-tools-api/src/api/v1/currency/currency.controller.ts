import { Request, Response } from 'express'
import logger from '../../../utils/logger'
import {
  getRates,
  isSupportedCurrency,
  SUPPORTED_CURRENCIES,
} from '../../../services/pricing/currency-rate.service'

// Public, no-auth endpoint -- purely display conversion, nothing
// customer-specific or sensitive. Inherits the app's global rate
// limiter; no dedicated one needed for a cached, read-only lookup.
export const getCurrencyRates = async (req: Request, res: Response) => {
  try {
    const base = String(req.query.base || 'EUR').toUpperCase()
    if (!isSupportedCurrency(base)) {
      return res.status(400).json({
        success: false,
        error: `Unsupported base currency. Supported: ${SUPPORTED_CURRENCIES.join(', ')}`,
      })
    }

    const targetsParam = String(req.query.targets || SUPPORTED_CURRENCIES.join(','))
    const targets = targetsParam
      .split(',')
      .map((t) => t.trim().toUpperCase())
      .filter((t) => t && isSupportedCurrency(t) && t !== base)

    const rates = await getRates(base, targets)

    return res.json({
      success: true,
      data: {
        base,
        rates,
        fetchedAt: new Date().toISOString(),
      },
    })
  } catch (error) {
    logger.error('Get currency rates error:', error)
    return res.status(500).json({ success: false, error: 'Failed to load currency rates' })
  }
}
