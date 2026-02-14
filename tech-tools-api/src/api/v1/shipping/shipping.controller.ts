/**
 * Shipping Controller
 * API endpoints for shipping rates, tracking, and label generation
 */

import { Response } from 'express'
import { AuthRequest } from '../../../middleware/auth'
import { query } from '../../../database/connection'
import shippingService, {
  CarrierType,
  ShippingAddress,
  Package,
  ShipmentRequest,
} from '../../../services/shipping'
import logger from '../../../utils/logger'

/**
 * Get shipping rates from all enabled carriers
 */
export const getRates = async (req: AuthRequest, res: Response) => {
  try {
    const { from, to, packages, carriers } = req.body

    if (!from || !to || !packages || !packages.length) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: from, to, packages',
      })
    }

    const fromAddress: ShippingAddress = {
      name: from.name || '',
      company: from.company,
      street1: from.street1 || from.address_line_1,
      street2: from.street2 || from.address_line_2,
      city: from.city,
      state: from.state,
      postalCode: from.postal_code || from.postalCode,
      country: from.country || 'US',
      phone: from.phone,
      email: from.email,
      isResidential: from.isResidential,
    }

    const toAddress: ShippingAddress = {
      name: to.name || '',
      company: to.company,
      street1: to.street1 || to.address_line_1,
      street2: to.street2 || to.address_line_2,
      city: to.city,
      state: to.state,
      postalCode: to.postal_code || to.postalCode,
      country: to.country || 'US',
      phone: to.phone,
      email: to.email,
      isResidential: to.isResidential ?? true,
    }

    const packageList: Package[] = packages.map((pkg: any) => ({
      weight: pkg.weight || 1,
      weightUnit: pkg.weightUnit || pkg.weight_unit || 'lb',
      length: pkg.length || 10,
      width: pkg.width || 10,
      height: pkg.height || 10,
      dimensionUnit: pkg.dimensionUnit || pkg.dimension_unit || 'in',
      value: pkg.value,
      description: pkg.description,
    }))

    const targetCarriers: CarrierType[] | undefined = carriers?.length
      ? carriers
      : undefined

    const rates = await shippingService.getRates(
      fromAddress,
      toAddress,
      packageList,
      targetCarriers,
    )

    res.json({
      success: true,
      data: {
        rates,
        fromAddress,
        toAddress,
      },
    })
  } catch (error) {
    logger.error('Get shipping rates error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to get shipping rates',
    })
  }
}

/**
 * Track a shipment
 */
export const trackShipment = async (req: AuthRequest, res: Response) => {
  try {
    const { trackingNumber, carrier } = req.params

    if (!trackingNumber || !carrier) {
      return res.status(400).json({
        success: false,
        error: 'Missing tracking number or carrier',
      })
    }

    const validCarriers: CarrierType[] = ['fedex', 'ups', 'dhl']
    if (!validCarriers.includes(carrier as CarrierType)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid carrier. Must be: fedex, ups, or dhl',
      })
    }

    const tracking = await shippingService.track(
      trackingNumber,
      carrier as CarrierType,
    )

    res.json({
      success: true,
      data: tracking,
    })
  } catch (error) {
    logger.error('Track shipment error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to track shipment',
    })
  }
}

/**
 * Create a shipment and get label
 */
export const createShipment = async (req: AuthRequest, res: Response) => {
  try {
    const { carrier, from, to, packages, serviceCode, labelFormat, reference } =
      req.body

    if (!carrier || !from || !to || !packages?.length || !serviceCode) {
      return res.status(400).json({
        success: false,
        error:
          'Missing required fields: carrier, from, to, packages, serviceCode',
      })
    }

    const validCarriers: CarrierType[] = ['fedex', 'ups', 'dhl']
    if (!validCarriers.includes(carrier)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid carrier. Must be: fedex, ups, or dhl',
      })
    }

    const shipmentRequest: ShipmentRequest = {
      from: {
        name: from.name,
        company: from.company,
        street1: from.street1 || from.address_line_1,
        street2: from.street2 || from.address_line_2,
        city: from.city,
        state: from.state,
        postalCode: from.postal_code || from.postalCode,
        country: from.country || 'US',
        phone: from.phone,
        email: from.email,
      },
      to: {
        name: to.name,
        company: to.company,
        street1: to.street1 || to.address_line_1,
        street2: to.street2 || to.address_line_2,
        city: to.city,
        state: to.state,
        postalCode: to.postal_code || to.postalCode,
        country: to.country || 'US',
        phone: to.phone,
        email: to.email,
      },
      packages: packages.map((pkg: any) => ({
        weight: pkg.weight || 1,
        weightUnit: pkg.weightUnit || pkg.weight_unit || 'lb',
        length: pkg.length || 10,
        width: pkg.width || 10,
        height: pkg.height || 10,
        dimensionUnit: pkg.dimensionUnit || pkg.dimension_unit || 'in',
        value: pkg.value,
        description: pkg.description,
      })),
      serviceCode,
      labelFormat: labelFormat || 'PDF',
      reference,
    }

    const label = await shippingService.createShipment(carrier, shipmentRequest)

    // Log shipment creation
    await query(
      `INSERT INTO shipping_labels (
        order_id, carrier, service_code, tracking_number, 
        label_data, label_format, cost, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT DO NOTHING`,
      [
        req.body.orderId || null,
        carrier,
        serviceCode,
        label.trackingNumber,
        label.labelData,
        label.labelFormat,
        label.cost,
        req.user?.id,
      ],
    ).catch(() => {
      // Table might not exist yet
    })

    res.json({
      success: true,
      data: label,
    })
  } catch (error) {
    logger.error('Create shipment error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to create shipment',
    })
  }
}

/**
 * Validate an address
 */
export const validateAddress = async (req: AuthRequest, res: Response) => {
  try {
    const { address, carrier = 'ups' } = req.body

    if (!address) {
      return res.status(400).json({
        success: false,
        error: 'Missing address',
      })
    }

    const shippingAddress: ShippingAddress = {
      name: address.name || '',
      company: address.company,
      street1: address.street1 || address.address_line_1,
      street2: address.street2 || address.address_line_2,
      city: address.city,
      state: address.state,
      postalCode: address.postal_code || address.postalCode,
      country: address.country || 'US',
      phone: address.phone,
      email: address.email,
    }

    const result = await shippingService.validateAddress(
      shippingAddress,
      carrier as CarrierType,
    )

    res.json({
      success: true,
      data: result,
    })
  } catch (error) {
    logger.error('Validate address error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to validate address',
    })
  }
}

/**
 * Cancel a shipment
 */
export const cancelShipment = async (req: AuthRequest, res: Response) => {
  try {
    const { trackingNumber, carrier } = req.params

    if (!trackingNumber || !carrier) {
      return res.status(400).json({
        success: false,
        error: 'Missing tracking number or carrier',
      })
    }

    const validCarriers: CarrierType[] = ['fedex', 'ups', 'dhl']
    if (!validCarriers.includes(carrier as CarrierType)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid carrier. Must be: fedex, ups, or dhl',
      })
    }

    const success = await shippingService.cancelShipment(
      trackingNumber,
      carrier as CarrierType,
    )

    if (success) {
      // Update label status in database
      await query(
        `UPDATE shipping_labels SET status = 'cancelled', updated_at = NOW() 
         WHERE tracking_number = $1`,
        [trackingNumber],
      ).catch(() => {})
    }

    res.json({
      success,
      message: success ? 'Shipment cancelled' : 'Failed to cancel shipment',
    })
  } catch (error) {
    logger.error('Cancel shipment error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to cancel shipment',
    })
  }
}

/**
 * Get available carrier services
 */
export const getCarrierServices = async (req: AuthRequest, res: Response) => {
  try {
    const { carrier } = req.params

    const validCarriers: CarrierType[] = ['fedex', 'ups', 'dhl']
    if (carrier && !validCarriers.includes(carrier as CarrierType)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid carrier. Must be: fedex, ups, or dhl',
      })
    }

    if (carrier) {
      const services = shippingService.getCarrierServices(
        carrier as CarrierType,
      )
      return res.json({
        success: true,
        data: { [carrier]: services },
      })
    }

    // Return all carrier services
    const allServices = {
      fedex: shippingService.getCarrierServices('fedex'),
      ups: shippingService.getCarrierServices('ups'),
      dhl: shippingService.getCarrierServices('dhl'),
    }

    res.json({
      success: true,
      data: allServices,
    })
  } catch (error) {
    logger.error('Get carrier services error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to get carrier services',
    })
  }
}

/**
 * Get enabled carriers
 */
export const getEnabledCarriers = async (req: AuthRequest, res: Response) => {
  try {
    const enabledCarriers = shippingService.getEnabledCarriers()

    // Also get from database
    const result = await query(
      `SELECT * FROM shipping_carriers WHERE is_active = true ORDER BY carrier_code`,
    ).catch(() => ({ rows: [] }))

    res.json({
      success: true,
      data: {
        enabled: enabledCarriers,
        carriers: result.rows,
      },
    })
  } catch (error) {
    logger.error('Get enabled carriers error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to get enabled carriers',
    })
  }
}

// =====================================================
// Admin Shipping Settings
// =====================================================

/**
 * Get all shipping carrier configurations
 */
export const getShippingCarriers = async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(
      `SELECT 
        id, carrier_code, carrier_name, is_active, is_sandbox,
        created_at, updated_at,
        -- Don't return full credentials, just indicate if configured
        CASE WHEN credentials IS NOT NULL AND credentials::text != '{}' 
          THEN true ELSE false END as is_configured
      FROM shipping_carriers
      ORDER BY carrier_name`,
    )

    res.json({
      success: true,
      data: result.rows,
    })
  } catch (error) {
    logger.error('Get shipping carriers error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to get shipping carriers',
    })
  }
}

/**
 * Update shipping carrier configuration
 */
export const updateShippingCarrier = async (
  req: AuthRequest,
  res: Response,
) => {
  try {
    const { carrierCode } = req.params
    const { isActive, isSandbox, credentials } = req.body

    const updates: string[] = []
    const params: any[] = []
    let paramIndex = 1

    if (typeof isActive === 'boolean') {
      updates.push(`is_active = $${paramIndex++}`)
      params.push(isActive)
    }

    if (typeof isSandbox === 'boolean') {
      updates.push(`is_sandbox = $${paramIndex++}`)
      params.push(isSandbox)
    }

    if (credentials) {
      updates.push(`credentials = $${paramIndex++}`)
      params.push(JSON.stringify(credentials))
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No updates provided',
      })
    }

    updates.push('updated_at = NOW()')
    params.push(carrierCode)

    const result = await query(
      `UPDATE shipping_carriers 
       SET ${updates.join(', ')}
       WHERE carrier_code = $${paramIndex}
       RETURNING id, carrier_code, carrier_name, is_active, is_sandbox, updated_at`,
      params,
    )

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Carrier not found',
      })
    }

    // Reinitialize shipping service
    await shippingService.initialize()

    res.json({
      success: true,
      data: result.rows[0],
      message: 'Carrier configuration updated',
    })
  } catch (error) {
    logger.error('Update shipping carrier error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to update shipping carrier',
    })
  }
}

/**
 * Get shipping settings
 */
export const getShippingSettings = async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(`SELECT * FROM shipping_settings LIMIT 1`)

    const settings = result.rows[0] || {
      default_weight_unit: 'lb',
      default_dimension_unit: 'in',
      default_country: 'US',
      free_shipping_threshold: null,
      handling_fee: 0,
      insurance_enabled: false,
      signature_required: false,
    }

    res.json({
      success: true,
      data: settings,
    })
  } catch (error) {
    logger.error('Get shipping settings error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to get shipping settings',
    })
  }
}

/**
 * Update shipping settings
 */
export const updateShippingSettings = async (
  req: AuthRequest,
  res: Response,
) => {
  try {
    const {
      defaultWeightUnit,
      defaultDimensionUnit,
      defaultCountry,
      freeShippingThreshold,
      handlingFee,
      insuranceEnabled,
      signatureRequired,
      originAddress,
    } = req.body

    const result = await query(
      `INSERT INTO shipping_settings (
        id, default_weight_unit, default_dimension_unit, default_country,
        free_shipping_threshold, handling_fee, insurance_enabled, 
        signature_required, origin_address, updated_at
      ) VALUES (
        1, $1, $2, $3, $4, $5, $6, $7, $8, NOW()
      )
      ON CONFLICT (id) DO UPDATE SET
        default_weight_unit = COALESCE($1, shipping_settings.default_weight_unit),
        default_dimension_unit = COALESCE($2, shipping_settings.default_dimension_unit),
        default_country = COALESCE($3, shipping_settings.default_country),
        free_shipping_threshold = COALESCE($4, shipping_settings.free_shipping_threshold),
        handling_fee = COALESCE($5, shipping_settings.handling_fee),
        insurance_enabled = COALESCE($6, shipping_settings.insurance_enabled),
        signature_required = COALESCE($7, shipping_settings.signature_required),
        origin_address = COALESCE($8, shipping_settings.origin_address),
        updated_at = NOW()
      RETURNING *`,
      [
        defaultWeightUnit,
        defaultDimensionUnit,
        defaultCountry,
        freeShippingThreshold,
        handlingFee,
        insuranceEnabled,
        signatureRequired,
        originAddress ? JSON.stringify(originAddress) : null,
      ],
    )

    res.json({
      success: true,
      data: result.rows[0],
      message: 'Shipping settings updated',
    })
  } catch (error) {
    logger.error('Update shipping settings error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to update shipping settings',
    })
  }
}

/**
 * Get shipping labels for an order
 */
export const getOrderLabels = async (req: AuthRequest, res: Response) => {
  try {
    const { orderId } = req.params

    const result = await query(
      `SELECT * FROM shipping_labels WHERE order_id = $1 ORDER BY created_at DESC`,
      [orderId],
    )

    res.json({
      success: true,
      data: result.rows,
    })
  } catch (error) {
    logger.error('Get order labels error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to get order labels',
    })
  }
}

/**
 * Calculate shipping for cart/checkout
 */
export const calculateShipping = async (req: AuthRequest, res: Response) => {
  try {
    const { items, shippingAddress } = req.body

    if (!items?.length || !shippingAddress) {
      return res.status(400).json({
        success: false,
        error: 'Missing items or shipping address',
      })
    }

    // Get shipping settings
    const settingsResult = await query(
      `SELECT * FROM shipping_settings LIMIT 1`,
    )
    const settings = settingsResult.rows[0] || {}

    // Get origin address from settings
    const originAddress = settings.origin_address || {
      name: 'TechTools Warehouse',
      street1: '123 Commerce St',
      city: 'Los Angeles',
      state: 'CA',
      postalCode: '90001',
      country: 'US',
    }

    // Calculate total weight and dimensions from items
    const productIds = items.map(
      (item: any) => item.product_id || item.productId,
    )
    const productsResult = await query(
      `SELECT id, weight, weight_unit, length, width, height, dimensions_unit 
       FROM products WHERE id = ANY($1)`,
      [productIds],
    )

    const productMap = new Map(productsResult.rows.map((p: any) => [p.id, p]))

    const packages: Package[] = []
    let totalValue = 0

    for (const item of items) {
      const product = productMap.get(item.product_id || item.productId)
      const quantity = item.quantity || 1
      totalValue += (item.price || 0) * quantity

      if (product) {
        packages.push({
          weight: (product.weight || 1) * quantity,
          weightUnit: product.weight_unit || 'lb',
          length: product.length || 10,
          width: product.width || 10,
          height: product.height || 10,
          dimensionUnit: product.dimensions_unit || 'in',
          value: (item.price || 0) * quantity,
        })
      }
    }

    // Consolidate packages if empty
    if (packages.length === 0) {
      packages.push({
        weight: 1,
        weightUnit: 'lb',
        length: 10,
        width: 10,
        height: 10,
        dimensionUnit: 'in',
      })
    }

    const toAddress: ShippingAddress = {
      name: shippingAddress.name || '',
      street1: shippingAddress.street1 || shippingAddress.address_line_1,
      street2: shippingAddress.street2 || shippingAddress.address_line_2,
      city: shippingAddress.city,
      state: shippingAddress.state,
      postalCode: shippingAddress.postal_code || shippingAddress.postalCode,
      country: shippingAddress.country || 'US',
      isResidential: true,
    }

    const rates = await shippingService.getRates(
      originAddress,
      toAddress,
      packages,
    )

    // Apply handling fee if configured
    const handlingFee = parseFloat(settings.handling_fee) || 0
    const adjustedRates = rates.map((rate) => ({
      ...rate,
      totalPrice: Math.round((rate.totalPrice + handlingFee) * 100) / 100,
    }))

    // Check for free shipping
    const freeShippingThreshold = parseFloat(settings.free_shipping_threshold)
    const qualifiesForFreeShipping =
      freeShippingThreshold && totalValue >= freeShippingThreshold

    res.json({
      success: true,
      data: {
        rates: adjustedRates,
        qualifiesForFreeShipping,
        freeShippingThreshold,
        orderValue: totalValue,
        handlingFee,
      },
    })
  } catch (error) {
    logger.error('Calculate shipping error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to calculate shipping',
    })
  }
}
