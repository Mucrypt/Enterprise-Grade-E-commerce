/**
 * Shipping Service - Main Entry Point
 * Provides unified interface for multiple shipping carriers (FedEx, UPS, DHL)
 */

import { FedExService } from './carriers/fedex'
import { UPSService } from './carriers/ups'
import { DHLService } from './carriers/dhl'
import { query } from '../../database/connection'
import logger from '../../utils/logger'

// Types
export interface ShippingAddress {
  name: string
  company?: string
  street1: string
  street2?: string
  city: string
  state: string
  postalCode: string
  country: string
  phone?: string
  email?: string
  isResidential?: boolean
}

export interface Package {
  weight: number
  weightUnit: 'lb' | 'kg' | 'oz' | 'g'
  length: number
  width: number
  height: number
  dimensionUnit: 'in' | 'cm'
  value?: number
  description?: string
}

export interface ShippingRate {
  carrier: 'fedex' | 'ups' | 'dhl'
  serviceCode: string
  serviceName: string
  deliveryDays: number | null
  deliveryDate: string | null
  totalPrice: number
  currency: string
  guaranteed: boolean
  rateId?: string
}

export interface TrackingEvent {
  timestamp: string
  location: string
  description: string
  status: string
}

export interface TrackingInfo {
  carrier: 'fedex' | 'ups' | 'dhl'
  trackingNumber: string
  status: string
  statusDescription: string
  estimatedDelivery: string | null
  actualDelivery: string | null
  signedBy: string | null
  events: TrackingEvent[]
}

export interface ShipmentRequest {
  from: ShippingAddress
  to: ShippingAddress
  packages: Package[]
  serviceCode: string
  labelFormat?: 'PDF' | 'PNG' | 'ZPL'
  signature?: boolean
  insurance?: number
  reference?: string
}

export interface ShipmentLabel {
  trackingNumber: string
  labelData: string
  labelFormat: string
  carrier: string
  serviceCode: string
  cost: number
}

export type CarrierType = 'fedex' | 'ups' | 'dhl'

export interface CarrierCredentials {
  fedex?: {
    accountNumber: string
    apiKey: string
    secretKey: string
    sandbox: boolean
  }
  ups?: {
    accountNumber: string
    clientId: string
    clientSecret: string
    sandbox: boolean
  }
  dhl?: {
    siteId: string
    password: string
    accountNumber: string
    sandbox: boolean
  }
}

class ShippingService {
  private fedex: FedExService
  private ups: UPSService
  private dhl: DHLService
  private credentials: CarrierCredentials = {}
  private enabledCarriers: CarrierType[] = []

  constructor() {
    this.fedex = new FedExService()
    this.ups = new UPSService()
    this.dhl = new DHLService()
  }

  /**
   * Initialize with credentials from database
   */
  async initialize(): Promise<void> {
    try {
      const result = await query(
        `SELECT * FROM shipping_carriers WHERE is_active = true`,
      )

      for (const carrier of result.rows) {
        const credentials = carrier.credentials as any

        switch (carrier.carrier_code) {
          case 'fedex':
            this.credentials.fedex = {
              accountNumber: credentials.accountNumber,
              apiKey: credentials.apiKey,
              secretKey: credentials.secretKey,
              sandbox: carrier.is_sandbox,
            }
            this.fedex.setCredentials(this.credentials.fedex)
            this.enabledCarriers.push('fedex')
            break

          case 'ups':
            this.credentials.ups = {
              accountNumber: credentials.accountNumber,
              clientId: credentials.clientId,
              clientSecret: credentials.clientSecret,
              sandbox: carrier.is_sandbox,
            }
            this.ups.setCredentials(this.credentials.ups)
            this.enabledCarriers.push('ups')
            break

          case 'dhl':
            this.credentials.dhl = {
              siteId: credentials.siteId,
              password: credentials.password,
              accountNumber: credentials.accountNumber,
              sandbox: carrier.is_sandbox,
            }
            this.dhl.setCredentials(this.credentials.dhl)
            this.enabledCarriers.push('dhl')
            break
        }
      }

      logger.info(
        `Shipping service initialized with carriers: ${this.enabledCarriers.join(
          ', ',
        )}`,
      )
    } catch (error) {
      logger.warn(
        'Failed to initialize shipping service from database, using mock mode',
      )
    }
  }

  /**
   * Get shipping rates from all enabled carriers
   */
  async getRates(
    from: ShippingAddress,
    to: ShippingAddress,
    packages: Package[],
    carriers?: CarrierType[],
  ): Promise<ShippingRate[]> {
    const targetCarriers = carriers || this.enabledCarriers
    const ratePromises: Promise<ShippingRate[]>[] = []

    for (const carrier of targetCarriers) {
      switch (carrier) {
        case 'fedex':
          ratePromises.push(this.fedex.getRates(from, to, packages))
          break
        case 'ups':
          ratePromises.push(this.ups.getRates(from, to, packages))
          break
        case 'dhl':
          ratePromises.push(this.dhl.getRates(from, to, packages))
          break
      }
    }

    const results = await Promise.allSettled(ratePromises)
    const rates: ShippingRate[] = []

    for (const result of results) {
      if (result.status === 'fulfilled') {
        rates.push(...result.value)
      } else {
        logger.warn('Carrier rate request failed:', result.reason)
      }
    }

    // Sort by price
    return rates.sort((a, b) => a.totalPrice - b.totalPrice)
  }

  /**
   * Track a shipment
   */
  async track(
    trackingNumber: string,
    carrier: CarrierType,
  ): Promise<TrackingInfo> {
    switch (carrier) {
      case 'fedex':
        return this.fedex.track(trackingNumber)
      case 'ups':
        return this.ups.track(trackingNumber)
      case 'dhl':
        return this.dhl.track(trackingNumber)
      default:
        throw new Error(`Unknown carrier: ${carrier}`)
    }
  }

  /**
   * Create a shipment and get label
   */
  async createShipment(
    carrier: CarrierType,
    request: ShipmentRequest,
  ): Promise<ShipmentLabel> {
    switch (carrier) {
      case 'fedex':
        return this.fedex.createShipment(request)
      case 'ups':
        return this.ups.createShipment(request)
      case 'dhl':
        return this.dhl.createShipment(request)
      default:
        throw new Error(`Unknown carrier: ${carrier}`)
    }
  }

  /**
   * Validate address
   */
  async validateAddress(
    address: ShippingAddress,
    carrier: CarrierType = 'ups',
  ): Promise<{ valid: boolean; suggestions?: ShippingAddress[] }> {
    switch (carrier) {
      case 'fedex':
        return this.fedex.validateAddress(address)
      case 'ups':
        return this.ups.validateAddress(address)
      case 'dhl':
        return this.dhl.validateAddress(address)
      default:
        throw new Error(`Unknown carrier: ${carrier}`)
    }
  }

  /**
   * Cancel a shipment
   */
  async cancelShipment(
    trackingNumber: string,
    carrier: CarrierType,
  ): Promise<boolean> {
    switch (carrier) {
      case 'fedex':
        return this.fedex.cancelShipment(trackingNumber)
      case 'ups':
        return this.ups.cancelShipment(trackingNumber)
      case 'dhl':
        return this.dhl.cancelShipment(trackingNumber)
      default:
        throw new Error(`Unknown carrier: ${carrier}`)
    }
  }

  /**
   * Get carrier services list
   */
  getCarrierServices(carrier: CarrierType): { code: string; name: string }[] {
    switch (carrier) {
      case 'fedex':
        return FedExService.getServices()
      case 'ups':
        return UPSService.getServices()
      case 'dhl':
        return DHLService.getServices()
      default:
        return []
    }
  }

  /**
   * Get all enabled carriers
   */
  getEnabledCarriers(): CarrierType[] {
    return [...this.enabledCarriers]
  }
}

// Export singleton instance
export const shippingService = new ShippingService()
export default shippingService
