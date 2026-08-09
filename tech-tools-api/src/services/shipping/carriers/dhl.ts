/**
 * DHL Shipping Service
 * Integration with DHL Express API (MyDHL API)
 * Documentation: https://developer.dhl.com/api-reference/dhl-express-mydhl-api
 */

import { BaseCarrier } from './base'
import {
  ShippingAddress,
  Package,
  ShippingRate,
  TrackingInfo,
  TrackingEvent,
  ShipmentRequest,
  ShipmentLabel,
} from '../index'
import logger from '../../../utils/logger'

interface DHLCredentials {
  siteId: string
  password: string
  accountNumber: string
  sandbox: boolean
}

// DHL API Response Types
interface DHLErrorResponse {
  detail?: string
}

interface DHLRateResponse {
  products?: Array<{
    totalPrice?: Array<{ price?: number; currencyCode?: string }>
    deliveryCapabilities?: {
      estimatedDeliveryDateAndTime?: string
      totalTransitDays?: number
    }
    productName?: string
    productCode?: string
  }>
}

interface DHLTrackResponse {
  shipments?: Array<{
    events?: Array<unknown>
    status?: { statusCode?: string; status?: string }
    destination?: {
      address?: {
        addressLocality?: string
        postalCode?: string
        countryCode?: string
      }
    }
    estimatedDeliveryDate?: string
  }>
}

interface DHLShipmentResponse {
  shipmentTrackingNumber?: string
  documents?: Array<{ content?: string }>
  shipmentCharges?: Array<{ price?: number }>
}

interface DHLAddressResponse {
  address?: Array<{
    cityName?: string
    postalCode?: string
    addressLine?: string[]
    stateProvinceCode?: string
    countryCode?: string
  }>
}

export class DHLService extends BaseCarrier {
  private siteId: string = ''
  private password: string = ''
  private accountNumber: string = ''

  private get baseUrl(): string {
    return this.sandbox
      ? 'https://express.api.dhl.com/mydhlapi/test'
      : 'https://express.api.dhl.com/mydhlapi'
  }

  setCredentials(credentials: DHLCredentials): void {
    this.siteId = credentials.siteId
    this.password = credentials.password
    this.accountNumber = credentials.accountNumber
    this.sandbox = credentials.sandbox
  }

  private getAuthHeader(): string {
    return `Basic ${Buffer.from(`${this.siteId}:${this.password}`).toString(
      'base64',
    )}`
  }

  async getRates(
    from: ShippingAddress,
    to: ShippingAddress,
    packages: Package[],
  ): Promise<ShippingRate[]> {
    if (!this.siteId) {
      this.assertMockAllowed('DHL', 'rates')
      return this.getMockRates(from, to, packages)
    }

    try {
      const totalWeight = packages.reduce(
        (sum, pkg) =>
          sum + this.convertWeight(pkg.weight, pkg.weightUnit, 'kg'),
        0,
      )

      const plannedShippingDate = new Date()
      plannedShippingDate.setDate(plannedShippingDate.getDate() + 1)

      const response = await fetch(`${this.baseUrl}/rates`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: this.getAuthHeader(),
        },
        body: JSON.stringify({
          customerDetails: {
            shipperDetails: {
              postalCode: from.postalCode,
              cityName: from.city,
              countryCode: from.country,
              provinceCode: from.state,
              addressLine1: from.street1,
              addressLine2: from.street2,
            },
            receiverDetails: {
              postalCode: to.postalCode,
              cityName: to.city,
              countryCode: to.country,
              provinceCode: to.state,
              addressLine1: to.street1,
              addressLine2: to.street2,
            },
          },
          accounts: [
            {
              typeCode: 'shipper',
              number: this.accountNumber,
            },
          ],
          plannedShippingDateAndTime: plannedShippingDate.toISOString(),
          unitOfMeasurement: 'metric',
          isCustomsDeclarable: from.country !== to.country,
          packages: packages.map((pkg, index) => ({
            weight: this.convertWeight(pkg.weight, pkg.weightUnit, 'kg'),
            dimensions: {
              length: Math.round(
                this.convertDimensions(pkg.length, pkg.dimensionUnit, 'cm'),
              ),
              width: Math.round(
                this.convertDimensions(pkg.width, pkg.dimensionUnit, 'cm'),
              ),
              height: Math.round(
                this.convertDimensions(pkg.height, pkg.dimensionUnit, 'cm'),
              ),
            },
          })),
        }),
      })

      const data = (await response.json()) as DHLErrorResponse & DHLRateResponse

      if (!response.ok) {
        throw new Error(data?.detail || 'Failed to get DHL rates')
      }

      return this.parseRates(data)
    } catch (error) {
      logger.error('DHL rate error:', error)
      this.assertMockAllowed('DHL', 'rates')
      return this.getMockRates(from, to, packages)
    }
  }

  private parseRates(data: any): ShippingRate[] {
    const rates: ShippingRate[] = []
    const products = data.products || []

    for (const product of products) {
      const totalPrice = product.totalPrice?.[0]

      if (product.productCode && totalPrice) {
        rates.push({
          carrier: 'dhl',
          serviceCode: product.productCode,
          serviceName:
            product.productName || this.getServiceName(product.productCode),
          deliveryDays: product.deliveryCapabilities
            ?.estimatedDeliveryDateAndTime
            ? this.calculateDeliveryDays(
                product.deliveryCapabilities.estimatedDeliveryDateAndTime,
              )
            : null,
          deliveryDate:
            product.deliveryCapabilities?.estimatedDeliveryDateAndTime || null,
          totalPrice: parseFloat(totalPrice.price) || 0,
          currency: totalPrice.currencyType || 'USD',
          guaranteed:
            product.deliveryCapabilities?.totalTransitDays !== undefined,
        })
      }
    }

    return rates
  }

  private calculateDeliveryDays(deliveryDate: string): number {
    const delivery = new Date(deliveryDate)
    const now = new Date()
    const diffTime = Math.abs(delivery.getTime() - now.getTime())
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  }

  private getMockRates(
    from: ShippingAddress,
    to: ShippingAddress,
    packages: Package[],
  ): ShippingRate[] {
    const baseWeight = packages.reduce(
      (sum, pkg) => sum + this.convertWeight(pkg.weight, pkg.weightUnit, 'kg'),
      0,
    )

    const isInternational = from.country !== to.country

    if (isInternational) {
      return [
        {
          carrier: 'dhl',
          serviceCode: 'P',
          serviceName: 'DHL Express Worldwide',
          deliveryDays: 3,
          deliveryDate: null,
          totalPrice: Math.round((65.99 + baseWeight * 8.0) * 100) / 100,
          currency: 'USD',
          guaranteed: true,
        },
        {
          carrier: 'dhl',
          serviceCode: 'K',
          serviceName: 'DHL Express 9:00',
          deliveryDays: 2,
          deliveryDate: null,
          totalPrice: Math.round((95.99 + baseWeight * 12.0) * 100) / 100,
          currency: 'USD',
          guaranteed: true,
        },
        {
          carrier: 'dhl',
          serviceCode: 'E',
          serviceName: 'DHL Express 10:30',
          deliveryDays: 2,
          deliveryDate: null,
          totalPrice: Math.round((85.99 + baseWeight * 10.0) * 100) / 100,
          currency: 'USD',
          guaranteed: true,
        },
        {
          carrier: 'dhl',
          serviceCode: 'N',
          serviceName: 'DHL Express 12:00',
          deliveryDays: 2,
          deliveryDate: null,
          totalPrice: Math.round((79.99 + baseWeight * 9.0) * 100) / 100,
          currency: 'USD',
          guaranteed: true,
        },
        {
          carrier: 'dhl',
          serviceCode: 'Y',
          serviceName: 'DHL Express 12:00 Doc',
          deliveryDays: 2,
          deliveryDate: null,
          totalPrice: Math.round((49.99 + baseWeight * 6.0) * 100) / 100,
          currency: 'USD',
          guaranteed: true,
        },
      ]
    }

    // Domestic (DHL is primarily international but has some domestic in select markets)
    return [
      {
        carrier: 'dhl',
        serviceCode: 'N',
        serviceName: 'DHL Express Domestic',
        deliveryDays: 1,
        deliveryDate: null,
        totalPrice: Math.round((29.99 + baseWeight * 2.5) * 100) / 100,
        currency: 'USD',
        guaranteed: true,
      },
    ]
  }

  async track(trackingNumber: string): Promise<TrackingInfo> {
    if (!this.siteId) {
      this.assertMockAllowed('DHL', 'tracking')
      return this.getMockTracking(trackingNumber)
    }

    try {
      const response = await fetch(
        `${this.baseUrl}/shipments/${trackingNumber}/tracking?` +
          new URLSearchParams({
            trackingView: 'all-checkpoints',
            levelOfDetail: 'all',
          }),
        {
          method: 'GET',
          headers: {
            Authorization: this.getAuthHeader(),
          },
        },
      )

      const data = (await response.json()) as DHLErrorResponse &
        DHLTrackResponse

      if (!response.ok) {
        throw new Error(data.detail || 'Failed to track shipment')
      }

      return this.parseTracking(trackingNumber, data)
    } catch (error) {
      logger.error('DHL tracking error:', error)
      this.assertMockAllowed('DHL', 'tracking')
      return this.getMockTracking(trackingNumber)
    }
  }

  private parseTracking(trackingNumber: string, data: any): TrackingInfo {
    const shipment = data.shipments?.[0]

    if (!shipment) {
      throw new Error('Tracking information not found')
    }

    const events: TrackingEvent[] = (shipment.events || []).map(
      (event: any) => ({
        timestamp: event.timestamp,
        location: [
          event.location?.address?.cityName,
          event.location?.address?.countryCode,
        ]
          .filter(Boolean)
          .join(', '),
        description: event.description,
        status: event.statusCode,
      }),
    )

    const latestEvent = shipment.events?.[0]

    return {
      carrier: 'dhl',
      trackingNumber,
      status: shipment.status?.status || 'Unknown',
      statusDescription:
        shipment.status?.description || latestEvent?.description || '',
      estimatedDelivery: shipment.estimatedTimeOfDelivery || null,
      actualDelivery:
        shipment.status?.status === 'delivered' ? latestEvent?.timestamp : null,
      signedBy: shipment.receivedBy || null,
      events,
    }
  }

  private getMockTracking(trackingNumber: string): TrackingInfo {
    const now = new Date()
    const events: TrackingEvent[] = [
      {
        timestamp: new Date(now.getTime() - 1000 * 60 * 60 * 4).toISOString(),
        location: 'New York, US',
        description: 'Shipment is out with delivery courier',
        status: 'WC',
      },
      {
        timestamp: new Date(now.getTime() - 1000 * 60 * 60 * 12).toISOString(),
        location: 'New York, US',
        description: 'Arrived at DHL Service Point',
        status: 'AR',
      },
      {
        timestamp: new Date(now.getTime() - 1000 * 60 * 60 * 36).toISOString(),
        location: 'Cincinnati, US',
        description: 'Departed DHL Hub',
        status: 'DF',
      },
      {
        timestamp: new Date(now.getTime() - 1000 * 60 * 60 * 48).toISOString(),
        location: 'Cincinnati, US',
        description: 'Processed at DHL Hub',
        status: 'PO',
      },
      {
        timestamp: new Date(now.getTime() - 1000 * 60 * 60 * 60).toISOString(),
        location: 'London, GB',
        description: 'Shipment picked up',
        status: 'PU',
      },
    ]

    return {
      carrier: 'dhl',
      trackingNumber,
      status: 'transit',
      statusDescription: 'Shipment is out with delivery courier',
      estimatedDelivery: new Date(
        now.getTime() + 1000 * 60 * 60 * 6,
      ).toISOString(),
      actualDelivery: null,
      signedBy: null,
      events,
    }
  }

  async createShipment(request: ShipmentRequest): Promise<ShipmentLabel> {
    if (!this.siteId) {
      this.assertMockAllowed('DHL', 'label creation')
      return this.getMockLabel(request)
    }

    try {
      const plannedShippingDate = new Date()

      const response = await fetch(`${this.baseUrl}/shipments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: this.getAuthHeader(),
        },
        body: JSON.stringify({
          plannedShippingDateAndTime: plannedShippingDate.toISOString(),
          pickup: {
            isRequested: false,
          },
          productCode: request.serviceCode,
          accounts: [
            {
              typeCode: 'shipper',
              number: this.accountNumber,
            },
          ],
          customerDetails: {
            shipperDetails: {
              postalAddress: {
                postalCode: request.from.postalCode,
                cityName: request.from.city,
                countryCode: request.from.country,
                provinceCode: request.from.state,
                addressLine1: request.from.street1,
                addressLine2: request.from.street2,
              },
              contactInformation: {
                email: request.from.email,
                phone: request.from.phone,
                fullName: request.from.name,
                companyName: request.from.company,
              },
            },
            receiverDetails: {
              postalAddress: {
                postalCode: request.to.postalCode,
                cityName: request.to.city,
                countryCode: request.to.country,
                provinceCode: request.to.state,
                addressLine1: request.to.street1,
                addressLine2: request.to.street2,
              },
              contactInformation: {
                email: request.to.email,
                phone: request.to.phone,
                fullName: request.to.name,
                companyName: request.to.company,
              },
            },
          },
          content: {
            packages: request.packages.map((pkg, index) => ({
              weight: this.convertWeight(pkg.weight, pkg.weightUnit, 'kg'),
              dimensions: {
                length: Math.round(
                  this.convertDimensions(pkg.length, pkg.dimensionUnit, 'cm'),
                ),
                width: Math.round(
                  this.convertDimensions(pkg.width, pkg.dimensionUnit, 'cm'),
                ),
                height: Math.round(
                  this.convertDimensions(pkg.height, pkg.dimensionUnit, 'cm'),
                ),
              },
              customerReferences: [
                {
                  value: request.reference || `Package ${index + 1}`,
                },
              ],
              description: pkg.description || 'Package',
            })),
            isCustomsDeclarable: request.from.country !== request.to.country,
            description: request.reference || 'Shipment',
            incoterm: 'DAP',
            unitOfMeasurement: 'metric',
          },
          outputImageProperties: {
            printerDPI: 300,
            encodingFormat: request.labelFormat === 'ZPL' ? 'ZPL' : 'PDF',
            imageOptions: [
              {
                typeCode: 'label',
                templateName: 'ECOM26_84_001',
              },
            ],
          },
        }),
      })

      const data = (await response.json()) as DHLErrorResponse &
        DHLShipmentResponse

      if (!response.ok) {
        throw new Error(data.detail || 'Failed to create shipment')
      }

      return {
        trackingNumber: data.shipmentTrackingNumber || '',
        labelData: data.documents?.[0]?.content || '',
        labelFormat: request.labelFormat || 'PDF',
        carrier: 'dhl',
        serviceCode: request.serviceCode,
        cost: data.shipmentCharges?.[0]?.price || 0,
      }
    } catch (error) {
      logger.error('DHL create shipment error:', error)
      throw error
    }
  }

  private getMockLabel(request: ShipmentRequest): ShipmentLabel {
    const trackingNumber = `${Math.random().toString().slice(2, 12)}`

    return {
      trackingNumber,
      labelData: 'MOCK_DHL_LABEL_DATA_BASE64',
      labelFormat: request.labelFormat || 'PDF',
      carrier: 'dhl',
      serviceCode: request.serviceCode,
      cost: 65.99,
    }
  }

  async validateAddress(
    address: ShippingAddress,
  ): Promise<{ valid: boolean; suggestions?: ShippingAddress[] }> {
    if (!this.siteId) {
      this.assertMockAllowed('DHL', 'address validation')
      return { valid: true }
    }

    try {
      const response = await fetch(
        `${this.baseUrl}/address-validate?` +
          new URLSearchParams({
            countryCode: address.country,
            postalCode: address.postalCode,
            cityName: address.city,
            type: 'delivery',
          }),
        {
          method: 'GET',
          headers: {
            Authorization: this.getAuthHeader(),
          },
        },
      )

      const data = (await response.json()) as DHLAddressResponse

      if (!response.ok) {
        return { valid: false }
      }

      const addressResult = data.address?.[0]

      return {
        valid: !!(addressResult?.cityName && addressResult?.postalCode),
        suggestions: addressResult
          ? [
              {
                name: address.name,
                company: address.company,
                street1: addressResult.addressLine?.[0] || address.street1,
                street2: addressResult.addressLine?.[1],
                city: addressResult.cityName || address.city,
                state: addressResult.stateProvinceCode || address.state,
                postalCode: addressResult.postalCode || address.postalCode,
                country: addressResult.countryCode || address.country,
                phone: address.phone,
                email: address.email,
              },
            ]
          : undefined,
      }
    } catch (error) {
      logger.error('DHL address validation error:', error)
      return { valid: false }
    }
  }

  async cancelShipment(trackingNumber: string): Promise<boolean> {
    if (!this.siteId) {
      this.assertMockAllowed('DHL', 'shipment cancellation')
      return true
    }

    try {
      // DHL doesn't support direct shipment cancellation via API
      // This would typically require a pickup cancellation or return creation
      logger.warn('DHL shipment cancellation requires manual process')
      return false
    } catch (error) {
      logger.error('DHL cancel shipment error:', error)
      return false
    }
  }

  private getServiceName(code: string): string {
    const services: Record<string, string> = {
      P: 'DHL Express Worldwide',
      K: 'DHL Express 9:00',
      E: 'DHL Express 10:30',
      N: 'DHL Express 12:00',
      Y: 'DHL Express 12:00 Doc',
      T: 'DHL Express 12:00 Nondoc',
      D: 'DHL Express Worldwide Doc',
      U: 'DHL Express Worldwide EU Doc',
      C: 'DHL Express Worldwide EU',
      B: 'DHL Breakbulk Express',
      X: 'DHL Express Envelope',
      I: 'DHL Domestic Express 12:00',
      O: 'DHL Domestic Express',
      G: 'DHL Economy Select',
      W: 'DHL Economy Select Doc',
      M: 'DHL Express 10:30 Doc',
      L: 'DHL Express 10:30 Nondoc',
      J: 'DHL Jumbo Box',
      H: 'DHL Economy Select Nondoc',
      S: 'DHL Same Day',
    }
    return services[code] || `DHL Service ${code}`
  }

  static getServices(): { code: string; name: string }[] {
    return [
      { code: 'P', name: 'DHL Express Worldwide' },
      { code: 'K', name: 'DHL Express 9:00' },
      { code: 'E', name: 'DHL Express 10:30' },
      { code: 'N', name: 'DHL Express 12:00' },
      { code: 'Y', name: 'DHL Express 12:00 Doc' },
      { code: 'D', name: 'DHL Express Worldwide Doc' },
      { code: 'O', name: 'DHL Domestic Express' },
      { code: 'G', name: 'DHL Economy Select' },
      { code: 'S', name: 'DHL Same Day' },
    ]
  }
}
