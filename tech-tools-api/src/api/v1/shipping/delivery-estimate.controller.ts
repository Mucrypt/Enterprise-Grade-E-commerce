/**
 * Public delivery-estimate endpoint -- backs the storefront PDP widget.
 * No auth: must work for anonymous shoppers.
 */
import { Request, Response } from 'express'
import geoip from 'geoip-lite'
import { getClientIp } from '../../../utils/helpers'
import logger from '../../../utils/logger'
import {
  addBusinessDays,
  resolveDeliveryTemplate,
  ProductNotFoundError,
} from '../../../services/shipping/delivery-estimate.service'

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function resolveCountryName(countryCode: string | null): string | null {
  if (!countryCode) return null
  try {
    return new Intl.DisplayNames(['en'], { type: 'region' }).of(countryCode) ?? null
  } catch {
    return null
  }
}

export const getDeliveryEstimate = async (req: Request, res: Response): Promise<void> => {
  try {
    const productId = req.query.productId as string | undefined
    if (!productId) {
      res.status(400).json({ success: false, error: '"productId" query parameter is required' })
      return
    }

    let countryCode: string | null = null
    let resolvedVia: 'query' | 'geoip' | 'none' = 'none'

    const queryCountry = req.query.country as string | undefined
    if (queryCountry && /^[A-Za-z]{2}$/.test(queryCountry)) {
      countryCode = queryCountry.toUpperCase()
      resolvedVia = 'query'
    } else {
      const ip = getClientIp(req).split(',')[0].trim()
      const geo = geoip.lookup(ip)
      if (geo?.country) {
        countryCode = geo.country
        resolvedVia = 'geoip'
      }
    }

    const { template, scopeMatched } = await resolveDeliveryTemplate(productId, countryCode)

    const now = new Date()
    const standardDateFrom = addBusinessDays(
      now,
      template.processing_days_min + template.transit_days_min,
      template.skip_weekends,
    )
    const standardDateTo = addBusinessDays(
      now,
      template.processing_days_max + template.transit_days_max,
      template.skip_weekends,
    )

    let expressDate: string | null = null
    if (template.express_transit_days_min !== null && template.express_transit_days_max !== null) {
      expressDate = formatDate(
        addBusinessDays(now, template.processing_days_min + template.express_transit_days_max, template.skip_weekends),
      )
    }

    res.json({
      success: true,
      data: {
        scopeMatched,
        templateName: template.name,
        standardLabel: template.standard_label,
        standardDateFrom: formatDate(standardDateFrom),
        standardDateTo: formatDate(standardDateTo),
        expressLabel: expressDate ? template.express_label : null,
        expressDate,
        resolvedCountry: countryCode,
        resolvedCountryName: resolveCountryName(countryCode),
        resolvedVia,
      },
    })
  } catch (error) {
    if (error instanceof ProductNotFoundError) {
      res.status(404).json({ success: false, error: 'Product not found' })
      return
    }
    logger.error('Error resolving delivery estimate:', error)
    res.status(500).json({ success: false, error: 'Failed to resolve delivery estimate' })
  }
}
